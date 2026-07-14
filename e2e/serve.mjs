import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file, not from where you happen to have cloned the repo. An absolute path here
// works on exactly one machine and fails on every other, including CI — which is precisely where you
// find out.
const ROOT = fileURLToPath(new URL('../dist/demo/browser/', import.meta.url));

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));

  try {
    const file = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    // SPA fallback: every unknown path is a route, which is the whole point of the library.
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(await readFile(join(ROOT, 'index.html')));
  }
}).listen(4321, () => console.log(`serving ${ROOT} on http://localhost:4321`));
