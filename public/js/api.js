'use strict';
const API = {
  async _req(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this._req('GET', url); },
  post(url, body) { return this._req('POST', url, body); },
  put(url, body) { return this._req('PUT', url, body); },
  delete(url) { return this._req('DELETE', url); },

  // Auth
  login(email, password) { return this.post('/api/auth/login', { email, password }); },
  register(name, email, password) { return this.post('/api/auth/register', { name, email, password }); },
  logout() { return this.post('/api/auth/logout'); },
  me() { return this.get('/api/auth/me'); },

  // Dashboard
  dashboard() { return this.get('/api/dashboard'); },

  // Users
  users() { return this.get('/api/users'); },
  createUser(payload) { return this.post('/api/users', payload); },
  updateUser(id, payload) { return this.put(`/api/users/${id}`, payload); },
  deleteUser(id) { return this.delete(`/api/users/${id}`); },

  // Projects
  projects() { return this.get('/api/projects'); },
  project(id) { return this.get(`/api/projects/${id}`); },
  createProject(payload) { return this.post('/api/projects', payload); },
  updateProject(id, payload) { return this.put(`/api/projects/${id}`, payload); },
  deleteProject(id) { return this.delete(`/api/projects/${id}`); },
  addMember(projectId, userId) { return this.post(`/api/projects/${projectId}/members`, { userId }); },
  removeMember(projectId, userId) { return this.delete(`/api/projects/${projectId}/members/${userId}`); },

  // Tasks
  tasks(query) { return this.get(`/api/tasks${query ? '?' + query : ''}`); },
  task(id) { return this.get(`/api/tasks/${id}`); },
  createTask(payload) { return this.post('/api/tasks', payload); },
  updateTask(id, payload) { return this.put(`/api/tasks/${id}`, payload); },
  deleteTask(id) { return this.delete(`/api/tasks/${id}`); },
  addComment(taskId, body) { return this.post(`/api/tasks/${taskId}/comments`, { body }); },

  // Attachments
  attachments(taskId) { return this.get(`/api/tasks/${taskId}/attachments`); },
  uploadAttachment(taskId, payload) { return this.post(`/api/tasks/${taskId}/attachments`, payload); },
  deleteAttachment(taskId, attachmentId) { return this.delete(`/api/tasks/${taskId}/attachments/${attachmentId}`); },
  attachmentDownloadUrl(taskId, attachmentId) { return `/api/tasks/${taskId}/attachments/${attachmentId}/download`; },

  // Reports
  reports() { return this.get('/api/reports'); },

  // Search
  search(q) { return this.get(`/api/search?q=${encodeURIComponent(q)}`); },

  // Notifications
  notifications() { return this.get('/api/notifications'); },
  markRead(id) { return this.put(`/api/notifications/${id}/read`); },
  markAllRead() { return this.put('/api/notifications/read-all'); },
};
