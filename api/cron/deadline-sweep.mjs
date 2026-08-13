export default async function handler(req, res) {
  try {
    const { deadlineSweep } = await import('../../server/app.js');
    const expected = process.env.CRON_SECRET;
    const auth = req.headers['authorization'];
    if (expected && auth !== `Bearer ${expected}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    await deadlineSweep();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Cron deadline sweep failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Sweep failed',
      debug: err && err.message,
      stack: err && err.stack,
    }));
  }
}
