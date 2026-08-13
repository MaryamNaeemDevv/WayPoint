'use strict';

/* ---------- Icons (inline SVG, stroke-based, consistent 24x24 viewBox) ---------- */
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H15"/></svg>',
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.33 3.33 0 0 1 4.71 4.71l-9.2 9.19a1.67 1.67 0 0 1-2.35-2.35l8.49-8.48"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-4"/></svg>',
  commandKey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6"/></svg>',
};
function icon(name, cls) { return `<span class="${cls || ''}">${ICONS[name] || ''}</span>`; }

/* ---------- Toast ---------- */
function toast(message, type) {
  type = type || 'info';
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'inbox';
  el.innerHTML = `${icon(iconName)}<span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    el.style.transition = 'all 200ms ease';
    setTimeout(() => el.remove(), 200);
  }, 3800);
}

/* ---------- Modal ---------- */
function openModal({ title, bodyHtml, footerHtml, large, onMount, onClose }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.innerHTML = `
    <div class="modal ${large ? 'modal-lg' : ''}">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="icon-btn" id="modal-close-btn" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(onClose); });
  document.getElementById('modal-close-btn').addEventListener('click', () => closeModal(onClose));
  const escHandler = (e) => { if (e.key === 'Escape') { closeModal(onClose); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  if (onMount) onMount(overlay);
  return overlay;
}
function closeModal(onClose) {
  const existing = document.getElementById('active-modal');
  if (existing) {
    existing.remove();
    document.body.style.overflow = '';
    if (onClose) onClose();
  }
}

function confirmDialog(message, onConfirm, opts) {
  opts = opts || {};
  openModal({
    title: opts.title || 'Please confirm',
    bodyHtml: `<p style="font-size:13.5px;color:var(--text-600);line-height:1.6;">${escapeHtml(message)}</p>`,
    footerHtml: `
      <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
      <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${escapeHtml(opts.confirmLabel || 'Confirm')}</button>
    `,
    onMount: () => {
      document.getElementById('confirm-cancel').onclick = () => closeModal();
      document.getElementById('confirm-ok').onclick = async () => {
        const btn = document.getElementById('confirm-ok');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="border-color: rgba(255,255,255,.4); border-top-color:#fff; width:14px;height:14px;"></span>';
        try {
          await onConfirm();
          closeModal();
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false;
          btn.textContent = opts.confirmLabel || 'Confirm';
        }
      };
    },
  });
}

/* ---------- Small render helpers ---------- */
function avatarHtml(user, size) {
  const cls = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar';
  const color = user?.avatar_color || user?.avatarColor || '#6366f1';
  return `<div class="${cls}" style="background:${color}">${initials(user?.name || user?.user_name || '?')}</div>`;
}

function priorityBadge(p) {
  return `<span class="badge pri-${p}"><span class="badge-dot"></span>${labelize(p)}</span>`;
}

function statusBadge(s) {
  return `<span class="status-badge st-${s}">${labelize(s)}</span>`;
}

function projectStatusBadge(s) {
  return `<span class="status-badge st-${s}">${labelize(s)}</span>`;
}

function waypointTrack(status) {
  const order = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
  const idx = order.indexOf(status);
  let html = '<div class="waypoint-track" title="' + labelize(status) + '">';
  order.forEach((s, i) => {
    const passed = i <= idx;
    const isDone = status === 'COMPLETED';
    html += `<div class="waypoint-node ${passed ? (isDone ? 'done' : 'filled') : ''}"></div>`;
    if (i < order.length - 1) {
      const linePassed = i < idx;
      html += `<div class="waypoint-line ${linePassed ? (isDone ? 'done' : 'filled') : ''}"></div>`;
    }
  });
  html += '</div>';
  return html;
}

function dueTag(dateStr, status) {
  if (!dateStr) return '<span class="due-tag">No due date</span>';
  const d = daysUntil(dateStr);
  if (status === 'COMPLETED') return `<span class="due-tag">${icon('calendar')}${fmtDate(dateStr)}</span>`;
  if (d < 0) return `<span class="due-tag overdue">${icon('calendar')}Overdue · ${fmtDate(dateStr)}</span>`;
  if (d <= 2) return `<span class="due-tag soon">${icon('calendar')}Due ${d === 0 ? 'today' : d + 'd'}</span>`;
  return `<span class="due-tag">${icon('calendar')}${fmtDate(dateStr)}</span>`;
}

function emptyState(iconName, title, desc) {
  return `<div class="empty-state">${icon(iconName)}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>`;
}

function loadingBlock() {
  return `<div class="loading-center"><div class="spinner lg"></div></div>`;
}

function fieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}
