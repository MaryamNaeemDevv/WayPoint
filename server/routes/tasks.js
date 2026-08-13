'use strict';
const { db } = require('../lib/db');
const { sendJSON, readBody } = require('../lib/http');
const { requireAuth, notify, logActivity } = require('../lib/middleware');
const { canAccessProject } = require('./projects');

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // ~4MB decoded file size

async function taskWithMeta(row) {
  const assignee = row.assignee_id ? await db.prepare('SELECT id, name, avatar_color, email FROM users WHERE id = ?').get(row.assignee_id) : null;
  const commentCount = Number((await db.prepare('SELECT COUNT(*) as c FROM task_comments WHERE task_id = ?').get(row.id)).c);
  const attachmentCount = Number((await db.prepare('SELECT COUNT(*) as c FROM task_attachments WHERE task_id = ?').get(row.id)).c);
  return { ...row, assignee, commentCount, attachmentCount };
}

async function attachmentMeta(row) {
  const uploader = row.uploaded_by ? await db.prepare('SELECT id, name, avatar_color FROM users WHERE id = ?').get(row.uploaded_by) : null;
  return { id: row.id, task_id: row.task_id, filename: row.filename, mime_type: row.mime_type, size: row.size, created_at: row.created_at, uploader };
}

function isProjectPM(user, project) {
  return user.role === 'ADMIN' || (user.role === 'PROJECT_MANAGER' && project.manager_id === user.id);
}

function register(router) {
  // List tasks for a project (all roles with access), or list "my tasks" across projects
  router.get('/api/tasks', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const url = new URL(req.url, 'http://localhost');
    const projectId = url.searchParams.get('projectId');
    const mine = url.searchParams.get('mine');

    let rows;
    if (projectId) {
      const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(projectId));
      if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
      if (!(await canAccessProject(user, project))) return sendJSON(res, 403, { error: 'You do not have access to this project.' });
      rows = await db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(Number(projectId));
    } else if (mine) {
      rows = await db.prepare('SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_date IS NULL, due_date ASC').all(user.id);
    } else if (user.role === 'ADMIN') {
      rows = await db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    } else if (user.role === 'PROJECT_MANAGER') {
      rows = await db.prepare(`
        SELECT t.* FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE p.manager_id = ? ORDER BY t.created_at DESC
      `).all(user.id);
    } else {
      rows = await db.prepare('SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_date IS NULL, due_date ASC').all(user.id);
    }
    sendJSON(res, 200, { tasks: await Promise.all(rows.map(taskWithMeta)) });
  });

  // Create task — Admin or owning PM only
  router.post('/api/tasks', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const body = await readBody(req);
    const projectId = Number(body.projectId);
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return sendJSON(res, 404, { error: 'Project not found.' });
    if (!isProjectPM(user, project)) return sendJSON(res, 403, { error: 'Only the project\'s manager or an administrator can create tasks.' });

    const title = (body.title || '').trim();
    if (!title) return sendJSON(res, 400, { error: 'Task title is required.' });
    const priority = body.priority || 'MEDIUM';
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority)) return sendJSON(res, 400, { error: 'Invalid priority.' });

    let assigneeId = body.assigneeId ? Number(body.assigneeId) : null;
    if (assigneeId) {
      const member = await db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, assigneeId);
      if (!member) return sendJSON(res, 400, { error: 'Assignee must be a member of this project.' });
    }

    const info = await db.prepare(`
      INSERT INTO tasks (project_id, title, description, assignee_id, priority, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, title, body.description || '', assigneeId, priority, body.dueDate || null, user.id);

    if (assigneeId) {
      notify(assigneeId, 'TASK_ASSIGNED', `You were assigned a new task: "${title}".`, `#/projects/${projectId}?task=${info.lastInsertRowid}`);
    }
    logActivity(projectId, user.id, `Task "${title}" created.`);
    const created = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
    sendJSON(res, 201, { task: await taskWithMeta(created) });
  });

  // Get single task with comments
  router.get('/api/tasks/:id', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    if (!(await canAccessProject(user, project))) return sendJSON(res, 403, { error: 'You do not have access to this task.' });
    const comments = await db.prepare(`
      SELECT c.*, u.name as user_name, u.avatar_color as user_color, u.role as user_role
      FROM task_comments c JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ? ORDER BY c.created_at ASC
    `).all(task.id);
    const attachmentRows = await db.prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC').all(task.id);
    const attachments = await Promise.all(attachmentRows.map(attachmentMeta));
    sendJSON(res, 200, { task: await taskWithMeta(task), comments, attachments, project: { id: project.id, name: project.name } });
  });

  // Update task — PM/Admin can edit everything; assignee (team member) can only update status
  router.put('/api/tasks/:id', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    const managerLevel = isProjectPM(user, project);
    const isAssignee = task.assignee_id === user.id;
    if (!managerLevel && !isAssignee) return sendJSON(res, 403, { error: 'You do not have permission to edit this task.' });

    const body = await readBody(req);
    const fields = [];
    const values = [];
    const validStatus = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

    if (!managerLevel) {
      // Team member: status only
      if (body.status === undefined) return sendJSON(res, 400, { error: 'You can only update the task status.' });
      if (!validStatus.includes(body.status)) return sendJSON(res, 400, { error: 'Invalid status.' });
      fields.push('status = ?'); values.push(body.status);
    } else {
      if (body.title !== undefined) { fields.push('title = ?'); values.push(String(body.title).trim()); }
      if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
      if (body.priority !== undefined) {
        if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body.priority)) return sendJSON(res, 400, { error: 'Invalid priority.' });
        fields.push('priority = ?'); values.push(body.priority);
      }
      if (body.dueDate !== undefined) { fields.push('due_date = ?'); values.push(body.dueDate); }
      if (body.status !== undefined) {
        if (!validStatus.includes(body.status)) return sendJSON(res, 400, { error: 'Invalid status.' });
        fields.push('status = ?'); values.push(body.status);
      }
      if (body.assigneeId !== undefined) {
        const assigneeId = body.assigneeId ? Number(body.assigneeId) : null;
        if (assigneeId) {
          const member = await db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, assigneeId);
          if (!member) return sendJSON(res, 400, { error: 'Assignee must be a member of this project.' });
        }
        fields.push('assignee_id = ?'); values.push(assigneeId);
        if (assigneeId && assigneeId !== task.assignee_id) {
          notify(assigneeId, 'TASK_ASSIGNED', `You were assigned a task: "${task.title}".`, `#/projects/${task.project_id}?task=${task.id}`);
        }
      }
    }
    if (fields.length === 0) return sendJSON(res, 400, { error: 'No changes provided.' });
    fields.push('updated_at = NOW()');
    values.push(task.id);
    await db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    if (body.status !== undefined) {
      logActivity(task.project_id, user.id, `Task "${task.title}" status changed to ${body.status.replace('_', ' ')}.`);
      // notify manager when status changes (and it wasn't the manager who changed it)
      if (project.manager_id && project.manager_id !== user.id) {
        notify(project.manager_id, 'TASK_STATUS_CHANGED', `"${task.title}" status changed to ${body.status.replace('_', ' ')}.`, `#/projects/${task.project_id}?task=${task.id}`);
      }
    }
    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
    sendJSON(res, 200, { task: await taskWithMeta(updated) });
  });

  // Delete task — PM/Admin only
  router.delete('/api/tasks/:id', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    if (!isProjectPM(user, project)) return sendJSON(res, 403, { error: 'You do not have permission to delete this task.' });
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    logActivity(task.project_id, user.id, `Task "${task.title}" deleted.`);
    sendJSON(res, 200, { ok: true });
  });

  // Task discussion — add comment
  router.post('/api/tasks/:id/comments', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    if (!(await canAccessProject(user, project))) return sendJSON(res, 403, { error: 'You do not have access to this task.' });

    const body = await readBody(req);
    const text = (body.body || '').trim();
    if (!text) return sendJSON(res, 400, { error: 'Comment cannot be empty.' });
    const info = await db.prepare('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)').run(task.id, user.id, text);

    // Notify other participants: assignee + PM (excluding the commenter)
    const notifyTargets = new Set();
    if (task.assignee_id) notifyTargets.add(task.assignee_id);
    if (project.manager_id) notifyTargets.add(project.manager_id);
    notifyTargets.delete(user.id);
    for (const uid of notifyTargets) {
      notify(uid, 'NEW_DISCUSSION', `${user.name} commented on task "${task.title}".`, `#/projects/${task.project_id}?task=${task.id}`);
    }
    const created = await db.prepare(`
      SELECT c.*, u.name as user_name, u.avatar_color as user_color, u.role as user_role
      FROM task_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
    `).get(info.lastInsertRowid);
    sendJSON(res, 201, { comment: created });
  });

  // Upload a file attachment — any user with access to the task's project (JSON body, base64-encoded)
  router.post('/api/tasks/:id/attachments', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    if (!(await canAccessProject(user, project))) return sendJSON(res, 403, { error: 'You do not have access to this task.' });

    const body = await readBody(req);
    const filename = (body.filename || '').trim().slice(0, 255);
    const mimeType = (body.mimeType || 'application/octet-stream').slice(0, 100);
    const dataBase64 = body.dataBase64 || '';
    if (!filename) return sendJSON(res, 400, { error: 'A filename is required.' });
    if (!dataBase64) return sendJSON(res, 400, { error: 'No file data was received.' });

    let buf;
    try {
      buf = Buffer.from(dataBase64, 'base64');
    } catch (e) {
      return sendJSON(res, 400, { error: 'Could not read the uploaded file.' });
    }
    if (buf.length === 0) return sendJSON(res, 400, { error: 'The uploaded file is empty.' });
    if (buf.length > MAX_ATTACHMENT_BYTES) {
      return sendJSON(res, 400, { error: `Attachments are limited to ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB.` });
    }

    const info = await db.prepare(`
      INSERT INTO task_attachments (task_id, filename, mime_type, size, data, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(task.id, filename, mimeType, buf.length, dataBase64, user.id);

    logActivity(task.project_id, user.id, `${user.name} attached "${filename}" to task "${task.title}".`);
    const created = await db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(info.lastInsertRowid);
    sendJSON(res, 201, { attachment: await attachmentMeta(created) });
  });

  // List attachments for a task
  router.get('/api/tasks/:id/attachments', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    if (!(await canAccessProject(user, project))) return sendJSON(res, 403, { error: 'You do not have access to this task.' });
    const rows = await db.prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC').all(task.id);
    const attachments = await Promise.all(rows.map(attachmentMeta));
    sendJSON(res, 200, { attachments });
  });

  // Download an attachment's raw bytes
  router.get('/api/tasks/:id/attachments/:attachmentId/download', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    if (!(await canAccessProject(user, project))) return sendJSON(res, 403, { error: 'You do not have access to this task.' });
    const att = await db.prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?').get(Number(req.params.attachmentId), task.id);
    if (!att) return sendJSON(res, 404, { error: 'Attachment not found.' });

    const buf = Buffer.from(att.data, 'base64');
    res.writeHead(200, {
      'Content-Type': att.mime_type || 'application/octet-stream',
      'Content-Length': buf.length,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename)}"`,
      'Cache-Control': 'private, max-age=0, no-cache',
    });
    res.end(buf);
  });

  // Delete an attachment — uploader or project manager/admin
  router.delete('/api/tasks/:id/attachments/:attachmentId', async (req, res) => {
    const user = await requireAuth(req, res);
    if (!user) return;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
    if (!task) return sendJSON(res, 404, { error: 'Task not found.' });
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(task.project_id);
    const att = await db.prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?').get(Number(req.params.attachmentId), task.id);
    if (!att) return sendJSON(res, 404, { error: 'Attachment not found.' });
    const canManage = isProjectPM(user, project) || att.uploaded_by === user.id;
    if (!canManage) return sendJSON(res, 403, { error: 'You do not have permission to remove this attachment.' });

    await db.prepare('DELETE FROM task_attachments WHERE id = ?').run(att.id);
    logActivity(task.project_id, user.id, `${user.name} removed attachment "${att.filename}" from task "${task.title}".`);
    sendJSON(res, 200, { ok: true });
  });
}

module.exports = { register };
