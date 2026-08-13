'use strict';

const PROJECT_COLORS = ['#3452FF', '#EC4899', '#16A085', '#C4790C', '#7C4DFF', '#D8393F', '#0EA5E9', '#22C55E'];
function colorForProject(id) { return PROJECT_COLORS[Number(id) % PROJECT_COLORS.length]; }
function colorForPriority(p) {
  return { LOW: 'var(--pri-low)', MEDIUM: 'var(--pri-medium)', HIGH: 'var(--pri-high)', CRITICAL: 'var(--pri-critical)' }[p] || 'var(--pri-medium)';
}

let _calState = {
  view: 'month',      // 'month' | 'week'
  colorBy: 'priority', // 'priority' | 'project'
  anchor: new Date(new Date().setHours(0, 0, 0, 0)),
  tasks: [],
  projMap: {},
};

function parseDueDate(str) {
  // due_date is stored as 'YYYY-MM-DD'
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

async function renderCalendarPage() {
  document.getElementById('page-content').innerHTML = loadingBlock();
  try {
    const [{ tasks }, { projects }] = await Promise.all([API.tasks(), API.projects()]);
    _calState.tasks = tasks.filter((t) => !!t.due_date);
    _calState.projMap = {};
    projects.forEach((p) => { _calState.projMap[p.id] = p; });
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load calendar', e.message);
    return;
  }
  document.getElementById('page-content').innerHTML = calendarHtml();
  mountCalendarEvents();
}

function calendarHtml() {
  return `
    <div class="cal-toolbar">
      <div class="cal-nav">
        <button class="icon-btn" id="cal-prev">${ICONS.chevronLeft}</button>
        <button class="btn btn-secondary btn-sm" id="cal-today">Today</button>
        <button class="icon-btn" id="cal-next">${ICONS.chevronRight}</button>
        <h2 class="cal-title" id="cal-title"></h2>
      </div>
      <div class="cal-controls">
        <div class="seg-control" id="cal-view-toggle">
          <button class="seg-btn ${_calState.view === 'month' ? 'active' : ''}" data-view="month">Month</button>
          <button class="seg-btn ${_calState.view === 'week' ? 'active' : ''}" data-view="week">Week</button>
        </div>
        <select class="select-sm" id="cal-color-by">
          <option value="priority" ${_calState.colorBy === 'priority' ? 'selected' : ''}>Color by Priority</option>
          <option value="project" ${_calState.colorBy === 'project' ? 'selected' : ''}>Color by Project</option>
        </select>
      </div>
    </div>
    <div id="cal-legend" class="cal-legend"></div>
    <div id="cal-grid"></div>
  `;
}

function legendHtml() {
  if (_calState.colorBy === 'priority') {
    return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => `
      <span class="cal-legend-item"><span class="cal-dot" style="background:${colorForPriority(p)}"></span>${labelize(p)}</span>
    `).join('');
  }
  const ids = Object.keys(_calState.projMap);
  if (ids.length === 0) return '<span class="text-faint" style="font-size:12px;">No projects yet.</span>';
  return ids.map((id) => `
    <span class="cal-legend-item"><span class="cal-dot" style="background:${colorForProject(id)}"></span>${escapeHtml(_calState.projMap[id].name)}</span>
  `).join('');
}

function eventColor(t) {
  return _calState.colorBy === 'priority' ? colorForPriority(t.priority) : colorForProject(t.project_id);
}

function eventPillHtml(t) {
  const proj = _calState.projMap[t.project_id];
  const overdue = t.status !== 'COMPLETED' && daysUntil(t.due_date) < 0;
  return `
    <div class="cal-event ${overdue ? 'overdue' : ''} ${t.status === 'COMPLETED' ? 'done' : ''}" data-task-id="${t.id}" title="${escapeHtml(t.title)}${proj ? ' — ' + escapeHtml(proj.name) : ''}">
      <span class="cal-dot" style="background:${eventColor(t)}"></span><span class="cal-event-text">${escapeHtml(t.title)}</span>
    </div>
  `;
}

function tasksOnDay(day) {
  return _calState.tasks.filter((t) => sameDay(parseDueDate(t.due_date), day));
}

function startOfWeek(d) {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function monthGridHtml() {
  const anchor = _calState.anchor;
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    const inMonth = day.getMonth() === anchor.getMonth();
    const isToday = sameDay(day, today);
    const dayTasks = tasksOnDay(day);
    const visible = dayTasks.slice(0, 3);
    const overflow = dayTasks.length - visible.length;
    cells += `
      <div class="cal-cell ${inMonth ? '' : 'muted'} ${isToday ? 'today' : ''}">
        <div class="cal-cell-date">${isToday ? `<span class="cal-today-badge">${day.getDate()}</span>` : day.getDate()}</div>
        <div class="cal-cell-events">
          ${visible.map(eventPillHtml).join('')}
          ${overflow > 0 ? `<div class="cal-more" data-more-day="${ymd(day)}">+${overflow} more</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="cal-dow-row">${dowLabels.map((l) => `<div class="cal-dow">${l}</div>`).join('')}</div>
    <div class="cal-month-grid">${cells}</div>
  `;
}

function weekGridHtml() {
  const start = startOfWeek(_calState.anchor);
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const isToday = sameDay(day, today);
    const dayTasks = tasksOnDay(day);
    cols += `
      <div class="cal-week-col ${isToday ? 'today' : ''}">
        <div class="cal-week-col-header">
          <div class="cal-dow">${day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
          <div class="cal-cell-date">${isToday ? `<span class="cal-today-badge">${day.getDate()}</span>` : day.getDate()}</div>
        </div>
        <div class="cal-week-col-events">
          ${dayTasks.length === 0 ? `<div class="text-faint" style="font-size:11.5px;padding:6px 2px;">No due tasks</div>` : dayTasks.map(eventPillHtml).join('')}
        </div>
      </div>
    `;
  }
  return `<div class="cal-week-grid">${cols}</div>`;
}

function titleForView() {
  if (_calState.view === 'month') {
    return _calState.anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const start = startOfWeek(_calState.anchor);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function renderCalendarGrid() {
  document.getElementById('cal-title').textContent = titleForView();
  document.getElementById('cal-legend').innerHTML = legendHtml();
  document.getElementById('cal-grid').innerHTML = _calState.view === 'month' ? monthGridHtml() : weekGridHtml();
  document.querySelectorAll('[data-task-id]').forEach((el) => {
    el.onclick = () => openTaskModal(Number(el.dataset.taskId));
  });
  document.querySelectorAll('[data-more-day]').forEach((el) => {
    el.onclick = () => openDayListModal(el.dataset.moreDay);
  });
}

function openDayListModal(dayStr) {
  const day = parseDueDate(dayStr);
  const dayTasks = tasksOnDay(day);
  openModal({
    title: day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    bodyHtml: `<div style="display:flex;flex-direction:column;gap:6px;">${dayTasks.map((t) => `
      <div class="member-row" style="cursor:pointer;" data-task-id="${t.id}">
        <span class="cal-dot" style="background:${eventColor(t)}"></span>
        <div class="info"><div class="name">${escapeHtml(t.title)}</div><div class="role">${escapeHtml((_calState.projMap[t.project_id] || {}).name || '')}</div></div>
        ${priorityBadge(t.priority)}
      </div>
    `).join('')}</div>`,
    onMount: (overlay) => {
      overlay.querySelectorAll('[data-task-id]').forEach((el) => {
        el.onclick = () => { closeModal(); openTaskModal(Number(el.dataset.taskId)); };
      });
    },
  });
}

function mountCalendarEvents() {
  renderCalendarGrid();

  document.getElementById('cal-prev').onclick = () => {
    const a = _calState.anchor;
    _calState.anchor = _calState.view === 'month' ? new Date(a.getFullYear(), a.getMonth() - 1, 1) : new Date(a.getFullYear(), a.getMonth(), a.getDate() - 7);
    renderCalendarGrid();
  };
  document.getElementById('cal-next').onclick = () => {
    const a = _calState.anchor;
    _calState.anchor = _calState.view === 'month' ? new Date(a.getFullYear(), a.getMonth() + 1, 1) : new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7);
    renderCalendarGrid();
  };
  document.getElementById('cal-today').onclick = () => {
    _calState.anchor = new Date(new Date().setHours(0, 0, 0, 0));
    renderCalendarGrid();
  };
  document.querySelectorAll('#cal-view-toggle .seg-btn').forEach((btn) => {
    btn.onclick = () => {
      _calState.view = btn.dataset.view;
      document.getElementById('page-content').innerHTML = calendarHtml();
      mountCalendarEvents();
    };
  });
  document.getElementById('cal-color-by').onchange = (e) => {
    _calState.colorBy = e.target.value;
    renderCalendarGrid();
  };
}
