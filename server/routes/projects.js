'use strict';
const { db } = require('../lib/db');
const { sendJSON, readBody } = require('../lib/http');
const { requireAuth, requireRole, notify, logActivity } = require('../lib/middleware');

function projectWithMeta(row, currentUserId) {
  const manager = row.manager_id ? db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?').get(row.manager_id) : null;
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color, u.title FROM project_members pm
    JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.name ASC
  `).all(row.id);
  const taskStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status
  `).all(row.id);
  const totalTasks = taskStats.reduce((s, t) => s + t.count, 0);
  const completed = (taskStats.find((t) => t.status === 'COMPLETED') || {}).count || 0;
  const progress = totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100);
  return {
    ...row,
    manager,
    members,
    taskStats,
    totalTasks,
    progress,
  };
}

function canAccessProject(user, project) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'PROJECT_MANAGER') return project.manager_id === user.id;
  // team member: must be a project member
  const row = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(project.id, user.id);
  return !!row;
}

function register(router) {
  // List projects — scoped by role
  router.get('/api/projects', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    let rows;
    if (user.role === 'ADMIN') {
      rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    } else if (user.role === 'PROJECT_MANAGER') {
      rows = db.prepare('SELECT * FROM projects WHERE manager_id = ? ORDER BY created_at DESC').all(user.id);
    } else {
      rows = db.prepare(`
        SELECT p.* FROM projects p
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ? ORDER BY p.created_at DESC
      `).all(user.id);
    }
    const enriched = rows.map((r) => projectWithMeta(r, user.id));
    sendJSON(res, 200, { projects: enriched });
  });

  // Admin creates a project
  router.post('/api/projects', async (req, res) => {
    const admin = requireRole(req, res, ['ADMIN']);
    if (!admin) return;
    const body = await readBody(req);
    const name = (body.name || '').trim();
    if (!name) return sendJSON(res, 400, { error: 'Project name is required.' });
    const priority = body.priority || 'MEDIUM';
    const status = body.status || 'PLANNING';
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) return sendJSON(res, 400, { error: 'Invalid priority.' });
    let managerId = body.managerId ? Number(body.managerId) : null;
    if (managerId) {
      const mgr = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'PROJECT_MANAGER' AND status = 'ACTIVE'").get(managerId);
      if (!mgr) return sendJSON(res, 400, { error: 'Selected manager is not a valid active Project Manager.' });
    }
    const info = db.prepare(`
      INSERT INTO projects (name, description, start_date, end_date, priority, status, manager_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, body.description || '', body.startDate || null, body.endDate || null, priority, status, managerId, admin.id);

    if (managerId) {
      notify(managerId, 'PROJECT_ASSIGNED', `You were assigned as Project Manager for "${name}".`, `#/projects/${info.lastInsertRowid}`);
    }
    logActivity(info.lastInsertRowid, admin.id, `Project "${name}" created.`);
    const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);
    sendJSON(res, 201, { project: projectWithMeta(created, admin.id) });
  });

  // Get single project (workspace)
  router.get('/api/projects/:id', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id));
    if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
    if (!canAccessProject(user, project)) return sendJSON(res, 403, { error: 'You do not have access to this project.' });
    const activity = db.prepare(`
      SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.project_id = ? ORDER BY a.created_at DESC LIMIT 30
    `).all(project.id);
    sendJSON(res, 200, { project: projectWithMeta(project, user.id), activity });
  });

  // Update project — Admin: everything. PM (own project): description/dates/status/priority (not manager reassignment).
  router.put('/api/projects/:id', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id));
    if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
    const isAdmin = user.role === 'ADMIN';
    const isOwnerPM = user.role === 'PROJECT_MANAGER' && project.manager_id === user.id;
    if (!isAdmin && !isOwnerPM) return sendJSON(res, 403, { error: 'You do not have permission to edit this project.' });

    const body = await readBody(req);
    const fields = [];
    const values = [];
    const allowed = isAdmin
      ? ['name', 'description', 'start_date::startDate', 'end_date::endDate', 'priority', 'status', 'manager_id::managerId']
      : ['description', 'start_date::startDate', 'end_date::endDate', 'priority', 'status'];

    for (const spec of allowed) {
      const [col, key] = spec.includes('::') ? spec.split('::') : [spec, spec];
      if (body[key] !== undefined) {
        if (col === 'priority' && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body[key])) {
          return sendJSON(res, 400, { error: 'Invalid priority.' });
        }
        if (col === 'status' && !['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].includes(body[key])) {
          return sendJSON(res, 400, { error: 'Invalid status.' });
        }
        if (col === 'manager_id') {
          const mid = body[key] ? Number(body[key]) : null;
          if (mid) {
            const mgr = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'PROJECT_MANAGER' AND status='ACTIVE'").get(mid);
            if (!mgr) return sendJSON(res, 400, { error: 'Selected manager is not a valid active Project Manager.' });
          }
          fields.push('manager_id = ?'); values.push(mid);
          if (mid && mid !== project.manager_id) {
            notify(mid, 'PROJECT_ASSIGNED', `You were assigned as Project Manager for "${project.name}".`, `#/projects/${project.id}`);
          }
          continue;
        }
        fields.push(`${col} = ?`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return sendJSON(res, 400, { error: 'No changes provided.' });
    fields.push("updated_at = datetime('now')");
    values.push(project.id);
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    logActivity(project.id, user.id, `Project details updated.`);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
    sendJSON(res, 200, { project: projectWithMeta(updated, user.id) });
  });

  // Admin deletes project
  router.delete('/api/projects/:id', async (req, res) => {
    const admin = requireRole(req, res, ['ADMIN']);
    if (!admin) return;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id));
    if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    sendJSON(res, 200, { ok: true });
  });

  // PM adds a team member to their project
  router.post('/api/projects/:id/members', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id));
    if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
    const isAdmin = user.role === 'ADMIN';
    const isOwnerPM = user.role === 'PROJECT_MANAGER' && project.manager_id === user.id;
    if (!isAdmin && !isOwnerPM) return sendJSON(res, 403, { error: 'You do not have permission to manage this project team.' });

    const body = await readBody(req);
    const userId = Number(body.userId);
    const member = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'TEAM_MEMBER' AND status = 'ACTIVE'").get(userId);
    if (!member) return sendJSON(res, 400, { error: 'Selected user is not a valid active Team Member.' });
    const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(project.id, userId);
    if (existing) return sendJSON(res, 409, { error: 'This user is already on the project team.' });

    db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)').run(project.id, userId);
    notify(userId, 'ADDED_TO_PROJECT', `You were added to the project "${project.name}".`, `#/projects/${project.id}`);
    logActivity(project.id, user.id, `${member.name} added to the project team.`);
    sendJSON(res, 201, { ok: true });
  });

  // PM removes a team member
  router.delete('/api/projects/:id/members/:userId', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(req.params.id));
    if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
    const isAdmin = user.role === 'ADMIN';
    const isOwnerPM = user.role === 'PROJECT_MANAGER' && project.manager_id === user.id;
    if (!isAdmin && !isOwnerPM) return sendJSON(res, 403, { error: 'You do not have permission to manage this project team.' });

    const userId = Number(req.params.userId);
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(project.id, userId);
    // Unassign that member's tasks in this project
    db.prepare("UPDATE tasks SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ?").run(project.id, userId);
    logActivity(project.id, user.id, `A team member was removed from the project.`);
    sendJSON(res, 200, { ok: true });
  });
}

module.exports = { register, canAccessProject, projectWithMeta };
