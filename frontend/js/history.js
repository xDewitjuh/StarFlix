// frontend/js/history.js
(async () => {
  const grid = document.getElementById('history-list');
  const emptyMsg = document.getElementById('history-empty');

  if (!grid || !emptyMsg) return;

  // small helper to make elements
  const el = (tag, cls, children) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (children) {
      if (Array.isArray(children)) children.forEach(c => n.appendChild(c));
      else if (typeof children === 'string') n.textContent = children;
      else n.appendChild(children);
    }
    return n;
  };

  try {
    // 1) get the list of watched movie IDs
    const res = await fetch('/api/history', { credentials: 'include' });
    // if not logged in, show empty message but keep page usable
    if (res.status === 401) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'Please sign in to view your watch history.';
      return;
    }

    const data = await res.json();
    const ids = Array.isArray(data?.history) ? data.history : [];

    if (!ids.length) {
      emptyMsg.hidden = false;
      return;
    }

    // 2) fetch movie details in parallel
    const details = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`/api/movies/${id}`);
          if (!r.ok) throw new Error('bad movie response');
          return await r.json();
        } catch {
          return null;
        }
      })
    );

    // 3) render cards
    details
      .filter(Boolean)
      .forEach((movie) => {
        // expected fields: id, title, posterUrl (adapt if your field names differ)
        const link = el('a', 'fav-card-link');
        link.href = `/moviepage.html?id=${movie.id}`;
        link.title = movie.title || 'Movie';

        const img = new Image();
        img.loading = 'lazy';
        img.alt = movie.title || 'Movie poster';
        img.src = movie.posterUrl || movie.poster || '/assets/poster-fallback.png';

        const caption = el('div', 'fav-card-caption', movie.title || 'Untitled');
        const wrap = el('div', 'fav-card-wrap', [link]);

        link.appendChild(img);
        wrap.appendChild(caption);

        const card = el('article', 'fav-card', wrap);
        grid.appendChild(card);
      });

  } catch (err) {
    console.error('Failed to load history:', err);
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Could not load your watch history.';
  }
})();
