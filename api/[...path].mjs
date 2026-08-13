// Vercel serverless entry point (ESM required for non-framework "Other"
// projects). Imports are done dynamically inside the try/catch below so
// that ANY failure -- including a bundling/module-resolution problem --
// gets caught and returned as JSON instead of crashing the function with
// no visible log. Once things are confirmed working, the `debug` field
// can be removed.
export default async function handler(req, res) {
  try {
    const { sendJSON } = await import('../server/lib/http.js');
    const { getRouter } = await import('../server/app.js');
    const router = await getRouter();
    const url = new URL(req.url, 'http://localhost');
    const handled = await router.handle(req, res, url.pathname);
    if (!handled && !res.writableEnded) {
      sendJSON(res, 404, { error: 'API endpoint not found.' });
    }
  } catch (err) {
    console.error('Unhandled error in /api function:', err);
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal server error',
        debug: err && err.message,
        stack: err && err.stack,
      }));
    }
  }
}
