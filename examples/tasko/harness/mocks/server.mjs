// Demo server for the Tasko sample: serves the real app's files and answers its API with fixed demo data,
// so every take looks the same. Logs any API route it does not know (a sign the app changed).
// Usage: node mocks/server.mjs [port]      (default 4890)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = JSON.parse(fs.readFileSync(path.join(H, 'product.json'), 'utf8'));
const APP = path.resolve(H, P.productDir);   // relative paths are relative to the harness
const PORT = +(process.argv[2] || 4890);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

// The one demo story every video uses (also written in product.json → demo).
const API = {
  '/api/tasks': { tasks: [
    { title: 'Print the new menu cards', who: 'Arjun', done: false, tag: 'Today' },
    { title: 'Photograph the masala chai', who: 'Noor', done: false },
    { title: 'Post the launch on Instagram', who: 'Riya', done: false },
    { title: 'Order 200 paper cups', who: 'Kabir', done: true },
  ] },
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const body = API[url.pathname];
    if (!body) console.log(`[mock] unknown API route ${req.method} ${url.pathname}`);
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(body || { error: 'not mocked' }));
  }
  const file = path.join(APP, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(APP) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`[mock] Tasko demo at http://127.0.0.1:${PORT}/ (app files from ${APP})`));
