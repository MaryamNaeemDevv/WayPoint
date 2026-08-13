'use strict';

const NOTIF_ICON = {
  TASK_ASSIGNED: 'tasks', PROJECT_ASSIGNED: 'projects', ADDED_TO_PROJECT: 'users',
  TASK_STATUS_CHANGED: 'check', NEW_DISCUSSION: 'message', DEADLINE_APPROACHING: 'alert',
};

async function renderNotificationsPage() {
  document.querySelector('.topbar-actions').innerHTML = `<button class="btn btn-secondary" id="mark-all-read">${ICONS.check} Mark all read</button>` + document.querySelector('.topbar-actions').innerHTML;
  document.getElementById('page-content').innerHTML = loadingBlock();
  let notifications;
  try {
    const data = await API.notifications();
    notifications = data.notifications;
    Store.setUnread(data.unread);
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load notifications', e.message);
    return;
  }

  const el = document.getElementById('page-content');
  el.innerHTML = notifications.length === 0
    ? emptyState('bell', 'You\'re all caught up', 'New task assignments, discussion replies, and deadline reminders will show up here.')
    : `<div class="card" style="padding:0;overflow:hidden;">${notifications.map(notifItemHtml).join('')}</div>`;

  el.querySelectorAll('[data-notif-id]').forEach((row) => {
    row.onclick = async () => {
      const id = row.dataset.notifId;
      const n = notifications.find((x) => String(x.id) === id);
      if (n && !n.read) {
        try { await API.markRead(id); } catch (e) {}
        n.read = 1;
        row.classList.remove('unread');
      }
      if (n && n.link) location.hash = n.link.replace('#', '');
    };
  });

  document.getElementById('mark-all-read').onclick = async () => {
    try {
      await API.markAllRead();
      toast('All notifications marked as read.', 'success');
      await renderNotificationsPage();
    } catch (e) { toast(e.message, 'error'); }
  };
}

function notifItemHtml(n) {
  return `
  <div class="notif-item ${!n.read ? 'unread' : ''}" data-notif-id="${n.id}">
    <div class="notif-dot ${n.read ? 'read' : ''}"></div>
    <div style="flex:1;">
      <div style="font-size:13px;">${escapeHtml(n.message)}</div>
      <div class="text-faint" style="font-size:11.5px;margin-top:3px;">${fmtDateTime(n.created_at)}</div>
    </div>
  </div>`;
}
