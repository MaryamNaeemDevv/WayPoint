// Vercel serverless entry point (ESM required for non-framework "Other"
// projects — Vercel only builds .mjs, or .js with "type":"module" in
// package.json, as Functions). Everything it calls into (server/app.js,
// server/lib/*) stays plain CommonJS/untouched; Node lets an .mjs file
// import a CommonJS module directly.
import httpLib from '../server/lib/http.js';
import appLib from '../server/app.js';

const { sendJSON } = httpLib;
const { getRouter } = appLib;

export default async function handler(req, res) {
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
}
