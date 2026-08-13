'use strict';
/**
 * Vercel serverless entry point. Vercel routes any request under /api/*
 * to this catch-all function (no vercel.json rewrites needed for this).
 * It reuses the exact same router/route handlers as the local dev server
 * (server/app.js) — nothing about the route logic is duplicated here.
 */
const { sendJSON } = require('../server/lib/http');
const { getRouter } = require('../server/app');

module.exports = async (req, res) => {
  try {
    const router = await getRouter();
    const url = new URL(req.url, 'http://localhost');
    const handled = await router.handle(req, res, url.pathname);
    if (!handled && !res.writableEnded) {
      sendJSON(res, 404, { error: 'API endpoint not found.' });
    }
  } catch (err) {
    console.error('Unhandled error in /api function:', err);
    if (!res.writableEnded) {
      sendJSON(res, 500, { error: 'Internal server error' });
    }
  }
};
