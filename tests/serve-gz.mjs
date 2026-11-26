#!/usr/bin/env node
// Tiny static server for Lighthouse CI that gzips text assets like GitHub Pages does.
// Node built-ins only (http, fs, path, zlib, url). Works on Node 18 and 22.
// Usage: node tests/serve-gz.mjs <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '127.0.0.1';
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('Usage: node tests/serve-gz.mjs <port>');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const GZIP = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml']);

function send(res, status, body, method) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache',
  });
  res.end(method === 'HEAD' ? undefined : body);
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, '405 Method Not Allowed\n', method);
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    return send(res, 400, '400 Bad Request\n', method);
  }
  if (pathname.includes('\0')) return send(res, 400, '400 Bad Request\n', method);
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = path.resolve(ROOT, '.' + path.posix.normalize('/' + pathname));
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return send(res, 403, '403 Forbidden\n', method);
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, `404 Not Found: ${pathname}\n`, method);

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Last-Modified': stat.mtime.toUTCString(),
    };
    const compressible = GZIP.has(ext);
    if (compressible) headers['Vary'] = 'Accept-Encoding';
    const wantsGzip = compressible && /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 500, '500 Internal Server Error\n', method);
      let body = data;
      if (wantsGzip) {
        body = zlib.gzipSync(data);
        headers['Content-Encoding'] = 'gzip';
      }
      headers['Content-Length'] = body.length;
      res.writeHead(200, headers);
      res.end(method === 'HEAD' ? undefined : body);
    });
  });
});

server.on('error', (err) => {
  console.error(`serve-gz: cannot listen on ${HOST}:${port}: ${err.code || err.message}`);
  process.exit(1);
});

server.listen(port, HOST, () => {
  console.log(`serve-gz: serving ${ROOT}`);
  console.log(`Available on: http://${HOST}:${port}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
