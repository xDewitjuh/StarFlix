// frontend/js/profile.js
(async () => {
  // Guard: if not logged in, send to login
  const meRes = await fetch('/api/auth/me', { credentials: 'include' });
  const me = await meRes.json().catch(() => ({}));

  if (!meRes.ok || !me?.user) {
    window.location.href = '/account.html';
    return;
  }

  // Show email
  const emailEl = document.getElementById('profile-email');
  if (emailEl) emailEl.textContent = me.user.email || '(unknown)';

  // Sign out
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/account.html';
  });
})();
