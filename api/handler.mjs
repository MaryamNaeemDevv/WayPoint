// Vercel serverless entry point. Reached via the rewrite rule in
// vercel.json ("/api/:path*" -> "/api/handler"), NOT via filename-based
// dynamic routing -- Vercel's plain (non-Next.js) file-system routing
// does not reliably support the "[...param]" catch-all convention the
// way Next.js does, so we use an explicit rewrite instead. Vercel
// preserves the original request URL on a rewrite, so req.url here is
// still e.g. "/api/auth/login", not "/api/handler".
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
