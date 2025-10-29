// /frontend/js/signup.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('[signup.js] loaded');

  const form    = document.getElementById('signup-form');
  const email   = document.getElementById('email');
  const pass    = document.getElementById('password');
  const confirm = document.getElementById('confirm');
  const hint    = document.getElementById('auth-hint');
  const submit  = document.getElementById('auth-submit');
  const showPw  = document.getElementById('show-password');

  // HARD STOP if any element is missing (will show in console)
  for (const [name, el] of Object.entries({ form, email, pass, confirm, hint, submit })) {
    if (!el) { console.error(`[signup.js] Missing element: ${name}`); }
  }

  const MIN_LEN = 8;

  function setHint(text) {
    hint.textContent = text || '';
  }

  function validate() {
    let msg = '';

    if (!email.value.trim()) {
      msg = 'Please enter your email.';
    } else if (!email.checkValidity()) {
      msg = 'Please enter a valid email address.';
    } else if (pass.value.length < MIN_LEN) {
      msg = `Password must be at least ${MIN_LEN} characters.`;
    } else if (pass.value !== confirm.value) {
      msg = 'Passwords do not match.';
    }

    setHint(msg);
    submit.disabled = !!msg;
  }

  // show/hide both fields
  showPw?.addEventListener('change', (e) => {
    const type = e.target.checked ? 'text' : 'password';
    pass.type = type;
    confirm.type = type;
  });

  // live validation
  email.addEventListener('input', validate);
  pass.addEventListener('input', validate);
  confirm.addEventListener('input', validate);

  // initial state (you should see this immediately)
  setHint('Passwords must match and be at least 8 characters.');
  submit.disabled = true;

  // prevent real submit for now
  form.addEventListener('submit', (e) => {
    validate();
    if (submit.disabled) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    alert('Sign-up OK (frontend). Next step: hook to /api/auth/register.');
  });
});
