// Tiny zero-dep static server for the test (serves ../assets on :8753).
// Used by playwright.config.mjs as the webServer. Cross-platform (pure Node).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/markdown' };
const PORT = process.env.PORT ? Number(process.env.PORT) : 8753;

http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || '/').split('?')[0]);
  const fp = path.join(ASSETS, rel === '/' ? 'kanban-template.html' : rel);
  if (!fp.startsWith(ASSETS)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`[serve] assets on http://localhost:${PORT}`));
