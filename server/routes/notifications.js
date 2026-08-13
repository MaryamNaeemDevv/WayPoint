'use strict';
const { db } = require('../lib/db');
const { sendJSON } = require('../lib/http');
const { requireAuth } = require('../lib/middleware');

function register(router) {
  router.get('/api/notifications', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(user.id);
    const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(user.id).c;
    sendJSON(res, 200, { notifications: rows, unread });
  });

  router.put('/api/notifications/:id/read', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(req.params.id));
    if (!row || row.user_id !== user.id) return sendJSON(res, 404, { error: 'Notification not found.' });
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(row.id);
    sendJSON(res, 200, { ok: true });
  });

  router.put('/api/notifications/read-all', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(user.id);
    sendJSON(res, 200, { ok: true });
  });
}

module.exports = { register };
