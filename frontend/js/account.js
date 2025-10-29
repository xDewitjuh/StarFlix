// frontend/js/account.js

console.log('[account.js] loaded');

const form = document.getElementById('login-form');
const email = document.getElementById('email');
const pwd = document.getElementById('password');
const toggle = document.getElementById('toggle-password');

// Show / hide password
toggle?.addEventListener('change', (e) => {
  if (pwd) pwd.type = e.target.checked ? 'text' : 'password';
});

// POST → /api/auth/login
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!email?.value || !pwd?.value) {
    alert('Please enter email and password.');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: pwd.value })
    });

    if (res.ok) {
      // server sets auth cookie; we can redirect anywhere
      alert('Signed in!');
      window.location.href = '/'; // go to home (or movie page)
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      alert('Invalid email or password.');
    } else if (data?.error) {
      alert(`Login failed: ${JSON.stringify(data.error)}`);
    } else {
      alert(`Login failed (${res.status}).`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error while logging in.');
  }
});
