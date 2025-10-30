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
      window.location.href = '/';
    }
  });

  // 4) Favorites section
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  if (!grid) return; // no favorites section in HTML

  // 4a) Get favorite IDs
  let favIds = [];
  try {
    const res = await fetch('/api/favorites', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      favIds = Array.isArray(data?.favorites) ? data.favorites : [];
    }
  } catch (e) {
    console.error('Failed to load favorites', e);
  }

  if (!favIds.length) {
    if (empty) empty.hidden = false;
    return;
  }

  // 4b) Fetch each movie and render a small card
  // (Simple approach; later we can optimize with a bulk endpoint)
  const cards = await Promise.all(
    favIds.map(async (id) => {
      try {
        const r = await fetch(`/api/movies/${id}`);
        if (!r.ok) throw new Error('bad movie');
        const movie = await r.json();

        const a = document.createElement('a');
        a.href = `/moviepage.html?id=${movie.id}`;
        a.className = 'fav-card';
        a.title = movie.title ?? 'Movie';

        const img = document.createElement('img');
        const posterSrc = movie.posterPath
          ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
          : '/assets/poster-placeholder.png';
        img.src = posterSrc;
        img.alt = movie.title ?? 'Poster';
        img.loading = 'lazy';

        const caption = document.createElement('div');
        caption.className = 'fav-card-caption';
        caption.textContent = movie.title ?? 'Untitled';

        a.appendChild(img);
        a.appendChild(caption);
        return a;
      } catch (e) {
        console.warn('Skipping movie id', id, e);
        return null;
      }
    })
  );

  for (const c of cards) if (c) grid.appendChild(c);
})();
