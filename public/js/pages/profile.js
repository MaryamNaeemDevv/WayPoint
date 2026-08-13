'use strict';

async function renderProfilePage() {
  const u = Store.user;
  const el = document.getElementById('page-content');
  el.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
          ${avatarHtml(u, 'lg')}
          <div>
            <div style="font-weight:700;font-size:16px;">${escapeHtml(u.name)}</div>
            <div class="text-faint" style="font-size:12.5px;">${ROLE_LABELS[u.role]}</div>
          </div>
        </div>
        <form id="profile-form" novalidate>
          <div class="field">
            <label for="pf-name">Full name</label>
            <input class="input" id="pf-name" value="${escapeHtml(u.name)}" />
            <div class="error-text" id="err-pf-name"></div>
          </div>
          <div class="field">
            <label for="pf-title">Job title</label>
            <input class="input" id="pf-title" value="${escapeHtml(u.title || '')}" placeholder="e.g. Frontend Developer" />
          </div>
          <div class="field">
            <label for="pf-email">Email address</label>
            <input class="input" id="pf-email" value="${escapeHtml(u.email)}" disabled />
            <div class="hint">Contact an administrator to change your email.</div>
          </div>
          <div class="error-text" id="err-pf-general" style="margin-bottom:10px;"></div>
          <button class="btn btn-primary" type="submit" id="pf-save">Save Changes</button>
        </form>
      </div>
      <div class="card">
        <div class="section-title"><h2>Change Password</h2></div>
        <form id="password-form" novalidate>
          <div class="field">
            <label for="pw-new">New password</label>
            <input class="input" type="password" id="pw-new" placeholder="At least 6 characters" />
            <div class="error-text" id="err-pw-new"></div>
          </div>
          <div class="field">
            <label for="pw-confirm">Confirm new password</label>
            <input class="input" type="password" id="pw-confirm" placeholder="Repeat new password" />
            <div class="error-text" id="err-pw-confirm"></div>
          </div>
          <div class="error-text" id="err-pw-general" style="margin-bottom:10px;"></div>
          <button class="btn btn-secondary" type="submit" id="pw-save">Update Password</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    fieldError('err-pf-name', ''); fieldError('err-pf-general', '');
    const name = document.getElementById('pf-name').value.trim();
    if (!name) { fieldError('err-pf-name', 'Name is required.'); return; }
    const btn = document.getElementById('pf-save');
    btn.disabled = true;
    try {
      const { user } = await API.updateUser(u.id, { name, title: document.getElementById('pf-title').value.trim() });
      Store.setUser({ ...Store.user, ...user });
      toast('Profile updated.', 'success');
    } catch (err) {
      fieldError('err-pf-general', err.message);
    } finally { btn.disabled = false; }
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    fieldError('err-pw-new', ''); fieldError('err-pw-confirm', ''); fieldError('err-pw-general', '');
    const p1 = document.getElementById('pw-new').value;
    const p2 = document.getElementById('pw-confirm').value;
    let valid = true;
    if (!p1 || p1.length < 6) { fieldError('err-pw-new', 'Password must be at least 6 characters.'); valid = false; }
    if (p1 !== p2) { fieldError('err-pw-confirm', 'Passwords do not match.'); valid = false; }
    if (!valid) return;
    const btn = document.getElementById('pw-save');
    btn.disabled = true;
    try {
      await API.updateUser(u.id, { password: p1 });
      toast('Password updated.', 'success');
      document.getElementById('password-form').reset();
    } catch (err) {
      fieldError('err-pw-general', err.message);
    } finally { btn.disabled = false; }
  });
}
