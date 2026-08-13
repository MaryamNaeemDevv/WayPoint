'use strict';

let _usersCache = [];

async function renderUsersPage() {
  document.querySelector('.topbar-actions').innerHTML = `<button class="btn btn-primary" id="new-user-btn">${ICONS.plus} New User</button>` + document.querySelector('.topbar-actions').innerHTML;
  document.getElementById('page-content').innerHTML = loadingBlock();
  try {
    const { users } = await API.users();
    _usersCache = users;
  } catch (e) {
    document.getElementById('page-content').innerHTML = emptyState('alert', 'Could not load users', e.message);
    return;
  }
  renderUsersTable();
  document.getElementById('new-user-btn').onclick = () => openUserModal();
}

function renderUsersTable() {
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ICONS.search}<input class="input" id="u-search" placeholder="Search users..." /></div>
      <select class="select-sm" id="u-role">
        <option value="">All roles</option>
        <option value="ADMIN">Administrator</option>
        <option value="PROJECT_MANAGER">Project Manager</option>
        <option value="TEAM_MEMBER">Team Member</option>
      </select>
      <select class="select-sm" id="u-status">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
    </div>
    <div id="u-table"></div>
  `;
  ['u-search', 'u-role', 'u-status'].forEach((id) => document.getElementById(id).addEventListener('input', filterUsersTable));
  filterUsersTable();
}

function filterUsersTable() {
  const q = (document.getElementById('u-search').value || '').toLowerCase().trim();
  const role = document.getElementById('u-role').value;
  const status = document.getElementById('u-status').value;
  let list = _usersCache.filter((u) => {
    if (role && u.role !== role) return false;
    if (status && u.status !== status) return false;
    if (q && !(u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))) return false;
    return true;
  });
  const wrap = document.getElementById('u-table');
  if (list.length === 0) { wrap.innerHTML = emptyState('users', 'No users found', 'Try adjusting your search or filters.'); return; }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>User</th><th>Role</th><th>Title</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody>
          ${list.map((u) => `
            <tr>
              <td><div style="display:flex;align-items:center;gap:9px;">${avatarHtml(u, 'sm')}<div><div style="font-weight:600;">${escapeHtml(u.name)}</div><div class="text-faint" style="font-size:11.5px;">${escapeHtml(u.email)}</div></div></div></td>
              <td>${ROLE_LABELS[u.role]}</td>
              <td class="text-muted">${escapeHtml(u.title || '—')}</td>
              <td>${u.status === 'ACTIVE' ? '<span class="status-badge st-COMPLETED">Active</span>' : '<span class="status-badge st-CANCELLED">Suspended</span>'}</td>
              <td class="text-faint">${fmtDate(u.created_at)}</td>
              <td>
                <div style="display:flex;gap:4px;justify-content:flex-end;">
                  <button class="icon-btn" data-edit="${u.id}" title="Edit">${ICONS.edit}</button>
                  ${u.id !== Store.user.id ? `<button class="icon-btn" data-delete="${u.id}" title="Delete">${ICONS.trash}</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  wrap.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => openUserModal(_usersCache.find((u) => u.id === Number(btn.dataset.edit)));
  });
  wrap.querySelectorAll('[data-delete]').forEach((btn) => {
    const u = _usersCache.find((x) => x.id === Number(btn.dataset.delete));
    btn.onclick = () => confirmDialog(
      `Delete ${u.name}? This removes their account and unassigns them from any tasks or projects.`,
      async () => { await API.deleteUser(u.id); toast('User deleted.', 'success'); await renderUsersPage(); },
      { danger: true, confirmLabel: 'Delete User' }
    );
  });
}

function openUserModal(existing) {
  const isEdit = !!existing;
  openModal({
    title: isEdit ? 'Edit User' : 'Create New User',
    bodyHtml: `
      <form id="user-form" novalidate>
        <div class="field">
          <label for="u-name">Full name</label>
          <input class="input" id="u-name" value="${existing ? escapeHtml(existing.name) : ''}" />
          <div class="error-text" id="err-u-name"></div>
        </div>
        <div class="field">
          <label for="u-email">Email address</label>
          <input class="input" type="email" id="u-email" value="${existing ? escapeHtml(existing.email) : ''}" />
          <div class="error-text" id="err-u-email"></div>
        </div>
        <div class="field">
          <label for="u-title">Job title</label>
          <input class="input" id="u-title" value="${existing ? escapeHtml(existing.title || '') : ''}" placeholder="e.g. Backend Developer" />
        </div>
        <div class="form-row">
          <div class="field">
            <label for="u-role">Role</label>
            <select class="input" id="u-role-sel">
              <option value="TEAM_MEMBER" ${existing && existing.role === 'TEAM_MEMBER' ? 'selected' : ''}>Team Member</option>
              <option value="PROJECT_MANAGER" ${existing && existing.role === 'PROJECT_MANAGER' ? 'selected' : ''}>Project Manager</option>
              <option value="ADMIN" ${existing && existing.role === 'ADMIN' ? 'selected' : ''}>Administrator</option>
            </select>
          </div>
          <div class="field">
            <label for="u-status-sel">Status</label>
            <select class="input" id="u-status-sel" ${!isEdit ? 'disabled' : ''}>
              <option value="ACTIVE" ${!existing || existing.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
              <option value="SUSPENDED" ${existing && existing.status === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="u-password">${isEdit ? 'Reset password (optional)' : 'Password'}</label>
          <input class="input" type="password" id="u-password" placeholder="${isEdit ? 'Leave blank to keep current password' : 'At least 6 characters'}" />
          <div class="error-text" id="err-u-password"></div>
        </div>
        <div class="error-text" id="err-u-general"></div>
      </form>
    `,
    footerHtml: `<button class="btn btn-secondary" id="u-cancel">Cancel</button><button class="btn btn-primary" id="u-save">${isEdit ? 'Save Changes' : 'Create User'}</button>`,
    onMount: () => {
      document.getElementById('u-cancel').onclick = () => closeModal();
      document.getElementById('u-save').onclick = async () => {
        ['u-name', 'u-email', 'u-password', 'u-general'].forEach((id) => fieldError(`err-${id}`, ''));
        const name = document.getElementById('u-name').value.trim();
        const email = document.getElementById('u-email').value.trim();
        const password = document.getElementById('u-password').value;
        let valid = true;
        if (!name) { fieldError('err-u-name', 'Name is required.'); valid = false; }
        if (!email) { fieldError('err-u-email', 'Email is required.'); valid = false; }
        if (!isEdit && (!password || password.length < 6)) { fieldError('err-u-password', 'Password must be at least 6 characters.'); valid = false; }
        if (isEdit && password && password.length < 6) { fieldError('err-u-password', 'Password must be at least 6 characters.'); valid = false; }
        if (!valid) return;

        const btn = document.getElementById('u-save');
        btn.disabled = true;
        try {
          if (isEdit) {
            const payload = { name, email, title: document.getElementById('u-title').value.trim(), role: document.getElementById('u-role-sel').value, status: document.getElementById('u-status-sel').value };
            if (password) payload.password = password;
            await API.updateUser(existing.id, payload);
            toast('User updated.', 'success');
          } else {
            await API.createUser({ name, email, password, title: document.getElementById('u-title').value.trim(), role: document.getElementById('u-role-sel').value });
            toast('User created.', 'success');
          }
          closeModal();
          await renderUsersPage();
        } catch (e) {
          fieldError('err-u-general', e.message);
          btn.disabled = false;
        }
      };
    },
  });
}
