'use strict';

const PUBLIC_ROUTES = ['login', 'register'];

function parseHash() {
  let hash = location.hash.slice(1) || '/dashboard';
  const [pathPart, queryPart] = hash.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) {
    queryPart.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { segments, query };
}

async function renderRoute() {
  const { segments, query } = parseHash();
  const root = segments[0] || 'dashboard';

  if (!Store.user && !PUBLIC_ROUTES.includes(root)) {
    location.hash = '#/login';
    return;
  }
  if (Store.user && PUBLIC_ROUTES.includes(root)) {
    location.hash = '#/dashboard';
    return;
  }

  const app = document.getElementById('app');

  if (root === 'login') { app.innerHTML = renderLoginPage(); mountLoginPage(); return; }
  if (root === 'register') { app.innerHTML = renderRegisterPage(); mountRegisterPage(); return; }

  // Authenticated app shell routes
  let title = 'Dashboard';
  let active = 'dashboard';
  let placeholder = loadingBlock();

  if (root === 'dashboard') { title = 'Dashboard'; active = 'dashboard'; }
  else if (root === 'projects' && segments[1]) { title = 'Project Workspace'; active = 'projects'; }
  else if (root === 'projects') { title = Store.user.role === 'ADMIN' ? 'All Projects' : 'My Projects'; active = 'projects'; }
  else if (root === 'tasks') { title = Store.user.role === 'TEAM_MEMBER' ? 'My Tasks' : 'All Tasks'; active = 'tasks'; }
  else if (root === 'users') {
    if (Store.user.role !== 'ADMIN') { location.hash = '#/dashboard'; return; }
    title = 'User Management'; active = 'users';
  }
  else if (root === 'notifications') { title = 'Notifications'; active = 'notifications'; }
  else if (root === 'profile') { title = 'My Profile'; active = 'profile'; }
  else if (root === 'calendar') { title = 'Calendar'; active = 'calendar'; }
  else if (root === 'reports') {
    if (Store.user.role === 'TEAM_MEMBER') { location.hash = '#/dashboard'; return; }
    title = 'Reports'; active = 'reports';
  }
  else { location.hash = '#/dashboard'; return; }

  app.innerHTML = renderShell(placeholder, { title, active });
  mountShellEvents();

  if (root === 'dashboard') await renderDashboardPage();
  else if (root === 'projects' && segments[1]) await renderProjectDetailPage(segments[1], query.task);
  else if (root === 'projects') await renderProjectsPage();
  else if (root === 'tasks') await renderTasksPage();
  else if (root === 'users') await renderUsersPage();
  else if (root === 'notifications') await renderNotificationsPage();
  else if (root === 'profile') await renderProfilePage();
  else if (root === 'calendar') await renderCalendarPage();
  else if (root === 'reports') await renderReportsPage();

  refreshUnreadCount();
}

window.addEventListener('hashchange', renderRoute);
