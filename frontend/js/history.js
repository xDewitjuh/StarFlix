// frontend/js/history.js
(async () => {
  // Redirect to login if not authenticated
  try {
    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    const me = await meRes.json();
    if (!me?.user) {
      window.location.href = '/account.html';
      return;
    }
  } catch {
    window.location.href = '/account.html';
    return;
  }

  const listEl =
    document.getElementById('hist-list') ||
    document.getElementById('history-list'); // allow either id
  const emptyEl =
    document.getElementById('hist-empty') ||
    document.getElementById('history-empty');

  if (!listEl) {
    console.warn('history.js: container not found');
    return;
  }

  // 1) Fetch list of watched movie IDs
  let ids = [];
  try {
    const res = await fetch('/api/history', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch /api/history');
    const data = await res.json(); // expects { history: number[] }
    ids = Array.isArray(data?.history) ? data.history : [];
  } catch (err) {
    console.error(err);
    ids = [];
  }

  if (!ids.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  // 2) Resolve each id to a movie object
  const movies = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await fetch(`/api/movies/${id}`);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    })
  );

  // 3) Render cards (same visual structure as favorites)
  listEl.innerHTML = '';
  for (const mv of movies.filter(Boolean)) {
    const card = document.createElement('article');
    card.className = 'fav-card';

    const wrap = document.createElement('div');
    wrap.className = 'fav-card-wrap';

    const a = document.createElement('a');
    a.className = 'fav-card-link';
    a.href = `/moviepage.html?id=${mv.id}`;

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = mv.title ?? '';
    img.src = mv.posterUrl || mv.poster_path || mv.poster || mv.image || '';
    a.appendChild(img);

    const cap = document.createElement('div');
    cap.className = 'fav-card-caption';
    cap.textContent = mv.title ?? '';

    wrap.appendChild(a);
    wrap.appendChild(cap);
    card.appendChild(wrap);
    listEl.appendChild(card);
  }
})();
