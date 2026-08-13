'use strict';

let _pdState = { project: null, tasks: [], activity: [], tab: 'overview', allTeamMembers: [] };

async function renderProjectDetailPage(id, autoOpenTaskId) {
  document.getElementById('page-content').innerHTML = loadingBlock();
  let projectData, tasksData;
  try {
    [projectData, tasksData] = await Promise.all([API.project(id), API.tasks(`projectId=${id}`)]);
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load project', e.message);
    return;
  }
  _pdState.project = projectData.project;
  _pdState.activity = projectData.activity;
  _pdState.tasks = tasksData.tasks;
  _pdState.tab = _pdState.tab || 'overview';

  document.getElementById('page-content').innerHTML = projectDetailHtml();
  mountProjectDetailEvents();

  if (autoOpenTaskId) {
    const t = _pdState.tasks.find((tk) => String(tk.id) === String(autoOpenTaskId));
    if (t) openTaskModal(t.id);
  }
}

function canManageProject() {
  const u = Store.user;
  const p = _pdState.project;
  return u.role === 'ADMIN' || (u.role === 'PROJECT_MANAGER' && p.manager_id === u.id);
}

function projectDetailHtml() {
  const p = _pdState.project;
  const manage = canManageProject();
  return `
  <div style="margin-bottom:6px;">
    <a href="#/projects" style="font-size:12.5px;color:var(--text-400);display:inline-flex;align-items:center;gap:4px;">← Back to Projects</a>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <h1 style="font-size:22px;">${escapeHtml(p.name)}</h1>
        ${projectStatusBadge(p.status)} ${priorityBadge(p.priority)}
      </div>
      <p class="text-muted" style="margin-top:6px;font-size:13px;max-width:640px;">${escapeHtml(p.description || 'No description provided.')}</p>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;">
      ${manage ? `<button class="btn btn-secondary" id="edit-project-btn">${ICONS.edit} Edit</button>` : ''}
      ${Store.user.role === 'ADMIN' ? `<button class="btn btn-danger" id="delete-project-btn">${ICONS.trash} Delete</button>` : ''}
    </div>
  </div>

  <div class="stat-grid">
    <div class="card stat-card"><div class="stat-value">${p.progress}%</div><div class="stat-label">Progress</div></div>
    <div class="card stat-card"><div class="stat-value">${p.totalTasks}</div><div class="stat-label">Total Tasks</div></div>
    <div class="card stat-card"><div class="stat-value">${p.members.length}</div><div class="stat-label">Team Members</div></div>
    <div class="card stat-card"><div class="stat-value" style="font-size:16px;padding-top:6px;">${fmtDate(p.end_date)}</div><div class="stat-label">Target End Date</div></div>
  </div>

  <div class="tabs">
    <button class="tab-btn ${_pdState.tab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
    <button class="tab-btn ${_pdState.tab === 'tasks' ? 'active' : ''}" data-tab="tasks">Tasks</button>
    <button class="tab-btn ${_pdState.tab === 'team' ? 'active' : ''}" data-tab="team">Team</button>
    <button class="tab-btn ${_pdState.tab === 'activity' ? 'active' : ''}" data-tab="activity">Activity</button>
  </div>
  <div id="tab-content">${renderTabContent()}</div>
  `;
}

function renderTabContent() {
  const p = _pdState.project;
  if (_pdState.tab === 'overview') {
    return `
    <div class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>Project Information</h2></div>
        <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;"><span class="text-faint">Project Manager</span><b>${p.manager ? escapeHtml(p.manager.name) : 'Unassigned'}</b></div>
          <div style="display:flex;justify-content:space-between;"><span class="text-faint">Start Date</span><b>${fmtDate(p.start_date)}</b></div>
          <div style="display:flex;justify-content:space-between;"><span class="text-faint">End Date</span><b>${fmtDate(p.end_date)}</b></div>
          <div style="display:flex;justify-content:space-between;"><span class="text-faint">Priority</span>${priorityBadge(p.priority)}</div>
          <div style="display:flex;justify-content:space-between;"><span class="text-faint">Status</span>${projectStatusBadge(p.status)}</div>
        </div>
      </div>
      <div class="card">
        <div class="section-title"><h2>Task Progress</h2></div>
        <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${p.progress}%"></div></div>
        <div class="text-faint" style="font-size:12px;margin-bottom:16px;">${p.progress}% of tasks completed</div>
        ${['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((s) => {
          const stat = p.taskStats.find((t) => t.status === s);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">${statusBadge(s)}<b style="font-size:13px;">${stat ? stat.count : 0}</b></div>`;
        }).join('')}
      </div>
    </div>`;
  }
  if (_pdState.tab === 'tasks') return renderKanban();
  if (_pdState.tab === 'team') return renderTeamTab();
  if (_pdState.tab === 'activity') return renderActivityTab();
  return '';
}

/* ---------- Tasks (Kanban) ---------- */
function renderKanban() {
  const manage = canManageProject();
  const cols = [
    { key: 'TODO', label: 'To Do' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'REVIEW', label: 'Review' },
    { key: 'COMPLETED', label: 'Completed' },
  ];
  return `
    <div class="toolbar">
      <div class="search-box">${ICONS.search}<input class="input" id="task-search" placeholder="Search tasks..." /></div>
      <select class="select-sm" id="task-priority-filter">
        <option value="">All priorities</option>
        <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
      </select>
      <select class="select-sm" id="task-assignee-filter">
        <option value="">All assignees</option>
        ${_pdState.project.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
        <option value="unassigned">Unassigned</option>
      </select>
      ${manage ? `<button class="btn btn-primary" id="new-task-btn" style="margin-left:auto;">${ICONS.plus} New Task</button>` : ''}
    </div>
    <div class="kanban" id="kanban-board">
      ${cols.map((c) => `
        <div class="kanban-col">
          <div class="kanban-col-header"><span class="kanban-col-title">${c.label}</span><span class="kanban-count" id="count-${c.key}">0</span></div>
          <div id="col-${c.key}"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function applyTaskFiltersAndRender() {
  const q = (document.getElementById('task-search')?.value || '').toLowerCase().trim();
  const pri = document.getElementById('task-priority-filter')?.value || '';
  const assignee = document.getElementById('task-assignee-filter')?.value || '';

  let list = _pdState.tasks.filter((t) => {
    if (pri && t.priority !== pri) return false;
    if (assignee === 'unassigned' && t.assignee_id) return false;
    if (assignee && assignee !== 'unassigned' && String(t.assignee_id) !== assignee) return false;
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });

  ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].forEach((s) => {
    const col = document.getElementById(`col-${s}`);
    const items = list.filter((t) => t.status === s);
    document.getElementById(`count-${s}`).textContent = items.length;
    if (!col) return;
    col.innerHTML = items.length === 0
      ? `<div class="text-faint" style="font-size:12px;text-align:center;padding:18px 6px;">No tasks</div>`
      : items.map(taskCardHtml).join('');
    col.querySelectorAll('[data-task-id]').forEach((card) => {
      card.onclick = () => openTaskModal(Number(card.dataset.taskId));
    });
  });
}

function taskCardHtml(t) {
  return `
  <div class="task-card" data-task-id="${t.id}">
    <div class="task-card-title">${escapeHtml(t.title)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      ${priorityBadge(t.priority)}
      ${t.assignee ? avatarHtml(t.assignee, 'sm') : `<span class="text-faint" style="font-size:11px;">Unassigned</span>`}
    </div>
    <div class="task-card-footer">
      ${dueTag(t.due_date, t.status)}
      <span style="display:flex;gap:8px;">
        ${t.attachmentCount > 0 ? `<span class="due-tag">${ICONS.paperclip}${t.attachmentCount}</span>` : ''}
        ${t.commentCount > 0 ? `<span class="due-tag">${ICONS.message}${t.commentCount}</span>` : ''}
      </span>
    </div>
  </div>`;
}

/* ---------- Team tab ---------- */
function renderTeamTab() {
  const manage = canManageProject();
  const p = _pdState.project;
  return `
    <div class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>Project Manager</h2></div>
        ${p.manager ? `
          <div class="member-row"><div style="display:flex;align-items:center;gap:10px;">${avatarHtml(p.manager)}<div class="info"><div class="name">${escapeHtml(p.manager.name)}</div><div class="role">${escapeHtml(p.manager.email)}</div></div></div></div>
        ` : emptyState('users', 'No manager assigned', 'An administrator can assign a Project Manager from the Edit dialog.')}
      </div>
      <div class="card">
        <div class="section-title">
          <h2>Team Members (${p.members.length})</h2>
          ${manage ? `<button class="btn btn-sm btn-secondary" id="add-member-btn">${ICONS.plus} Add Member</button>` : ''}
        </div>
        ${p.members.length === 0 ? emptyState('users', 'No team members yet', 'Add team members so they can be assigned tasks.') :
          p.members.map((m) => `
            <div class="member-row">
              ${avatarHtml(m)}
              <div class="info"><div class="name">${escapeHtml(m.name)}</div><div class="role">${escapeHtml(m.title || m.email)}</div></div>
              ${manage ? `<button class="icon-btn" data-remove-member="${m.id}" title="Remove from project">${ICONS.close}</button>` : ''}
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

/* ---------- Activity tab ---------- */
function renderActivityTab() {
  const a = _pdState.activity;
  return `
    <div class="card">
      <div class="section-title"><h2>Activity Timeline</h2></div>
      ${a.length === 0 ? emptyState('inbox', 'No activity yet', 'Actions on this project will show up here.') :
        `<div style="display:flex;flex-direction:column;">
          ${a.map((item) => `
            <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--paper-border);">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--primary-600);margin-top:6px;flex-shrink:0;"></div>
              <div>
                <div style="font-size:13px;">${escapeHtml(item.message)}</div>
                <div class="text-faint" style="font-size:11.5px;margin-top:2px;">${item.user_name ? escapeHtml(item.user_name) + ' · ' : ''}${fmtDateTime(item.created_at)}</div>
              </div>
            </div>
          `).join('')}
        </div>`}
    </div>
  `;
}

/* ---------- Mount events ---------- */
function mountProjectDetailEvents() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      _pdState.tab = btn.dataset.tab;
      document.getElementById('page-content').innerHTML = projectDetailHtml();
      mountProjectDetailEvents();
    };
  });

  const editBtn = document.getElementById('edit-project-btn');
  if (editBtn) editBtn.onclick = () => openProjectModal(_pdState.project);

  const delBtn = document.getElementById('delete-project-btn');
  if (delBtn) delBtn.onclick = () => confirmDialog(
    `Delete "${_pdState.project.name}"? This permanently removes the project, its tasks, and all discussions.`,
    async () => { await API.deleteProject(_pdState.project.id); toast('Project deleted.', 'success'); location.hash = '#/projects'; },
    { danger: true, confirmLabel: 'Delete Project' }
  );

  if (_pdState.tab === 'tasks') {
    applyTaskFiltersAndRender();
    ['task-search', 'task-priority-filter', 'task-assignee-filter'].forEach((id) => {
      document.getElementById(id).addEventListener('input', applyTaskFiltersAndRender);
    });
    const newTaskBtn = document.getElementById('new-task-btn');
    if (newTaskBtn) newTaskBtn.onclick = () => openTaskFormModal();
  }

  if (_pdState.tab === 'team') {
    const addBtn = document.getElementById('add-member-btn');
    if (addBtn) addBtn.onclick = () => openAddMemberModal();
    document.querySelectorAll('[data-remove-member]').forEach((btn) => {
      btn.onclick = () => confirmDialog(
        'Remove this member from the project? Their assigned tasks will become unassigned.',
        async () => {
          await API.removeMember(_pdState.project.id, btn.dataset.removeMember);
          toast('Member removed.', 'success');
          await renderProjectDetailPage(_pdState.project.id);
        },
        { danger: true, confirmLabel: 'Remove' }
      );
    });
  }
}

async function openAddMemberModal() {
  let candidates = [];
  try {
    const { users } = await API.users();
    const memberIds = new Set(_pdState.project.members.map((m) => m.id));
    candidates = users.filter((u) => u.role === 'TEAM_MEMBER' && u.status === 'ACTIVE' && !memberIds.has(u.id));
  } catch (e) { toast(e.message, 'error'); return; }

  if (candidates.length === 0) {
    openModal({ title: 'Add Team Member', bodyHtml: emptyState('users', 'No available team members', 'Every active team member is already on this project, or none exist yet.') });
    return;
  }

  openModal({
    title: 'Add Team Member',
    bodyHtml: `
      <div class="field">
        <label for="member-select">Select a team member</label>
        <select class="input" id="member-select">
          ${candidates.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} — ${escapeHtml(u.title || u.email)}</option>`).join('')}
        </select>
      </div>
      <div class="error-text" id="err-member-general"></div>
    `,
    footerHtml: `<button class="btn btn-secondary" id="member-cancel">Cancel</button><button class="btn btn-primary" id="member-add">Add to Project</button>`,
    onMount: () => {
      document.getElementById('member-cancel').onclick = () => closeModal();
      document.getElementById('member-add').onclick = async () => {
        const userId = document.getElementById('member-select').value;
        const btn = document.getElementById('member-add');
        btn.disabled = true;
        try {
          await API.addMember(_pdState.project.id, userId);
          toast('Team member added.', 'success');
          closeModal();
          await renderProjectDetailPage(_pdState.project.id);
        } catch (e) {
          fieldError('err-member-general', e.message);
          btn.disabled = false;
        }
      };
    },
  });
}

/* ---------- Task create/edit form modal ---------- */
function openTaskFormModal(existing) {
  const members = _pdState.project.members;
  const isEdit = !!existing;
  openModal({
    title: isEdit ? 'Edit Task' : 'Create New Task',
    bodyHtml: `
      <form id="task-form" novalidate>
        <div class="field">
          <label for="t-title">Task title</label>
          <input class="input" id="t-title" value="${existing ? escapeHtml(existing.title) : ''}" placeholder="e.g. Build login screen" />
          <div class="error-text" id="err-t-title"></div>
        </div>
        <div class="field">
          <label for="t-desc">Description</label>
          <textarea class="input" id="t-desc" placeholder="Describe what needs to be done">${existing ? escapeHtml(existing.description || '') : ''}</textarea>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="t-assignee">Assign to</label>
            <select class="input" id="t-assignee">
              <option value="">Unassigned</option>
              ${members.map((m) => `<option value="${m.id}" ${existing && existing.assignee_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="t-priority">Priority</label>
            <select class="input" id="t-priority">
              ${['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => `<option value="${v}" ${existing ? (existing.priority === v ? 'selected' : '') : (v === 'MEDIUM' ? 'selected' : '')}>${labelize(v)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="t-due">Due date</label>
            <input class="input" type="date" id="t-due" value="${existing && existing.due_date ? existing.due_date : ''}" />
          </div>
          <div class="field">
            <label for="t-status">Status</label>
            <select class="input" id="t-status">
              ${['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((v) => `<option value="${v}" ${existing ? (existing.status === v ? 'selected' : '') : (v === 'TODO' ? 'selected' : '')}>${labelize(v)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="error-text" id="err-t-general"></div>
      </form>
    `,
    footerHtml: `<button class="btn btn-secondary" id="t-cancel">Cancel</button><button class="btn btn-primary" id="t-save">${isEdit ? 'Save Changes' : 'Create Task'}</button>`,
    onMount: () => {
      document.getElementById('t-cancel').onclick = () => closeModal();
      document.getElementById('t-save').onclick = async () => {
        fieldError('err-t-title', ''); fieldError('err-t-general', '');
        const title = document.getElementById('t-title').value.trim();
        if (!title) { fieldError('err-t-title', 'Task title is required.'); return; }
        const payload = {
          title,
          description: document.getElementById('t-desc').value.trim(),
          assigneeId: document.getElementById('t-assignee').value || null,
          priority: document.getElementById('t-priority').value,
          dueDate: document.getElementById('t-due').value || null,
          status: document.getElementById('t-status').value,
        };
        const btn = document.getElementById('t-save');
        btn.disabled = true;
        try {
          if (isEdit) await API.updateTask(existing.id, payload);
          else await API.createTask({ ...payload, projectId: _pdState.project.id });
          toast(isEdit ? 'Task updated.' : 'Task created.', 'success');
          closeModal();
          await renderProjectDetailPage(_pdState.project.id);
          _pdState.tab = 'tasks';
          document.getElementById('page-content').innerHTML = projectDetailHtml();
          mountProjectDetailEvents();
        } catch (e) {
          fieldError('err-t-general', e.message);
          btn.disabled = false;
        }
      };
    },
  });
}

/* ---------- Task detail + discussion modal ---------- */
async function openTaskModal(taskId) {
  openModal({ title: 'Loading task…', bodyHtml: loadingBlock(), large: true });
  let data;
  try {
    data = await API.task(taskId);
  } catch (e) {
    toast(e.message, 'error');
    closeModal();
    return;
  }
  const t = data.task;
  const manage = canManageProject();
  const isAssignee = t.assignee_id === Store.user.id;

  const statusControl = manage
    ? `<select class="input" id="tm-status" style="width:auto;">${['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((v) => `<option value="${v}" ${t.status === v ? 'selected' : ''}>${labelize(v)}</option>`).join('')}</select>`
    : isAssignee
      ? `<select class="input" id="tm-status" style="width:auto;">${['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map((v) => `<option value="${v}" ${t.status === v ? 'selected' : ''}>${labelize(v)}</option>`).join('')}</select>`
      : statusBadge(t.status);

  openModal({
    title: t.title,
    large: true,
    bodyHtml: `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        ${priorityBadge(t.priority)}
        ${dueTag(t.due_date, t.status)}
        <span class="chip">${t.assignee ? avatarHtml(t.assignee, 'sm') + escapeHtml(t.assignee.name) : 'Unassigned'}</span>
      </div>
      <p style="font-size:13.5px;color:var(--text-600);line-height:1.6;margin-bottom:16px;white-space:pre-wrap;">${escapeHtml(t.description || 'No description provided.')}</p>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <label style="font-size:12.5px;font-weight:600;color:var(--text-600);">Status</label>
        ${statusControl}
        ${manage ? `<button class="btn btn-sm btn-secondary" id="tm-edit" style="margin-left:auto;">${ICONS.edit} Edit Details</button>` : ''}
        ${manage ? `<button class="btn btn-sm btn-danger" id="tm-delete">${ICONS.trash}</button>` : ''}
      </div>
      <div class="divider"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h3 style="font-size:14px;">Attachments</h3>
        <label class="btn btn-sm btn-secondary" style="cursor:pointer;">
          ${ICONS.paperclip} Attach file
          <input type="file" id="tm-file-input" style="display:none;" />
        </label>
      </div>
      <div id="tm-attachments">${data.attachments.length === 0 ? `<p class="text-faint" style="font-size:12.5px;">No files attached yet.</p>` :
        data.attachments.map((a) => attachmentHtml(a, t)).join('')}</div>
      <div class="error-text" id="err-tm-attach"></div>
      <div class="divider"></div>
      <h3 style="font-size:14px;margin-bottom:10px;">Task Discussion</h3>
      <div id="tm-comments">${data.comments.length === 0 ? `<p class="text-faint" style="font-size:12.5px;">No discussion yet — be the first to comment.</p>` :
        data.comments.map(commentHtml).join('')}</div>
      <form id="tm-comment-form" style="margin-top:14px;display:flex;gap:8px;">
        <input class="input" id="tm-comment-input" placeholder="Write a comment about this task…" />
        <button class="btn btn-primary" type="submit">Post</button>
      </form>
      <div class="error-text" id="err-tm-comment"></div>
    `,
    onMount: () => {
      const statusSel = document.getElementById('tm-status');
      if (statusSel && statusSel.tagName === 'SELECT') {
        statusSel.onchange = async () => {
          try {
            await API.updateTask(t.id, { status: statusSel.value });
            toast('Task status updated.', 'success');
            await renderProjectDetailPage(_pdState.project.id);
            _pdState.tab = 'tasks';
            document.getElementById('page-content').innerHTML = projectDetailHtml();
            mountProjectDetailEvents();
          } catch (e) { toast(e.message, 'error'); }
        };
      }
      const editBtn = document.getElementById('tm-edit');
      if (editBtn) editBtn.onclick = () => { closeModal(); openTaskFormModal(t); };
      const delBtn = document.getElementById('tm-delete');
      if (delBtn) delBtn.onclick = () => confirmDialog(
        `Delete task "${t.title}"? This cannot be undone.`,
        async () => {
          await API.deleteTask(t.id);
          toast('Task deleted.', 'success');
          closeModal();
          await renderProjectDetailPage(_pdState.project.id);
          _pdState.tab = 'tasks';
          document.getElementById('page-content').innerHTML = projectDetailHtml();
          mountProjectDetailEvents();
        },
        { danger: true, confirmLabel: 'Delete Task' }
      );
      const fileInput = document.getElementById('tm-file-input');
      if (fileInput) fileInput.onchange = () => handleAttachmentUpload(fileInput, t);
      mountAttachmentDeleteHandlers(t);
      const form = document.getElementById('tm-comment-form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        fieldError('err-tm-comment', '');
        const input = document.getElementById('tm-comment-input');
        const body = input.value.trim();
        if (!body) { fieldError('err-tm-comment', 'Comment cannot be empty.'); return; }
        try {
          const { comment } = await API.addComment(t.id, body);
          const container = document.getElementById('tm-comments');
          if (container.querySelector('.text-faint')) container.innerHTML = '';
          container.insertAdjacentHTML('beforeend', commentHtml(comment));
          input.value = '';
          container.scrollTop = container.scrollHeight;
        } catch (e2) { fieldError('err-tm-comment', e2.message); }
      };
    },
  });
}

const MAX_ATTACHMENT_BYTES_CLIENT = 4 * 1024 * 1024;

function attachmentHtml(a, task) {
  const canRemove = canManageProject() || a.uploader?.id === Store.user.id;
  return `
    <div class="attachment-row" data-attachment-id="${a.id}">
      <span class="attachment-icon">${ICONS.file}</span>
      <div class="info" style="flex:1;min-width:0;">
        <div class="name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(a.filename)}</div>
        <div class="role">${fmtFileSize(a.size)} · ${a.uploader ? escapeHtml(a.uploader.name) : 'Unknown'} · ${fmtDateTime(a.created_at)}</div>
      </div>
      <a class="icon-btn" href="${API.attachmentDownloadUrl(task.id, a.id)}" download="${escapeHtml(a.filename)}" title="Download">${ICONS.download}</a>
      ${canRemove ? `<button class="icon-btn" data-remove-attachment="${a.id}" title="Delete">${ICONS.trash}</button>` : ''}
    </div>
  `;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

async function handleAttachmentUpload(fileInput, task) {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  fieldError('err-tm-attach', '');
  if (file.size > MAX_ATTACHMENT_BYTES_CLIENT) {
    fieldError('err-tm-attach', `Attachments are limited to ${Math.floor(MAX_ATTACHMENT_BYTES_CLIENT / (1024 * 1024))}MB.`);
    return;
  }
  try {
    const dataBase64 = await fileToBase64(file);
    const { attachment } = await API.uploadAttachment(task.id, { filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 });
    const container = document.getElementById('tm-attachments');
    if (container.querySelector('.text-faint')) container.innerHTML = '';
    container.insertAdjacentHTML('beforeend', attachmentHtml(attachment, task));
    mountAttachmentDeleteHandlers(task);
    toast('File attached.', 'success');
  } catch (e) {
    fieldError('err-tm-attach', e.message);
  }
}

function mountAttachmentDeleteHandlers(task) {
  document.querySelectorAll('[data-remove-attachment]').forEach((btn) => {
    btn.onclick = () => confirmDialog(
      'Remove this attachment? This cannot be undone.',
      async () => {
        await API.deleteAttachment(task.id, btn.dataset.removeAttachment);
        toast('Attachment removed.', 'success');
        closeModal();
        openTaskModal(task.id);
      },
      { danger: true, confirmLabel: 'Delete' }
    );
  });
}

function commentHtml(c) {
  return `
  <div class="comment">
    <div class="avatar sm" style="background:${c.user_color};width:28px;height:28px;font-size:11px;">${initials(c.user_name)}</div>
    <div class="comment-body">
      <div class="comment-meta"><span class="comment-author">${escapeHtml(c.user_name)}</span><span class="text-faint" style="font-size:10.5px;">${ROLE_LABELS[c.user_role]}</span><span class="comment-time">${fmtDateTime(c.created_at)}</span></div>
      <div class="comment-text">${escapeHtml(c.body)}</div>
    </div>
  </div>`;
}
