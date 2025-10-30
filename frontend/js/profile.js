// frontend/js/profile.js
(async () => {
  // 1) Check session
  let me;
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    me = await res.json();
    if (!res.ok || !me?.user) {
      // Not logged in → go to login
      window.location.href = '/account.html';
      return;
    }
  } catch {
    // If the check fails, send to login
    window.location.href = '/account.html';
    return;
  }

  // 2) Fill UI with user info
  const email = me.user.email || '';
  const name = email.split('@')[0] || 'User';

  const avatar = document.getElementById('avatar');
  const nameEl = document.getElementById('name');
  const emailEl = document.getElementById('email');

  if (avatar) avatar.textContent = (name[0] || 'U').toUpperCase();
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;

  // 3) Logout button
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/'; // back to home after logout
    }
  });
})();
