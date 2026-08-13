'use strict';

let _reportsData = null;

async function renderReportsPage() {
  document.getElementById('page-content').innerHTML = loadingBlock();
  try {
    _reportsData = await API.reports();
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load reports', e.message);
    return;
  }
  document.getElementById('page-content').innerHTML = reportsHtml(_reportsData);
}

function reportsHtml(d) {
  if (d.totals.totalProjects === 0) {
    return emptyState('barChart', 'Nothing to report yet', 'Once you have projects with tasks, analytics will show up here.');
  }
  return `
    <div class="stat-grid">
      <div class="card stat-card"><div class="stat-value">${d.totals.totalTasks}</div><div class="stat-label">Total Tasks</div></div>
      <div class="card stat-card"><div class="stat-value">${d.totals.completedTasks}</div><div class="stat-label">Completed</div></div>
      <div class="card stat-card"><div class="stat-value">${d.totals.completionRate}%</div><div class="stat-label">Completion Rate</div></div>
      <div class="card stat-card"><div class="stat-value" style="${d.totals.overdueTasks > 0 ? 'color:var(--red-600);' : ''}">${d.totals.overdueTasks}</div><div class="stat-label">Overdue</div></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="section-title">
        <h2>Burndown — Tasks Remaining (Last 30 Days)</h2>
        <span class="text-faint" style="font-size:11.5px;">Scoped to ${d.totals.totalProjects} project${d.totals.totalProjects === 1 ? '' : 's'}</span>
      </div>
      ${burndownSvg(d.burndown)}
    </div>

    <div class="grid grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="section-title"><h2>Tasks by Status</h2></div>
        ${d.byStatus.map((r) => `
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;"><span>${labelize(r.status)}</span><b>${r.count}</b></div>
            <div class="progress-track"><div class="progress-fill" style="width:${d.totals.totalTasks ? Math.round((r.count / d.totals.totalTasks) * 100) : 0}%"></div></div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="section-title"><h2>Tasks by Priority</h2></div>
        ${d.byPriority.map((r) => `
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;"><span>${labelize(r.priority)}</span><b>${r.count}</b></div>
            <div class="progress-track"><div class="progress-fill" style="width:${d.totals.totalTasks ? Math.round((r.count / d.totals.totalTasks) * 100) : 0}%;background:${{ LOW: 'var(--pri-low)', MEDIUM: 'var(--pri-medium)', HIGH: 'var(--pri-high)', CRITICAL: 'var(--pri-critical)' }[r.priority]}"></div></div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-title">
        <h2>Team Workload</h2>
        ${d.unassignedCount > 0 ? `<span class="text-faint" style="font-size:11.5px;">${d.unassignedCount} task${d.unassignedCount === 1 ? '' : 's'} unassigned</span>` : ''}
      </div>
      ${d.workload.length === 0 ? emptyState('users', 'No assigned tasks yet', 'Assign tasks to team members to see workload here.') : `
        <div class="workload-legend">
          <span class="cal-legend-item"><span class="cal-dot" style="background:var(--text-400)"></span>To Do</span>
          <span class="cal-legend-item"><span class="cal-dot" style="background:var(--primary-600)"></span>In Progress</span>
          <span class="cal-legend-item"><span class="cal-dot" style="background:var(--violet-600)"></span>Review</span>
          <span class="cal-legend-item"><span class="cal-dot" style="background:var(--teal-600)"></span>Completed</span>
        </div>
        <div class="workload-list">
          ${d.workload.map(workloadRowHtml).join('')}
        </div>
      `}
    </div>
  `;
}

function workloadRowHtml(w) {
  const total = w.total || 1;
  const seg = (n, color) => n > 0 ? `<div class="workload-seg" style="width:${(n / total) * 100}%;background:${color}" title="${n}"></div>` : '';
  return `
    <div class="workload-row">
      <div class="workload-who">
        ${avatarHtml(w.user, 'sm')}
        <div class="info"><div class="name">${escapeHtml(w.user.name)}</div><div class="role">${escapeHtml(w.user.title || '')}</div></div>
      </div>
      <div class="workload-bar">
        ${seg(w.todo, 'var(--text-400)')}${seg(w.inProgress, 'var(--primary-600)')}${seg(w.review, 'var(--violet-600)')}${seg(w.completed, 'var(--teal-600)')}
      </div>
      <div class="workload-count">${w.total} task${w.total === 1 ? '' : 's'}${w.overdue > 0 ? ` <span style="color:var(--red-600);font-weight:700;">· ${w.overdue} overdue</span>` : ''}</div>
    </div>
  `;
}

function burndownSvg(data) {
  if (!data || data.length === 0) return emptyState('barChart', 'No data yet', 'Burndown will appear once tasks exist.');
  const W = 760, H = 240, pad = { top: 14, right: 14, bottom: 26, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxVal = Math.max(4, ...data.map((d) => d.remaining));
  const n = data.length;
  const xStep = innerW / (n - 1);
  const xAt = (i) => pad.left + i * xStep;
  const yAt = (v) => pad.top + innerH - (v / maxVal) * innerH;

  const remainingPts = data.map((d, i) => `${xAt(i)},${yAt(d.remaining)}`).join(' L ');
  const idealStart = data[0].remaining;
  const idealPts = `${xAt(0)},${yAt(idealStart)} L ${xAt(n - 1)},${yAt(0)}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = pad.top + innerH * f;
    const val = Math.round(maxVal * (1 - f));
    return `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="var(--paper-border)" stroke-width="1" />
            <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-400)">${val}</text>`;
  }).join('');

  const labelEvery = Math.ceil(n / 6);
  const xLabels = data.map((d, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return '';
    const dt = new Date(d.date + 'T00:00:00');
    return `<text x="${xAt(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--text-400)">${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>`;
  }).join('');

  const dots = data.map((d, i) => `<circle cx="${xAt(i)}" cy="${yAt(d.remaining)}" r="2.5" fill="var(--primary-600)"><title>${d.date}: ${d.remaining} remaining</title></circle>`).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
      ${gridLines}
      <polyline points="${idealPts}" fill="none" stroke="var(--text-400)" stroke-width="1.5" stroke-dasharray="4 4" />
      <polyline points="${remainingPts}" fill="none" stroke="var(--primary-600)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      ${dots}
      ${xLabels}
    </svg>
    <div style="display:flex;gap:16px;margin-top:6px;">
      <span class="cal-legend-item"><span style="display:inline-block;width:14px;height:2.5px;background:var(--primary-600);"></span>Actual remaining</span>
      <span class="cal-legend-item"><span style="display:inline-block;width:14px;height:0;border-top:2px dashed var(--text-400);"></span>Ideal pace</span>
    </div>
  `;
}
