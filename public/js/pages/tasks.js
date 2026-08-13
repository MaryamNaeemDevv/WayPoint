'use strict';

let _tasksListCache = [];

async function renderTasksPage() {
  document.getElementById('page-content').innerHTML = loadingBlock();
  try {
    const { tasks } = await API.tasks();
    _tasksListCache = tasks;
    // Attach project names
    const { projects } = await API.projects();
    const projMap = {};
    projects.forEach((p) => { projMap[p.id] = p; });
    _tasksListCache.forEach((t) => { t._project = projMap[t.project_id]; });
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load tasks', e.message);
    return;
  }

  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ICONS.search}<input class="input" id="tl-search" placeholder="Search tasks..." /></div>
      <select class="select-sm" id="tl-status">
        <option value="">All statuses</option>
        <option value="TODO">To Do</option><option value="IN_PROGRESS">In Progress</option><option value="REVIEW">Review</option><option value="COMPLETED">Completed</option>
      </select>
      <select class="select-sm" id="tl-priority">
        <option value="">All priorities</option>
        <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
      </select>
      <select class="select-sm" id="tl-sort">
        <option value="due">Sort: Due date</option>
        <option value="priority">Sort: Priority</option>
        <option value="recent">Sort: Most recent</option>
      </select>
    </div>
    <div id="tl-table"></div>
  `;
  ['tl-search', 'tl-status', 'tl-priority', 'tl-sort'].forEach((id) => document.getElementById(id).addEventListener('input', renderTasksTable));
  renderTasksTable();
}

const PRI_RANK2 = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function renderTasksTable() {
  const q = (document.getElementById('tl-search').value || '').toLowerCase().trim();
  const status = document.getElementById('tl-status').value;
  const pri = document.getElementById('tl-priority').value;
  const sort = document.getElementById('tl-sort').value;

  let list = _tasksListCache.filter((t) => {
    if (status && t.status !== status) return false;
    if (pri && t.priority !== pri) return false;
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });

  if (sort === 'priority') list.sort((a, b) => PRI_RANK2[b.priority] - PRI_RANK2[a.priority]);
  else if (sort === 'recent') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else list.sort((a, b) => (a.due_date ? a.due_date : '9999') > (b.due_date ? b.due_date : '9999') ? 1 : -1);

  const wrap = document.getElementById('tl-table');
  if (list.length === 0) {
    wrap.innerHTML = emptyState('tasks', 'No tasks found', 'Try adjusting your search or filters.');
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Task</th><th>Project</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>
          ${list.map((t) => `
            <tr style="cursor:pointer;" data-task-id="${t.id}" data-project-id="${t.project_id}">
              <td><b>${escapeHtml(t.title)}</b></td>
              <td class="text-muted">${t._project ? escapeHtml(t._project.name) : '—'}</td>
              <td>${priorityBadge(t.priority)}</td>
              <td>${statusBadge(t.status)}</td>
              <td>${dueTag(t.due_date, t.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  wrap.querySelectorAll('tr[data-task-id]').forEach((row) => {
    row.onclick = () => { location.hash = `#/projects/${row.dataset.projectId}?task=${row.dataset.taskId}`; };
  });
}
