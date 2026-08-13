'use strict';

(async function bootstrap() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading-center" style="height:100vh;"><div class="spinner lg"></div></div>`;
  try {
    const { user } = await API.me();
    Store.setUser(user);
  } catch (e) {
    Store.setUser(null);
  }
  await renderRoute();
  initCommandPalette();

  // Poll unread notification count periodically while the app is open
  setInterval(() => { if (Store.user) refreshUnreadCount(); }, 30000);
})();
