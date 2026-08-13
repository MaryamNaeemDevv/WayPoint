'use strict';

let _cpOpen = false;
let _cpItems = [];
let _cpActive = 0;
let _cpDebounce = null;

function initCommandPalette() {
  document.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K';
    if ((e.metaKey || e.ctrlKey) && isK) {
      e.preventDefault();
      if (Store.user) openCommandPalette();
      return;
    }
    if (e.key === 'Escape' && _cpOpen) closeCommandPalette();
  });
}

function openCommandPalette() {
  if (_cpOpen) return;
  _cpOpen = true;
  _cpItems = [];
  _cpActive = 0;

  const overlay = document.createElement('div');
  overlay.className = 'cp-overlay';
  overlay.id = 'cp-overlay';
  overlay.innerHTML = `
    <div class="cp-panel">
      <div class="cp-input-row">
        ${ICONS.search}
        <input id="cp-input" class="cp-input" placeholder="Search projects, tasks, people…" autocomplete="off" />
        <span class="cp-esc">ESC</span>
      </div>
      <div id="cp-results" class="cp-results">
        <div class="cp-hint">Type to search across everything you have access to.</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCommandPalette(); });

  const input = document.getElementById('cp-input');
  input.focus();
  input.addEventListener('input', () => {
    clearTimeout(_cpDebounce);
    const q = input.value.trim();
    if (q.length < 2) {
      document.getElementById('cp-results').innerHTML = `<div class="cp-hint">Keep typing… (2+ characters)</div>`;
      _cpItems = [];
      return;
    }
    document.getElementById('cp-results').innerHTML = `<div class="cp-hint"><span class="spinner" style="width:14px;height:14px;border-width:2px;vertical-align:middle;margin-right:6px;"></span>Searching…</div>`;
    _cpDebounce = setTimeout(() => runCommandSearch(q), 180);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCpActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCpActive(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (_cpItems[_cpActive]) goToCpItem(_cpItems[_cpActive]); }
  });
}

function closeCommandPalette() {
  const el = document.getElementById('cp-overlay');
  if (el) el.remove();
  document.body.style.overflow = '';
  _cpOpen = false;
}

async function runCommandSearch(q) {
  let data;
  try {
    data = await API.search(q);
  } catch (e) {
    document.getElementById('cp-results').innerHTML = `<div class="cp-hint">Search failed: ${escapeHtml(e.message)}</div>`;
    return;
  }
  _cpItems = [];
  const groups = [];

  if (data.projects.length) {
    groups.push({ label: 'Projects', rows: data.projects.map((p) => {
      const item = { type: 'project', id: p.id, label: p.name, sub: `${labelize(p.status)} · ${labelize(p.priority)} priority`, badge: priorityBadge(p.priority) };
      _cpItems.push(item);
      return item;
    }) });
  }
  if (data.tasks.length) {
    groups.push({ label: 'Tasks', rows: data.tasks.map((t) => {
      const item = { type: 'task', id: t.id, projectId: t.project_id, label: t.title, sub: t.project_name || '', badge: statusBadge(t.status) };
      _cpItems.push(item);
      return item;
    }) });
  }
  if (data.users.length) {
    groups.push({ label: 'People', rows: data.users.map((u) => {
      const item = { type: 'user', id: u.id, label: u.name, sub: u.title || u.email, avatarUser: u };
      _cpItems.push(item);
      return item;
    }) });
  }

  if (_cpItems.length === 0) {
    document.getElementById('cp-results').innerHTML = emptyState('search', 'No results', 'Try a different search term.');
    return;
  }

  _cpActive = 0;
  let idx = -1;
  document.getElementById('cp-results').innerHTML = groups.map((g) => `
    <div class="cp-group-label">${g.label}</div>
    ${g.rows.map((item) => {
      idx++;
      return `
      <div class="cp-row" data-cp-index="${idx}">
        ${item.avatarUser ? avatarHtml(item.avatarUser, 'sm') : `<span class="cp-row-icon">${ICONS[item.type === 'project' ? 'projects' : 'tasks']}</span>`}
        <div class="cp-row-text"><div class="cp-row-title">${escapeHtml(item.label)}</div><div class="cp-row-sub">${escapeHtml(item.sub || '')}</div></div>
        ${item.badge || ''}
      </div>`;
    }).join('')}
  `).join('');

  document.querySelectorAll('.cp-row').forEach((row) => {
    row.onclick = () => goToCpItem(_cpItems[Number(row.dataset.cpIndex)]);
    row.onmouseenter = () => { _cpActive = Number(row.dataset.cpIndex); highlightCpActive(); };
  });
  highlightCpActive();
}

function moveCpActive(delta) {
  if (_cpItems.length === 0) return;
  _cpActive = (_cpActive + delta + _cpItems.length) % _cpItems.length;
  highlightCpActive();
}

function highlightCpActive() {
  document.querySelectorAll('.cp-row').forEach((row) => {
    const isActive = Number(row.dataset.cpIndex) === _cpActive;
    row.classList.toggle('active', isActive);
    if (isActive) row.scrollIntoView({ block: 'nearest' });
  });
}

function goToCpItem(item) {
  closeCommandPalette();
  if (item.type === 'project') location.hash = `#/projects/${item.id}`;
  else if (item.type === 'task') location.hash = `#/projects/${item.projectId}?task=${item.id}`;
  else if (item.type === 'user') location.hash = `#/users`;
}
