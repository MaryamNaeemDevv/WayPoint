'use strict';
/**
 * Triggered by Vercel Cron (see vercel.json). Replaces the setInterval-based
 * sweep from the persistent server, since serverless functions don't stay
 * alive between requests.
 *
 * Vercel automatically injects CRON_SECRET and sends it as a Bearer token
 * on cron-triggered requests, so this checks it to stop randoms from
 * hitting the URL and spamming notifications.
 */
const { deadlineSweep } = require('../../server/app');

module.exports = async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers['authorization'];
  if (expected && auth !== `Bearer ${expected}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    await deadlineSweep();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Cron deadline sweep failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Sweep failed' }));
  }
};
