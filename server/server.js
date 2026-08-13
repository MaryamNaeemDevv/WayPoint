'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { sendJSON } = require('./lib/http');
const { getRouter, deadlineSweep } = require('./app');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: unknown non-API, non-file routes serve index.html for client-side routing
      if (!pathname.startsWith('/api/')) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
          if (err2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(404); res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function start() {
  // Wait for tables to exist before accepting any requests
  const router = await getRouter();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      const handled = await router.handle(req, res, pathname);
      if (!handled && !res.writableEnded) {
        sendJSON(res, 404, { error: 'API endpoint not found.' });
      }
      return;
    }

    serveStatic(req, res, pathname);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`TaskFlow server running at http://localhost:${PORT}`);
  });

  // Deadline sweep: run on boot and then every hour
  await deadlineSweep();
  setInterval(() => {
    deadlineSweep().catch((err) => console.error('Deadline sweep failed:', err));
  }, 1000 * 60 * 60);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
