// Shared CPU budget when several recordings or renders run at once: at most `slots` holders of one kind at a
// time, machine-wide (lock folders under <harness>/locks, stale holders are cleared by pid).
//   'record'  (2 slots): live captures of the real UI, which need smooth frame rates.
//   'compose' (2 slots): heavy renders and encodes (compose2, raw export).
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS } from './env.mjs';
const DIR = path.join(HARNESS, 'locks');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toTimeString().slice(0, 8);
process.setMaxListeners(100);
let signalsHooked = false;
function hookSignals() {
  if (signalsHooked) return;
  signalsHooked = true;
  // Make Ctrl-C / kill run the 'exit' handlers that free our slots.
  for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
    if (process.listenerCount(sig) === 0) process.on(sig, () => process.exit(code));
  }
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function tryTake(p, label) {
  try {
    fs.mkdirSync(p);
  } catch (e) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(p, 'owner.json'), 'utf8'));
      if (o && o.pid && !alive(o.pid)) { fs.rmSync(p, { recursive: true, force: true }); return tryTake(p, label); }
    } catch (e2) {
      // No owner file: a holder is between mkdir and write, or died right there. Clear it after 30 s.
      try { if (Date.now() - fs.statSync(p).mtimeMs > 30000) { fs.rmSync(p, { recursive: true, force: true }); return tryTake(p, label); } } catch (e3) {}
    }
    return false;
  }
  fs.writeFileSync(path.join(p, 'owner.json'), JSON.stringify({ pid: process.pid, label, at: new Date().toISOString() }));
  return true;
}
function owners(kind) {
  try {
    return fs.readdirSync(DIR).filter((n) => n.startsWith(kind + '-')).map((n) => {
      try { return JSON.parse(fs.readFileSync(path.join(DIR, n, 'owner.json'), 'utf8')).label || '?'; } catch (e) { return '?'; }
    });
  } catch (e) { return []; }
}
// First come, first served: every waiter takes a ticket; only the oldest live ticket of a kind may take
// slots. So a waiter that needs 2 slots (laptop + phone recorded together) can't be starved by a stream of
// 1-slot waiters grabbing each slot the moment it frees. Dead waiters' tickets are cleared by pid.
const QDIR = path.join(DIR, 'queue');
function takeTicket(kind, need, label) {
  fs.mkdirSync(QDIR, { recursive: true });
  const name = `${kind}__${String(Date.now()).padStart(15, '0')}__${process.pid}__${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(path.join(QDIR, name), JSON.stringify({ pid: process.pid, need, label, at: new Date().toISOString() }));
  return name;
}
function liveTickets(kind) {
  let names = [];
  try { names = fs.readdirSync(QDIR).filter((n) => n.startsWith(kind + '__')).sort(); } catch (e) { return []; }
  return names.filter((n) => {
    const pid = Number(n.split('__')[2]);
    if (pid && !alive(pid)) { try { fs.rmSync(path.join(QDIR, n), { force: true }); } catch (e) {} return false; }
    return true;
  });
}
// All-or-nothing: takes `need` slots of `kind` or none, so two multi-slot holders can never deadlock.
export async function acquire(kind, { slots = 2, need = 1, label = '' } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  hookSignals();
  const t0 = Date.now();
  let lastBeat = t0;
  const ticket = takeTicket(kind, need, label);
  let ticketDropped = false;
  const dropTicket = () => {
    if (ticketDropped) return;
    ticketDropped = true;
    try { fs.rmSync(path.join(QDIR, ticket), { force: true }); } catch (e) {}
  };
  process.once('exit', dropTicket);
  for (;;) {
    const queue = liveTickets(kind);
    const pos = queue.indexOf(ticket);
    if (pos === 0 || pos === -1) {
      const held = [];
      for (let i = 0; i < slots && held.length < need; i++) {
        const p = path.join(DIR, `${kind}-${i}`);
        if (tryTake(p, label)) held.push(p);
      }
      if (held.length >= need) {
        dropTicket();
        if (Date.now() - t0 > 2000) console.log(`[${ts()}] got ${need} ${kind} slot(s) after ${Math.round((Date.now() - t0) / 1000)}s (${label})`);
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          for (const p of held) fs.rmSync(p, { recursive: true, force: true });
        };
        process.once('exit', release);
        return release;
      }
      for (const p of held) fs.rmSync(p, { recursive: true, force: true });
    }
    if (Date.now() - lastBeat > 15000) {
      lastBeat = Date.now();
      console.log(`[${ts()}] …waiting ${Math.round((Date.now() - t0) / 1000)}s for ${need} ${kind} slot(s), place ${pos + 1} of ${queue.length} in line (busy: ${owners(kind).join(', ')})`);
    }
    await sleep(700 + Math.random() * 400);
  }
}
export async function withSlot(kind, opts, fn) {
  const release = await acquire(kind, opts);
  try { return await fn(); } finally { release(); }
}
