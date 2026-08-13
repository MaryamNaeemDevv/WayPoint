'use strict';
const { db } = require('../lib/db');
const { hashPassword, verifyPassword, sign } = require('../lib/auth');
const { sendJSON, readBody } = require('../lib/http');
const { requireAuth } = require('../lib/middleware');

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#22c55e'];
function pickColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

function setAuthCookie(res, token) {
  const maxAge = 60 * 60 * 24 * 7;
  res.setHeader('Set-Cookie', `taskflow_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function register(router) {
  // Public self-registration always creates TEAM_MEMBER accounts.
  // Admin/PM accounts are provisioned by an Administrator via the Users API.
  router.post('/api/auth/register', async (req, res) => {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!name || !email || !password) {
      return sendJSON(res, 400, { error: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return sendJSON(res, 400, { error: 'Password must be at least 6 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJSON(res, 400, { error: 'Please enter a valid email address.' });
    }
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return sendJSON(res, 409, { error: 'An account with this email already exists.' });

    const hash = hashPassword(password);
    const info = await db.prepare(
      'INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hash, 'TEAM_MEMBER', pickColor());

    const user = await db.prepare('SELECT id, name, email, role, avatar_color, title FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = sign({ id: user.id, role: user.role, name: user.name, email: user.email });
    setAuthCookie(res, token);
    sendJSON(res, 201, { user });
  });

  router.post('/api/auth/login', async (req, res) => {
    const body = await readBody(req);
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!email || !password) return sendJSON(res, 400, { error: 'Email and password are required.' });

    const row = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return sendJSON(res, 401, { error: 'Invalid email or password.' });
    }
    if (row.status !== 'ACTIVE') {
      return sendJSON(res, 403, { error: 'Your account has been suspended. Contact an administrator.' });
    }
    const token = sign({ id: row.id, role: row.role, name: row.name, email: row.email });
    setAuthCookie(res, token);
    const { password_hash, ...user } = row;
    sendJSON(res, 200, { user });
  });

  router.post('/api/auth/logout', async (req, res) => {
    res.setHeader('Set-Cookie', 'taskflow_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    sendJSON(res, 200, { ok: true });
  });

  router.get('/api/auth/me', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    sendJSON(res, 200, { user });
  });
}

module.exports = { register };
