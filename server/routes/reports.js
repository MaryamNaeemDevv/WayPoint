'use strict';
const { db } = require('../lib/db');
const { sendJSON } = require('../lib/http');
const { requireAuth } = require('../lib/middleware');

const BURNDOWN_DAYS = 30;

function register(router) {
  router.get('/api/reports', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!['ADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
      return sendJSON(res, 403, { error: 'Reports are available to administrators and project managers.' });
    }

    let projects;
    if (user.role === 'ADMIN') {
      projects = db.prepare('SELECT * FROM projects').all();
    } else {
      projects = db.prepare('SELECT * FROM projects WHERE manager_id = ?').all(user.id);
    }
    const projectIds = projects.map((p) => p.id);
    const projectMap = {};
    projects.forEach((p) => { projectMap[p.id] = p; });

    if (projectIds.length === 0) {
      return sendJSON(res, 200, {
        totals: { totalProjects: 0, totalTasks: 0, completedTasks: 0, completionRate: 0, overdueTasks: 0 },
        burndown: [],
        workload: [],
        unassignedCount: 0,
        byPriority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => ({ priority: p, count: 0 })),
        byStatus: ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((s) => ({ status: s, count: 0 })),
        projects: [],
      });
    }

    const placeholders = projectIds.map(() => '?').join(',');
    const tasks = db.prepare(`SELECT * FROM tasks WHERE project_id IN (${placeholders})`).all(...projectIds);

    // Burndown: cumulative tasks completed per day over the trailing window, vs. total scope.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = BURNDOWN_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const completedByDay = {};
    tasks.forEach((t) => {
      if (t.status === 'COMPLETED' && t.updated_at) {
        const day = t.updated_at.slice(0, 10);
        completedByDay[day] = (completedByDay[day] || 0) + 1;
      }
    });
    const totalTasks = tasks.length;
    let cumulative = 0;
    // Count completions that happened before the window starts, so the window's starting "remaining" is accurate.
    const beforeWindow = tasks.filter((t) => t.status === 'COMPLETED' && t.updated_at && t.updated_at.slice(0, 10) < days[0]).length;
    cumulative = beforeWindow;
    const burndown = days.map((day) => {
      cumulative += completedByDay[day] || 0;
      return { date: day, completed: cumulative, remaining: Math.max(totalTasks - cumulative, 0) };
    });

    // Workload: per-assignee breakdown by status, scoped to this manager's/admin's projects
    const assigneeIds = [...new Set(tasks.filter((t) => t.assignee_id).map((t) => t.assignee_id))];
    let workload = assigneeIds.map((id) => {
      const u = db.prepare('SELECT id, name, avatar_color, title FROM users WHERE id = ?').get(id);
      const own = tasks.filter((t) => t.assignee_id === id);
      return {
        user: u,
        total: own.length,
        todo: own.filter((t) => t.status === 'TODO').length,
        inProgress: own.filter((t) => t.status === 'IN_PROGRESS').length,
        review: own.filter((t) => t.status === 'REVIEW').length,
        completed: own.filter((t) => t.status === 'COMPLETED').length,
        overdue: own.filter((t) => t.due_date && t.due_date < today.toISOString().slice(0, 10) && t.status !== 'COMPLETED').length,
      };
    }).filter((w) => w.user);
    workload.sort((a, b) => b.total - a.total);

    const unassignedCount = tasks.filter((t) => !t.assignee_id).length;
    const byPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => ({ priority: p, count: tasks.filter((t) => t.priority === p).length }));
    const byStatus = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((s) => ({ status: s, count: tasks.filter((t) => t.status === s).length }));
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < today.toISOString().slice(0, 10) && t.status !== 'COMPLETED').length;

    sendJSON(res, 200, {
      totals: {
        totalProjects: projects.length,
        totalTasks,
        completedTasks,
        completionRate: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
        overdueTasks,
      },
      burndown,
      workload,
      unassignedCount,
      byPriority,
      byStatus,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  });
}

module.exports = { register };
