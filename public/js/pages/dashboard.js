'use strict';

async function renderDashboardPage() {
  document.getElementById('page-content').innerHTML = loadingBlock();
  let data;
  try {
    data = await API.dashboard();
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load dashboard', e.message);
    return;
  }
  const el = document.getElementById('page-content');
  if (data.role === 'ADMIN') el.innerHTML = adminDashboardHtml(data);
  else if (data.role === 'PROJECT_MANAGER') el.innerHTML = pmDashboardHtml(data);
  else el.innerHTML = teamDashboardHtml(data);
  mountDashboardEvents(data);
}

function adminDashboardHtml(d) {
  const s = d.stats;
  return `
  <div class="stat-grid">
    <div class="card stat-card"><div class="stat-value">${s.totalUsers}</div><div class="stat-label">Total Users</div></div>
    <div class="card stat-card"><div class="stat-value">${s.totalProjects}</div><div class="stat-label">Total Projects</div></div>
    <div class="card stat-card"><div class="stat-value">${s.activeProjects}</div><div class="stat-label">Active Projects</div></div>
    <div class="card stat-card"><div class="stat-value">${s.completedProjects}</div><div class="stat-label">Completed Projects</div></div>
    <div class="card stat-card"><div class="stat-value">${s.totalTasks}</div><div class="stat-label">Total Tasks</div></div>
    <div class="card stat-card"><div class="stat-value">${s.completedTasks}</div><div class="stat-label">Completed Tasks</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="section-title"><h2>Recent Projects</h2><a href="#/projects" class="link-btn" style="font-size:12.5px;">View all →</a></div>
      ${d.recentProjects.length === 0 ? emptyState('projects', 'No projects yet', 'Create your first project to get started.') :
        d.recentProjects.map((p) => `
          <div class="member-row" style="cursor:pointer;" onclick="location.hash='#/projects/${p.id}'">
            <div class="info">
              <div class="name">${escapeHtml(p.name)}</div>
              <div class="role">${labelize(p.status)} · ${priorityBadge(p.priority)}</div>
            </div>
            ${ICONS.chevronRight}
          </div>
        `).join('')}
    </div>
    <div class="card">
      <div class="section-title"><h2>Overdue Tasks</h2></div>
      ${d.overdue.length === 0 ? emptyState('check', 'Nothing overdue', 'All tasks are on track. Nice work.') :
        d.overdue.map((t) => `
          <div class="member-row" style="cursor:pointer;" onclick="location.hash='#/projects/${t.project_id}?task=${t.id}'">
            <div class="info">
              <div class="name">${escapeHtml(t.title)}</div>
              <div class="role">${escapeHtml(t.project_name)} · Due ${fmtDate(t.due_date)}</div>
            </div>
            ${priorityBadge(t.priority)}
          </div>
        `).join('')}
    </div>
  </div>
  <div class="grid grid-2" style="margin-top:16px;">
    <div class="card">
      <div class="section-title"><h2>Users by Role</h2></div>
      ${d.usersByRole.map((r) => `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;"><span>${ROLE_LABELS[r.role]}</span><b>${r.c}</b></div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round((r.c / d.stats.totalUsers) * 100)}%"></div></div>
        </div>
      `).join('')}
    </div>
    <div class="card">
      <div class="section-title"><h2>Projects by Status</h2></div>
      ${d.projectsByStatus.map((r) => `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;"><span>${labelize(r.status)}</span><b>${r.c}</b></div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round((r.c / d.stats.totalProjects) * 100)}%"></div></div>
        </div>
      `).join('')}
    </div>
  </div>
  `;
}

function pmDashboardHtml(d) {
  const s = d.stats;
  return `
  <div class="stat-grid">
    <div class="card stat-card"><div class="stat-value">${s.totalProjects}</div><div class="stat-label">Assigned Projects</div></div>
    <div class="card stat-card"><div class="stat-value">${s.activeProjects}</div><div class="stat-label">Active Projects</div></div>
    <div class="card stat-card"><div class="stat-value">${s.teamSize}</div><div class="stat-label">Team Members</div></div>
    <div class="card stat-card"><div class="stat-value">${s.totalTasks}</div><div class="stat-label">Total Tasks</div></div>
    <div class="card stat-card"><div class="stat-value">${s.completedTasks}</div><div class="stat-label">Completed Tasks</div></div>
    <div class="card stat-card"><div class="stat-value">${s.inProgress + s.review}</div><div class="stat-label">In Flight</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="section-title"><h2>My Projects</h2><a href="#/projects" class="link-btn" style="font-size:12.5px;">View all →</a></div>
      ${d.projects.length === 0 ? emptyState('projects', 'No projects assigned', 'An administrator will assign you as manager on a project.') :
        d.projects.slice(0, 6).map((p) => `
          <div class="member-row" style="cursor:pointer;" onclick="location.hash='#/projects/${p.id}'">
            <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="role">${labelize(p.status)}</div></div>
            ${priorityBadge(p.priority)}
          </div>
        `).join('')}
    </div>
    <div class="card">
      <div class="section-title"><h2>Upcoming Deadlines</h2></div>
      ${d.upcoming.length === 0 ? emptyState('check', 'No upcoming deadlines', 'Nothing due soon across your projects.') :
        d.upcoming.map((t) => `
          <div class="member-row" style="cursor:pointer;" onclick="location.hash='#/projects/${t.project_id}?task=${t.id}'">
            <div class="info"><div class="name">${escapeHtml(t.title)}</div><div class="role">${escapeHtml(t.project_name || '')}</div></div>
            ${dueTag(t.due_date, t.status)}
          </div>
        `).join('')}
    </div>
  </div>
  <div class="card" style="margin-top:16px;">
    <div class="section-title"><h2>Task Breakdown</h2></div>
    <div class="stat-grid" style="margin-bottom:0;">
      <div class="stat-card"><div class="stat-value">${s.todo}</div><div class="stat-label">${labelize('TODO')}</div></div>
      <div class="stat-card"><div class="stat-value">${s.inProgress}</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card"><div class="stat-value">${s.review}</div><div class="stat-label">In Review</div></div>
      <div class="stat-card"><div class="stat-value">${s.completedTasks}</div><div class="stat-label">Completed</div></div>
    </div>
  </div>
  `;
}

function teamDashboardHtml(d) {
  const s = d.stats;
  return `
  <div class="stat-grid">
    <div class="card stat-card"><div class="stat-value">${s.totalProjects}</div><div class="stat-label">Assigned Projects</div></div>
    <div class="card stat-card"><div class="stat-value">${s.totalTasks}</div><div class="stat-label">Assigned Tasks</div></div>
    <div class="card stat-card"><div class="stat-value">${s.pendingTasks}</div><div class="stat-label">Pending Tasks</div></div>
    <div class="card stat-card"><div class="stat-value">${s.completedTasks}</div><div class="stat-label">Completed Tasks</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="section-title"><h2>My Projects</h2><a href="#/projects" class="link-btn" style="font-size:12.5px;">View all →</a></div>
      ${d.projects.length === 0 ? emptyState('projects', 'No projects yet', 'You will see projects here once a manager adds you to their team.') :
        d.projects.map((p) => `
          <div class="member-row" style="cursor:pointer;" onclick="location.hash='#/projects/${p.id}'">
            <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="role">${labelize(p.status)}</div></div>
            ${priorityBadge(p.priority)}
          </div>
        `).join('')}
    </div>
    <div class="card">
      <div class="section-title"><h2>Upcoming Deadlines</h2><a href="#/tasks" class="link-btn" style="font-size:12.5px;">My tasks →</a></div>
      ${d.upcoming.length === 0 ? emptyState('check', 'Nothing due soon', 'You\'re all caught up.') :
        d.upcoming.map((t) => `
          <div class="member-row" style="cursor:pointer;" onclick="location.hash='#/projects/${t.project_id}?task=${t.id}'">
            <div class="info"><div class="name">${escapeHtml(t.title)}</div><div class="role">${escapeHtml(t.project_name || '')}</div></div>
            ${dueTag(t.due_date, t.status)}
          </div>
        `).join('')}
    </div>
  </div>
  `;
}

function mountDashboardEvents() { /* click handlers use inline hash nav; nothing extra to bind */ }
