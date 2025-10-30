// frontend/js/session.js
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json(); // { user } or { user: null }

    // Your existing user icon link has id="account-link"
    const accountLink = document.getElementById('account-link');
    if (!accountLink) return; // nothing to do

    if (data?.user) {
      // logged in → send them to profile when they click the avatar
      accountLink.href = '/profile.html';
      accountLink.title = data.user.email || 'Profile';
    } else {
      // logged out → link to login
      accountLink.href = '/account.html';
      accountLink.title = 'Sign in';
    }
  } catch (e) {
    console.warn('[session] auth check failed', e);
  }
})();
