// frontend/js/favorites.js
(function () {
  const KEY = 'starflix:favorites';

  function loadSet() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      return new Set(arr.filter(Number.isFinite));
    } catch { return new Set(); }
  }
  function saveSet(set) {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  }

  let favSet = loadSet();

  function upsertHeart(card) {
    if (!(card instanceof Element)) return;
    const id = Number(card.getAttribute('data-movie-id'));
    if (!Number.isFinite(id)) return;

    // Make sure card can position the heart
    if (getComputedStyle(card).position === 'static') {
      card.style.position = 'relative';
    }

    let btn = card.querySelector(':scope > .fav-btn');
    const active = favSet.has(id);

    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fav-btn';
      btn.setAttribute('aria-label', 'Toggle favorite');
      card.appendChild(btn);
    }

    btn.classList.toggle('active', active);
    btn.textContent = active ? '❤' : '♡';

    if (!btn._wired) {
      btn._wired = true;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = !btn.classList.contains('active');
        btn.classList.toggle('active', next);
        btn.textContent = next ? '❤' : '♡';
        if (next) favSet.add(id); else favSet.delete(id);
        saveSet(favSet);
      });
    }
  }

  function enhanceAll() {
    document.querySelectorAll('[data-movie-id]').forEach(upsertHeart);
  }

  // Initial pass
  enhanceAll();

  // Watch for dynamically added cards
  const mo = new MutationObserver((records) => {
    for (const rec of records) {
      rec.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.hasAttribute?.('data-movie-id')) upsertHeart(n);
        n.querySelectorAll?.('[data-movie-id]')?.forEach(upsertHeart);
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Expose helper if you want to call it after your own renders
  window.enhanceFavorite = (el, id) => {
    if (el && id) el.setAttribute('data-movie-id', String(id));
    upsertHeart(el);
  };
})();
