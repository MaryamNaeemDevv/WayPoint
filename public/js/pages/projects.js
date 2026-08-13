'use strict';

let _projectsCache = [];
let _pmListCache = [];

async function renderProjectsPage() {
  const isAdmin = Store.user.role === 'ADMIN';
  const actionsHtml = isAdmin ? `<button class="btn btn-primary" id="new-project-btn">${ICONS.plus} New Project</button>` : '';
  document.getElementById('page-content').innerHTML = loadingBlock();
  document.querySelector('.topbar-actions').innerHTML = actionsHtml + document.querySelector('.topbar-actions').innerHTML;

  try {
    const { projects } = await API.projects();
    _projectsCache = projects;
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load projects', e.message);
    return;
  }
  renderProjectsList();

  const newBtn = document.getElementById('new-project-btn');
  if (newBtn) newBtn.onclick = () => openProjectModal();
}

function renderProjectsList() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ICONS.search}<input class="input" id="proj-search" placeholder="Search projects..." /></div>
      <select class="select-sm" id="proj-status-filter">
        <option value="">All statuses</option>
        <option value="PLANNING">Planning</option>
        <option value="ACTIVE">Active</option>
        <option value="ON_HOLD">On Hold</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <select class="select-sm" id="proj-priority-filter">
        <option value="">All priorities</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <select class="select-sm" id="proj-sort">
        <option value="recent">Sort: Most recent</option>
        <option value="name">Sort: Name A–Z</option>
        <option value="progress">Sort: Progress</option>
        <option value="priority">Sort: Priority</option>
      </select>
    </div>
    <div id="projects-grid" class="grid grid-3"></div>
  `;
  const search = document.getElementById('proj-search');
  const statusF = document.getElementById('proj-status-filter');
  const priF = document.getElementById('proj-priority-filter');
  const sortEl = document.getElementById('proj-sort');
  [search, statusF, priF, sortEl].forEach((elm) => elm.addEventListener('input', renderFilteredProjects));
  renderFilteredProjects();
}

const PRI_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function renderFilteredProjects() {
  const q = (document.getElementById('proj-search').value || '').toLowerCase().trim();
  const status = document.getElementById('proj-status-filter').value;
  const pri = document.getElementById('proj-priority-filter').value;
  const sort = document.getElementById('proj-sort').value;

  let list = _projectsCache.filter((p) => {
    if (status && p.status !== status) return false;
    if (pri && p.priority !== pri) return false;
    if (q && !(p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))) return false;
    return true;
  });

  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'progress') list.sort((a, b) => b.progress - a.progress);
  else if (sort === 'priority') list.sort((a, b) => PRI_RANK[b.priority] - PRI_RANK[a.priority]);
  else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const grid = document.getElementById('projects-grid');
  if (list.length === 0) {
    grid.innerHTML = '';
    grid.parentElement.querySelector('#projects-grid').outerHTML = emptyState('projects', 'No projects found', 'Try adjusting your search or filters.');
    return;
  }
  grid.innerHTML = list.map(projectCardHtml).join('');
  grid.querySelectorAll('[data-project-id]').forEach((c) => {
    c.onclick = () => { location.hash = `#/projects/${c.dataset.projectId}`; };
  });
}

function projectCardHtml(p) {
  return `
  <div class="card card-hover" style="cursor:pointer;display:flex;flex-direction:column;gap:12px;" data-project-id="${p.id}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:14.5px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
        <div class="text-faint" style="font-size:12px;">${p.manager ? escapeHtml(p.manager.name) : 'No manager assigned'}</div>
      </div>
      ${priorityBadge(p.priority)}
    </div>
    <p class="text-muted" style="font-size:12.5px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px;">${escapeHtml(p.description || 'No description provided.')}</p>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px;" class="text-faint">
        <span>${p.progress}% complete</span><span>${p.totalTasks} task${p.totalTasks === 1 ? '' : 's'}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${p.progress}%"></div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      ${projectStatusBadge(p.status)}
      <div style="display:flex;">
        ${p.members.slice(0, 4).map((m) => avatarHtml(m, 'sm')).join('')}
        ${p.members.length > 4 ? `<div class="avatar sm" style="background:var(--paper-200);color:var(--text-600);">+${p.members.length - 4}</div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ---------- Create / Edit Project Modal (Admin) ---------- */
async function openProjectModal(existing) {
  if (_pmListCache.length === 0) {
    try {
      const { users } = await API.users();
      _pmListCache = users.filter((u) => u.role === 'PROJECT_MANAGER' && u.status === 'ACTIVE');
    } catch (e) { /* ignore */ }
  }
  const isEdit = !!existing;
  const pmOptions = `<option value="">Unassigned</option>` + _pmListCache.map((u) =>
    `<option value="${u.id}" ${existing && existing.manager_id === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`
  ).join('');

  openModal({
    title: isEdit ? 'Edit Project' : 'Create New Project',
    bodyHtml: `
      <form id="project-form" novalidate>
        <div class="field">
          <label for="p-name">Project name</label>
          <input class="input" id="p-name" value="${existing ? escapeHtml(existing.name) : ''}" placeholder="e.g. Orion Customer Portal" />
          <div class="error-text" id="err-p-name"></div>
        </div>
        <div class="field">
          <label for="p-desc">Description</label>
          <textarea class="input" id="p-desc" placeholder="What is this project about?">${existing ? escapeHtml(existing.description || '') : ''}</textarea>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="p-start">Start date</label>
            <input class="input" type="date" id="p-start" value="${existing && existing.start_date ? existing.start_date : ''}" />
          </div>
          <div class="field">
            <label for="p-end">End date</label>
            <input class="input" type="date" id="p-end" value="${existing && existing.end_date ? existing.end_date : ''}" />
            <div class="error-text" id="err-p-dates"></div>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="p-priority">Priority</label>
            <select class="input" id="p-priority">
              ${['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => `<option value="${v}" ${existing && existing.priority === v ? 'selected' : (!existing && v === 'MEDIUM' ? 'selected' : '')}>${labelize(v)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="p-status">Status</label>
            <select class="input" id="p-status">
              ${['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((v) => `<option value="${v}" ${existing && existing.status === v ? 'selected' : (!existing && v === 'PLANNING' ? 'selected' : '')}>${labelize(v)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="p-manager">Project Manager</label>
          <select class="input" id="p-manager">${pmOptions}</select>
          <div class="hint">Only active users with the Project Manager role are shown.</div>
        </div>
        <div class="error-text" id="err-p-general"></div>
      </form>
    `,
    footerHtml: `
      <button class="btn btn-secondary" id="p-cancel">Cancel</button>
      <button class="btn btn-primary" id="p-save">${isEdit ? 'Save Changes' : 'Create Project'}</button>
    `,
    onMount: () => {
      document.getElementById('p-cancel').onclick = () => closeModal();
      document.getElementById('p-save').onclick = async () => {
        ['p-name', 'p-dates', 'p-general'].forEach((id) => fieldError(`err-${id}`, ''));
        const name = document.getElementById('p-name').value.trim();
        const start = document.getElementById('p-start').value;
        const end = document.getElementById('p-end').value;
        let valid = true;
        if (!name) { fieldError('err-p-name', 'Project name is required.'); valid = false; }
        if (start && end && end < start) { fieldError('err-p-dates', 'End date must be after start date.'); valid = false; }
        if (!valid) return;

        const payload = {
          name,
          description: document.getElementById('p-desc').value.trim(),
          startDate: start || null,
          endDate: end || null,
          priority: document.getElementById('p-priority').value,
          status: document.getElementById('p-status').value,
          managerId: document.getElementById('p-manager').value || null,
        };
        const btn = document.getElementById('p-save');
        btn.disabled = true;
        const original = btn.textContent;
        btn.innerHTML = '<span class="spinner" style="border-color:rgba(255,255,255,.4);border-top-color:#fff;"></span>';
        try {
          if (isEdit) {
            await API.updateProject(existing.id, payload);
            toast('Project updated.', 'success');
          } else {
            await API.createProject(payload);
            toast('Project created.', 'success');
          }
          closeModal();
          if (location.hash.startsWith('#/projects/')) renderRoute();
          else await renderProjectsPage();
        } catch (e) {
          fieldError('err-p-general', e.message);
          btn.disabled = false;
          btn.textContent = original;
        }
      };
    },
  });
}
