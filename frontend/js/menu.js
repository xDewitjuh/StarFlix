// frontend/js/menu.js
(() => {
  const drawer = document.getElementById('app-drawer');
  const overlay = drawer?.querySelector('.drawer__overlay');
  const panel   = drawer?.querySelector('.drawer__panel');
  const closeBtn = drawer?.querySelector('.drawer__close');
  const listLinks = [...drawer?.querySelectorAll('.drawer__link') || []];

  const opener = document.getElementById('menu-button');

  if (!drawer || !opener) return;

  // Track previous focus to return to it on close
  let lastFocused = null;

  function openDrawer() {
    lastFocused = document.activeElement;
    document.body.classList.add('body--lock-scroll');
    drawer.classList.add('drawer--open');
    drawer.setAttribute('aria-hidden', 'false');
    opener.setAttribute('aria-expanded', 'true');

    // Focus the first focusable element inside the panel
    const focusable = panel.querySelector('button, a, [tabindex]:not([tabindex="-1"])');
    (focusable || closeBtn || panel).focus();
  }

  function closeDrawer() {
    document.body.classList.remove('body--lock-scroll');
    drawer.classList.remove('drawer--open');
    drawer.setAttribute('aria-hidden', 'true');
    opener.setAttribute('aria-expanded', 'false');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  // Open/close handlers
  opener.addEventListener('click', openDrawer);
  overlay?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('drawer--open')) {
      e.preventDefault();
      closeDrawer();
    }
  });

  // Close when clicking a real navigation link
  listLinks.forEach((el) => {
    if (el.tagName === 'A') {
      el.addEventListener('click', () => closeDrawer());
    }
  });

  // Mark current page
  const here = location.pathname.replace(/\/+$/, '') || '/';
  listLinks.forEach((el) => {
    const route = el.getAttribute('data-route');
    if (!route) return;
    const norm = route.replace(/\/+$/, '') || '/';
    if (norm === here) {
      el.setAttribute('aria-current', 'page');
    }
  });
})();
