'use strict';

function routeGraphicHtml() {
  return `
  <svg width="100%" height="90" viewBox="0 0 360 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 70 C 90 70, 90 20, 160 20 S 270 70, 340 70" stroke="#3D4370" stroke-width="2" stroke-dasharray="1 8" stroke-linecap="round"/>
    <circle cx="20" cy="70" r="6" fill="#3452FF"/>
    <circle cx="160" cy="20" r="6" fill="#7C4DFF"/>
    <circle cx="340" cy="70" r="6" fill="#16A085"/>
  </svg>`;
}

function renderAuthShell(formHtml) {
  return `
  <div class="auth-shell">
    <div class="auth-hero">
      <div class="auth-hero-content">
        <div class="brand-mark" style="width:38px;height:38px;">${ICONS.route.replace('currentColor', '#fff')}</div>
        <h1>Plan the route. Track every waypoint. Ship the project.</h1>
        <p>Waypoint is a project management &amp; collaboration platform built for software teams — assign work, follow progress task by task, and keep every discussion attached to the work it belongs to.</p>
      </div>
      <div>
        ${routeGraphicHtml()}
        <p style="font-size:12px;color:#6E739B;">Administrators plan the route · Project Managers steer each leg · Team Members move the work forward</p>
      </div>
    </div>
    <div class="auth-form-side">
      <div class="auth-card">${formHtml}</div>
    </div>
  </div>`;
}

function renderLoginPage() {
  return renderAuthShell(`
    <h2>Welcome back</h2>
    <p class="sub">Sign in to your Waypoint workspace.</p>
    <form id="login-form" novalidate>
      <div class="field">
        <label for="login-email">Email address</label>
        <input class="input" type="email" id="login-email" autocomplete="email" placeholder="you@company.com" />
        <div class="error-text" id="err-login-email"></div>
      </div>
      <div class="field">
        <label for="login-password">Password</label>
        <input class="input" type="password" id="login-password" autocomplete="current-password" placeholder="••••••••" />
        <div class="error-text" id="err-login-password"></div>
      </div>
      <div class="error-text" id="err-login-general" style="margin-bottom:10px;"></div>
      <button class="btn btn-primary btn-block" id="login-submit" type="submit">Sign in</button>
    </form>
    <div class="auth-switch">New to Waypoint? <a href="#/register">Create an account</a></div>
    <div class="demo-creds">
      <b>Demo accounts</b> (seeded):<br/>
      Admin — admin@taskflow.dev / admin123<br/>
      Project Manager — hamza.pm@taskflow.dev / password123<br/>
      Team Member — bilal@taskflow.dev / password123
    </div>
  `);
}

function renderRegisterPage() {
  return renderAuthShell(`
    <h2>Create your account</h2>
    <p class="sub">Self-registration creates a Team Member account. Ask your administrator for Project Manager or Admin access.</p>
    <form id="register-form" novalidate>
      <div class="field">
        <label for="reg-name">Full name</label>
        <input class="input" type="text" id="reg-name" autocomplete="name" placeholder="Jane Doe" />
        <div class="error-text" id="err-reg-name"></div>
      </div>
      <div class="field">
        <label for="reg-email">Email address</label>
        <input class="input" type="email" id="reg-email" autocomplete="email" placeholder="you@company.com" />
        <div class="error-text" id="err-reg-email"></div>
      </div>
      <div class="field">
        <label for="reg-password">Password</label>
        <input class="input" type="password" id="reg-password" autocomplete="new-password" placeholder="At least 6 characters" />
        <div class="error-text" id="err-reg-password"></div>
      </div>
      <div class="error-text" id="err-reg-general" style="margin-bottom:10px;"></div>
      <button class="btn btn-primary btn-block" id="register-submit" type="submit">Create account</button>
    </form>
    <div class="auth-switch">Already have an account? <a href="#/login">Sign in</a></div>
  `);
}

function mountLoginPage() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['login-email', 'login-general'].forEach((id) => fieldError(`err-${id}`, ''));
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    let valid = true;
    if (!email) { fieldError('err-login-email', 'Email is required.'); valid = false; }
    if (!password) { fieldError('err-login-password', 'Password is required.'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="border-color: rgba(255,255,255,.4); border-top-color:#fff;"></span>';
    try {
      const { user } = await API.login(email, password);
      Store.setUser(user);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      fieldError('err-login-general', err.message);
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}

function mountRegisterPage() {
  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['reg-name', 'reg-email', 'reg-password', 'reg-general'].forEach((id) => fieldError(`err-${id}`, ''));
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    let valid = true;
    if (!name) { fieldError('err-reg-name', 'Name is required.'); valid = false; }
    if (!email) { fieldError('err-reg-email', 'Email is required.'); valid = false; }
    if (!password || password.length < 6) { fieldError('err-reg-password', 'Password must be at least 6 characters.'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('register-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="border-color: rgba(255,255,255,.4); border-top-color:#fff;"></span>';
    try {
      const { user } = await API.register(name, email, password);
      Store.setUser(user);
      toast(`Welcome to Waypoint, ${user.name.split(' ')[0]}!`, 'success');
      location.hash = '#/dashboard';
    } catch (err) {
      fieldError('err-reg-general', err.message);
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}
