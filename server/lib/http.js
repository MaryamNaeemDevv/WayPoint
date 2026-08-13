'use strict';

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('Payload too large. Files are limited to about 4MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Simple path matcher supporting :param segments */
function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = decodeURIComponent(pathParts[i]);
    if (p.startsWith(':')) {
      params[p.slice(1)] = v;
    } else if (p !== v) {
      return null;
    }
  }
  return params;
}

class Router {
  constructor() {
    this.routes = [];
  }
  add(method, pattern, ...handlers) {
    this.routes.push({ method, pattern, handlers });
    return this;
  }
  get(p, ...h) { return this.add('GET', p, ...h); }
  post(p, ...h) { return this.add('POST', p, ...h); }
  put(p, ...h) { return this.add('PUT', p, ...h); }
  patch(p, ...h) { return this.add('PATCH', p, ...h); }
  delete(p, ...h) { return this.add('DELETE', p, ...h); }

  async handle(req, res, pathname) {
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const params = matchPath(route.pattern, pathname);
      if (!params) continue;
      req.params = params;
      try {
        for (const handler of route.handlers) {
          let stopped = false;
          const next = () => {};
          const result = await handler(req, res, next);
          if (res.writableEnded) { stopped = true; break; }
          if (stopped) break;
        }
      } catch (err) {
        console.error('Route error:', err);
        if (!res.writableEnded) sendJSON(res, 500, { error: err.message || 'Internal server error' });
      }
      return true;
    }
    return false;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { sendJSON, readBody, Router, HttpError, matchPath };
