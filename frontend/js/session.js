(async () => {
  const accountLink = document.getElementById('account-link');
  if (!accountLink) return;

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();

    if (data?.user) {
      // Logged in
      accountLink.href = '/profile.html';
      accountLink.title = data.user.email || 'Profile';

      // Remove existing img if any
      const img = accountLink.querySelector('img');
      if (img) img.remove();

      // Create the avatar circle
      const initial = document.createElement('div');
      initial.textContent = data.user.email.charAt(0).toUpperCase();
      initial.className = 'nav-avatar';
      accountLink.appendChild(initial);

    } else {
      // Logged out
      accountLink.href = '/account.html';
      accountLink.title = 'Sign in';

      // Remove avatar if present
      const avatar = accountLink.querySelector('.nav-avatar');
      if (avatar) avatar.remove();

      // Ensure default icon is visible
      if (!accountLink.querySelector('img')) {
        const img = document.createElement('img');
        img.src = '/assets/account-icon.png';
        img.alt = 'Account Icon';
        accountLink.appendChild(img);
      }
    }
  } catch (err) {
    console.error('Error checking session:', err);
  }
})();
