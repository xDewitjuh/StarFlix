// frontend/js/profile.js
(async () => {
  // Fetch current user
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));

  if (!data || !data.user) {
    // not signed in -> go to sign in
    window.location.href = '/account.html';
    return;
  }

  const email = data.user.email;
  const name = email.split('@')[0]; // simple label from email

  // Fill UI
  const avatar = document.getElementById('avatar');
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');

  nameEl.textContent = name;
  emailEl.textContent = email;
  avatar.textContent = (name[0] || 'U').toUpperCase();

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    window.location.href = '/';
  });
})();
