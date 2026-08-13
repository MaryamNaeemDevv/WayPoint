'use strict';
const { db } = require('../lib/db');
const { hashPassword, verifyPassword } = require('../lib/auth');
const { sendJSON, readBody } = require('../lib/http');
const { requireAuth, requireRole } = require('../lib/middleware');

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#22c55e'];
function pickColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }
const SAFE_COLS = 'id, name, email, role, avatar_color, title, status, created_at';

function register(router) {
  // List all users (Admin: everyone. PM: team members + self, for assigning to projects)
  router.get('/api/users', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    let rows;
    if (user.role === 'ADMIN') {
      rows = await db.prepare(`SELECT ${SAFE_COLS} FROM users ORDER BY created_at DESC`).all();
    } else if (user.role === 'PROJECT_MANAGER') {
      rows = await db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE role = 'TEAM_MEMBER' AND status = 'ACTIVE' ORDER BY name ASC`).all();
    } else {
      rows = await db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`).all(user.id);
    }
    sendJSON(res, 200, { users: rows });
  });

  // Admin creates a user with any role
  router.post('/api/users', async (req, res) => {
    const admin = await requireRole(req, res, ['ADMIN']);
    if (!admin) return;
    const body = await readBody(req);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const role = body.role || 'TEAM_MEMBER';
    const title = (body.title || '').trim();
    if (!name || !email || !password) return sendJSON(res, 400, { error: 'Name, email and password are required.' });
    if (password.length < 6) return sendJSON(res, 400, { error: 'Password must be at least 6 characters.' });
    if (!['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'].includes(role)) return sendJSON(res, 400, { error: 'Invalid role.' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return sendJSON(res, 409, { error: 'A user with this email already exists.' });

    const hash = hashPassword(password);
    const info = await db.prepare(
      'INSERT INTO users (name, email, password_hash, role, avatar_color, title) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email, hash, role, pickColor(), title);
    const created = await db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`).get(info.lastInsertRowid);
    sendJSON(res, 201, { user: created });
  });

  // Admin updates any user; users can update their own profile (name/title/password), not role/status
  router.put('/api/users/:id', async (req, res) => {
    const me = await requireAuth(req, res);
    if (!me) return;
    const targetId = Number(req.params.id);
    const isSelf = me.id === targetId;
    if (me.role !== 'ADMIN' && !isSelf) return sendJSON(res, 403, { error: 'You can only edit your own profile.' });

    const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!target) return sendJSON(res, 404, { error: 'User not found.' });

    const body = await readBody(req);
    const fields = [];
    const values = [];

    if (body.name !== undefined) { fields.push('name = ?'); values.push(String(body.name).trim()); }
    if (body.title !== undefined) { fields.push('title = ?'); values.push(String(body.title).trim()); }
    if (body.email !== undefined && me.role === 'ADMIN') {
      const email = String(body.email).trim().toLowerCase();
      const clash = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, targetId);
      if (clash) return sendJSON(res, 409, { error: 'Email already in use by another user.' });
      fields.push('email = ?'); values.push(email);
    }
    if (body.role !== undefined) {
      if (me.role !== 'ADMIN') return sendJSON(res, 403, { error: 'Only an administrator can change roles.' });
      if (!['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'].includes(body.role)) return sendJSON(res, 400, { error: 'Invalid role.' });
      fields.push('role = ?'); values.push(body.role);
    }
    if (body.status !== undefined) {
      if (me.role !== 'ADMIN') return sendJSON(res, 403, { error: 'Only an administrator can change account status.' });
      if (!['ACTIVE', 'SUSPENDED'].includes(body.status)) return sendJSON(res, 400, { error: 'Invalid status.' });
      fields.push('status = ?'); values.push(body.status);
    }
    if (body.password) {
      if (body.password.length < 6) return sendJSON(res, 400, { error: 'Password must be at least 6 characters.' });
      fields.push('password_hash = ?'); values.push(hashPassword(body.password));
    }
    if (fields.length === 0) return sendJSON(res, 400, { error: 'No changes provided.' });

    values.push(targetId);
    await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const updated = await db.prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`).get(targetId);
    sendJSON(res, 200, { user: updated });
  });

  // Admin deletes a user
  router.delete('/api/users/:id', async (req, res) => {
    const admin = await requireRole(req, res, ['ADMIN']);
    if (!admin) return;
    const targetId = Number(req.params.id);
    if (targetId === admin.id) return sendJSON(res, 400, { error: 'You cannot delete your own account.' });
    const target = await db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!target) return sendJSON(res, 404, { error: 'User not found.' });
    await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    sendJSON(res, 200, { ok: true });
  });
}

module.exports = { register };
