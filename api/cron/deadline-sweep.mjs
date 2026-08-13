// Same ESM requirement as the catch-all function — see [...path].mjs.
import appLib from '../../server/app.js';

const { deadlineSweep } = appLib;

export default async function handler(req, res) {
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
}
