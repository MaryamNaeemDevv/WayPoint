'use strict';

function navConfigFor(role) {
  const base = [{ href: '#/dashboard', label: 'Dashboard', icon: 'dashboard', match: 'dashboard' }];
  if (role === 'ADMIN') {
    base.push(
      { href: '#/projects', label: 'Projects', icon: 'projects', match: 'projects' },
      { href: '#/tasks', label: 'All Tasks', icon: 'tasks', match: 'tasks' },
      { href: '#/calendar', label: 'Calendar', icon: 'calendar', match: 'calendar' },
      { href: '#/reports', label: 'Reports', icon: 'barChart', match: 'reports' },
      { href: '#/users', label: 'Users', icon: 'users', match: 'users' }
    );
  } else if (role === 'PROJECT_MANAGER') {
    base.push(
      { href: '#/projects', label: 'My Projects', icon: 'projects', match: 'projects' },
      { href: '#/tasks', label: 'All Tasks', icon: 'tasks', match: 'tasks' },
      { href: '#/calendar', label: 'Calendar', icon: 'calendar', match: 'calendar' },
      { href: '#/reports', label: 'Reports', icon: 'barChart', match: 'reports' }
    );
  } else {
    base.push(
      { href: '#/projects', label: 'My Projects', icon: 'projects', match: 'projects' },
      { href: '#/tasks', label: 'My Tasks', icon: 'tasks', match: 'tasks' },
      { href: '#/calendar', label: 'Calendar', icon: 'calendar', match: 'calendar' }
    );
  }
  return base;
}

function renderShell(innerHtml, opts) {
  opts = opts || {};
  const user = Store.user;
  const nav = navConfigFor(user.role);
  const active = opts.active || '';

  const navHtml = nav.map((n) => `
    <a href="${n.href}" class="nav-link ${active === n.match ? 'active' : ''}">
      ${ICONS[n.icon]}<span>${n.label}</span>
    </a>
  `).join('');

  return `
  <div class="shell">
    <div class="sidebar-scrim" id="sidebar-scrim"></div>
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-mark">${ICONS.route.replace('currentColor', '#fff')}</div>
        <div>
          <div class="brand-name">Waypoint</div>
          <div class="brand-sub">${ROLE_LABELS[user.role]}</div>
        </div>
      </div>
      <div class="nav-section-label">Menu</div>
      ${navHtml}
      <a href="#/notifications" class="nav-link ${active === 'notifications' ? 'active' : ''}">
        ${ICONS.bell}<span>Notifications</span>
        ${Store.unreadCount > 0 ? `<span class="nav-badge">${Store.unreadCount > 99 ? '99+' : Store.unreadCount}</span>` : ''}
      </a>
      <a href="#/profile" class="nav-link ${active === 'profile' ? 'active' : ''}">
        ${ICONS.profile}<span>My Profile</span>
      </a>
      <div class="sidebar-footer">
        <a href="#/profile" class="user-chip">
          ${avatarHtml(user)}
          <div>
            <div class="user-name">${escapeHtml(user.name)}</div>
            <div class="user-role">${escapeHtml(user.title || ROLE_LABELS[user.role])}</div>
          </div>
        </a>
        <button class="logout-btn" id="logout-btn">${ICONS.logout} Sign out</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="icon-btn mobile-nav-toggle" id="mobile-nav-toggle">${ICONS.menu}</button>
          <h1 class="topbar-title">${escapeHtml(opts.title || '')}</h1>
        </div>
        <div class="topbar-actions">
          ${opts.actionsHtml || ''}
          <button class="cp-trigger" id="cp-trigger-btn" aria-label="Search">
            ${ICONS.search}<span class="cp-trigger-label">Search</span><span class="cp-trigger-kbd">${navigator.platform.toUpperCase().includes('MAC') ? '⌘K' : 'Ctrl K'}</span>
          </button>
          <a href="#/notifications" class="icon-btn" aria-label="Notifications" style="position:relative;">
            ${ICONS.bell}
            ${Store.unreadCount > 0 ? `<span style="position:absolute;top:2px;right:2px;width:8px;height:8px;background:var(--red-600);border-radius:50%;border:1.5px solid var(--paper-100);"></span>` : ''}
          </a>
        </div>
      </div>
      <div class="content" id="page-content">
        ${innerHtml}
      </div>
    </div>
  </div>
  `;
}

function mountShellEvents() {
  const searchTrigger = document.getElementById('cp-trigger-btn');
  if (searchTrigger) searchTrigger.onclick = () => openCommandPalette();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.onclick = async () => {
    try { await API.logout(); } catch (e) {}
    Store.setUser(null);
    location.hash = '#/login';
  };
  const toggle = document.getElementById('mobile-nav-toggle');
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  if (toggle && sidebar) {
    toggle.onclick = () => { sidebar.classList.toggle('open'); scrim.classList.toggle('open'); };
    if (scrim) scrim.onclick = () => { sidebar.classList.remove('open'); scrim.classList.remove('open'); };
  }
}

async function refreshUnreadCount() {
  try {
    const { unread } = await API.notifications();
    Store.setUnread(unread);
  } catch (e) { /* ignore */ }
}
