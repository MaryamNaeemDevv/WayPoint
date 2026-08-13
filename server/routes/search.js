'use strict';
const { db } = require('../lib/db');
const { sendJSON } = require('../lib/http');
const { requireAuth } = require('../lib/middleware');

const RESULT_LIMIT = 6;

function register(router) {
  router.get('/api/search', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const url = new URL(req.url, 'http://localhost');
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return sendJSON(res, 200, { projects: [], tasks: [], users: [] });
    const like = `%${q.toLowerCase()}%`;

    // Projects — scoped the same way as GET /api/projects
    let projectRows;
    if (user.role === 'ADMIN') {
      projectRows = await db.prepare(`
        SELECT * FROM projects WHERE lower(name) LIKE ? OR lower(description) LIKE ?
        ORDER BY created_at DESC LIMIT ?
      `).all(like, like, RESULT_LIMIT);
    } else if (user.role === 'PROJECT_MANAGER') {
      projectRows = await db.prepare(`
        SELECT * FROM projects WHERE manager_id = ? AND (lower(name) LIKE ? OR lower(description) LIKE ?)
        ORDER BY created_at DESC LIMIT ?
      `).all(user.id, like, like, RESULT_LIMIT);
    } else {
      projectRows = await db.prepare(`
        SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ? AND (lower(p.name) LIKE ? OR lower(p.description) LIKE ?)
        ORDER BY p.created_at DESC LIMIT ?
      `).all(user.id, like, like, RESULT_LIMIT);
    }

    // Tasks — scoped the same way as GET /api/tasks
    let taskRows;
    if (user.role === 'ADMIN') {
      taskRows = await db.prepare(`
        SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE lower(t.title) LIKE ? ORDER BY t.created_at DESC LIMIT ?
      `).all(like, RESULT_LIMIT);
    } else if (user.role === 'PROJECT_MANAGER') {
      taskRows = await db.prepare(`
        SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE p.manager_id = ? AND lower(t.title) LIKE ? ORDER BY t.created_at DESC LIMIT ?
      `).all(user.id, like, RESULT_LIMIT);
    } else {
      taskRows = await db.prepare(`
        SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.assignee_id = ? AND lower(t.title) LIKE ? ORDER BY t.created_at DESC LIMIT ?
      `).all(user.id, like, RESULT_LIMIT);
    }

    // Users — only surfaced for admins, since the Users page (and per-user profile view) is admin-only.
    let userRows = [];
    if (user.role === 'ADMIN') {
      userRows = await db.prepare(`
        SELECT id, name, email, role, avatar_color, title FROM users
        WHERE lower(name) LIKE ? OR lower(email) LIKE ? ORDER BY name ASC LIMIT ?
      `).all(like, like, RESULT_LIMIT);
    }

    sendJSON(res, 200, {
      projects: projectRows.map((p) => ({ id: p.id, name: p.name, status: p.status, priority: p.priority })),
      tasks: taskRows.map((t) => ({ id: t.id, title: t.title, project_id: t.project_id, project_name: t.project_name, status: t.status, priority: t.priority })),
      users: userRows,
    });
  });
}

module.exports = { register };
