'use strict';
const { db } = require('../lib/db');
const { sendJSON } = require('../lib/http');
const { requireAuth, notify } = require('../lib/middleware');

function register(router) {
  router.get('/api/dashboard', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;

    if (user.role === 'ADMIN') {
      const totalUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
      const totalProjects = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
      const activeProjects = db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'ACTIVE'").get().c;
      const completedProjects = db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'COMPLETED'").get().c;
      const totalTasks = db.prepare('SELECT COUNT(*) c FROM tasks').get().c;
      const completedTasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE status = 'COMPLETED'").get().c;
      const usersByRole = db.prepare('SELECT role, COUNT(*) c FROM users GROUP BY role').all();
      const projectsByStatus = db.prepare('SELECT status, COUNT(*) c FROM projects GROUP BY status').all();
      const recentProjects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 6').all();
      const overdue = db.prepare(`
        SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.due_date IS NOT NULL AND t.due_date < date('now') AND t.status != 'COMPLETED'
        ORDER BY t.due_date ASC LIMIT 10
      `).all();
      return sendJSON(res, 200, {
        role: 'ADMIN',
        stats: { totalUsers, totalProjects, activeProjects, completedProjects, totalTasks, completedTasks },
        usersByRole, projectsByStatus, recentProjects, overdue,
      });
    }

    if (user.role === 'PROJECT_MANAGER') {
      const myProjects = db.prepare('SELECT * FROM projects WHERE manager_id = ? ORDER BY created_at DESC').all(user.id);
      const projectIds = myProjects.map((p) => p.id);
      let tasks = [];
      if (projectIds.length) {
        const placeholders = projectIds.map(() => '?').join(',');
        tasks = db.prepare(`SELECT * FROM tasks WHERE project_id IN (${placeholders})`).all(...projectIds);
      }
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
      const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const review = tasks.filter((t) => t.status === 'REVIEW').length;
      const todo = tasks.filter((t) => t.status === 'TODO').length;
      const upcoming = tasks
        .filter((t) => t.due_date && t.status !== 'COMPLETED')
        .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
        .slice(0, 8)
        .map((t) => ({ ...t, project_name: (myProjects.find((p) => p.id === t.project_id) || {}).name }));
      const teamSize = projectIds.length
        ? db.prepare(`SELECT COUNT(DISTINCT user_id) c FROM project_members WHERE project_id IN (${projectIds.map(() => '?').join(',')})`).get(...projectIds).c
        : 0;
      return sendJSON(res, 200, {
        role: 'PROJECT_MANAGER',
        stats: {
          totalProjects: myProjects.length,
          activeProjects: myProjects.filter((p) => p.status === 'ACTIVE').length,
          totalTasks, completedTasks, inProgress, review, todo, teamSize,
        },
        projects: myProjects,
        upcoming,
      });
    }

    // TEAM_MEMBER
    const myTasks = db.prepare('SELECT * FROM tasks WHERE assignee_id = ?').all(user.id);
    const myProjects = db.prepare(`
      SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id = p.id WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
    `).all(user.id);
    const totalTasks = myTasks.length;
    const completedTasks = myTasks.filter((t) => t.status === 'COMPLETED').length;
    const pendingTasks = totalTasks - completedTasks;
    const upcoming = myTasks
      .filter((t) => t.due_date && t.status !== 'COMPLETED')
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
      .slice(0, 8)
      .map((t) => {
        const proj = db.prepare('SELECT name FROM projects WHERE id = ?').get(t.project_id);
        return { ...t, project_name: proj ? proj.name : '' };
      });
    return sendJSON(res, 200, {
      role: 'TEAM_MEMBER',
      stats: { totalTasks, completedTasks, pendingTasks, totalProjects: myProjects.length },
      projects: myProjects,
      upcoming,
    });
  });
}

/** Sweep for tasks due within 48h and notify assignees once per day (dedup via message check). */
function deadlineSweep() {
  try {
    const soon = db.prepare(`
      SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id = t.project_id
      WHERE t.assignee_id IS NOT NULL AND t.status != 'COMPLETED'
      AND t.due_date IS NOT NULL
      AND date(t.due_date) <= date('now', '+2 day') AND date(t.due_date) >= date('now')
    `).all();
    for (const t of soon) {
      const already = db.prepare(`
        SELECT id FROM notifications WHERE user_id = ? AND type = 'DEADLINE_APPROACHING'
        AND message LIKE ? AND date(created_at) = date('now')
      `).get(t.assignee_id, `%"${t.title}"%`);
      if (!already) {
        notify(t.assignee_id, 'DEADLINE_APPROACHING', `Task "${t.title}" in "${t.project_name}" is due soon (${t.due_date}).`, `#/projects/${t.project_id}?task=${t.id}`);
      }
    }
  } catch (e) {
    console.error('Deadline sweep failed:', e.message);
  }
}

module.exports = { register, deadlineSweep };
