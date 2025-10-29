// frontend/js/signup.js

console.log('[signup.js] loaded');

const form = document.getElementById('signup-form');
const email = document.getElementById('email');
const pwd = document.getElementById('password');
const confirmPwd = document.getElementById('confirm');
const toggle = document.getElementById('toggle-password');

// Show / hide password fields
toggle?.addEventListener('change', (e) => {
  const type = e.target.checked ? 'text' : 'password';
  if (pwd) pwd.type = type;
  if (confirmPwd) confirmPwd.type = type;
});

// Client-side checks + POST → /api/auth/register
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!email?.value || !pwd?.value || !confirmPwd?.value) {
    alert('Please fill in all fields.');
    return;
  }
  if (pwd.value.length < 8) {
    alert('Password must be at least 8 characters.');
    return;
  }
  if (pwd.value !== confirmPwd.value) {
    alert('Passwords do not match.');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: pwd.value })
    });

    if (res.ok) {
      // cookie is set by server on success
      alert('Account created! You are now signed in.');
      window.location.href = '/account.html'; // or '/' if you prefer
      return;
    }

    // Try to read server error
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      alert('Email already in use');
    } else if (data?.error) {
      alert(`Sign-up failed: ${JSON.stringify(data.error)}`);
    } else {
      alert(`Sign-up failed (${res.status}).`);
    }
  } catch (err) {
    console.error(err);
    alert('Network error while creating account.');
  }
});
