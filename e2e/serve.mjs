import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = '/Users/ganin/Work/ngx-stack/dist/demo/browser';
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    const file = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    // SPA fallback — every unknown path is a route.
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(await readFile(join(ROOT, 'index.html')));
  }
}).listen(4321, () => console.log('serving dist/demo on http://localhost:4321'));
