'use strict';
const { getUserFromReq } = require('./auth');
const { sendJSON, HttpError } = require('./http');
const { db } = require('./db');

async function requireAuth(req, res) {
  const user = getUserFromReq(req);
  if (!user) {
    sendJSON(res, 401, { error: 'Not authenticated. Please log in.' });
    return null;
  }
  // Confirm user still exists & is active (handles deleted/suspended users with stale tokens)
  const row = await db.prepare('SELECT id, name, email, role, status, avatar_color, title FROM users WHERE id = ?').get(user.id);
  if (!row || row.status !== 'ACTIVE') {
    sendJSON(res, 401, { error: 'Account not available. Please log in again.' });
    return null;
  }
  req.user = row;
  return row;
}

async function requireRole(req, res, roles) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    sendJSON(res, 403, { error: 'You do not have permission to perform this action.' });
    return null;
  }
  return user;
}

async function notify(userId, type, message, link = '') {
  try {
    await db.prepare(
      'INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)'
    ).run(userId, type, message, link);
  } catch (err) {
    console.error('notify() failed:', err);
  }
}

async function logActivity(projectId, userId, message) {
  try {
    await db.prepare(
      'INSERT INTO activity_log (project_id, user_id, message) VALUES (?, ?, ?)'
    ).run(projectId, userId, message);
  } catch (err) {
    console.error('logActivity() failed:', err);
  }
}

module.exports = { requireAuth, requireRole, notify, logActivity };
