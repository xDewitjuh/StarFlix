// frontend/js/favorites.js
(async () => {
  // Redirect to login if not authenticated
  try {
    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    const me = await meRes.json();
    if (!meRes.ok || !me?.user) {
      location.href = '/account.html';
      return;
    }
  } catch {
    location.href = '/account.html';
    return;
  }

  const list = document.getElementById('fav-list');
  const empty = document.getElementById('fav-empty');
  if (!list) return;

  // Load favorite IDs
  let favIds = [];
  try {
    const r = await fetch('/api/favorites', { credentials: 'include' });
    if (r.ok) {
      const data = await r.json();
      favIds = Array.isArray(data?.favorites) ? data.favorites : [];
    }
  } catch (e) {
    console.error('Failed to load favorites', e);
  }

  if (!favIds.length) {
    if (empty) empty.hidden = false;
    return;
  }

  // Build cards
  const fragment = document.createDocumentFragment();

  for (const id of favIds) {
    try {
      const r = await fetch(`/api/movies/${id}`);
      if (!r.ok) continue;
      const m = await r.json();

      const card = document.createElement('article');
      card.className = 'fav-card';

      const link = document.createElement('a');
      link.href = `/moviepage.html?id=${m.id}`;
      link.className = 'fav-card-link';
      link.title = m.title ?? 'Movie';

      const img = document.createElement('img');
      img.src = m.posterPath
        ? `https://image.tmdb.org/t/p/w500${m.posterPath}`
        : '/assets/poster-placeholder.png';
      img.alt = m.title ?? 'Poster';
      img.loading = 'lazy';

      const caption = document.createElement('div');
      caption.className = 'fav-card-caption';
      caption.textContent = m.title ?? 'Untitled';

      link.appendChild(img);
      link.appendChild(caption);

      // Heart button (same UI cue, used here to remove)
      const btn = document.createElement('button');
      btn.className = 'fav-btn active';        // already a favorite
      btn.setAttribute('aria-label', 'Remove from favorites');
      btn.title = 'Remove from favorites';
      btn.textContent = '❤';

      // position heart in top-right of the card
      const wrap = document.createElement('div');
      wrap.className = 'fav-card-wrap';
      wrap.appendChild(link);
      wrap.appendChild(btn);

      // click to unfavorite
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const del = await fetch(`/api/favorites/${m.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          if (del.status === 401) {
            location.href = '/account.html';
            return;
          }
          if (del.ok) {
            card.remove();
            // if none left, show empty message
            if (!list.querySelector('.fav-card')) {
              if (empty) empty.hidden = false;
            }
          }
        } catch (err) {
          console.error('Unfavorite failed', err);
        }
      });

      card.appendChild(wrap);
      fragment.appendChild(card);
    } catch (e) {
      console.warn('Skipping movie id', id, e);
    }
  }

  list.appendChild(fragment);
})();
