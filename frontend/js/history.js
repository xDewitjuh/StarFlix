// --- login gate for history.html ---
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data?.user) {
      // Not logged in → go to sign-in
      window.location.href = '/account.html';
      return; // stop running the rest of this file
    }
  } catch {
    // On any error, treat as logged-out
    window.location.href = '/account.html';
    return;
  }
})();


document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('fav-list');      // same as favorites
  const emptyMsg  = document.getElementById('fav-empty');     // same as favorites

  if (!container) {
    console.error('history.js: #fav-list not found');
    return;
  }

  // Helper: resolve a usable poster URL from various possible field names
  function resolvePoster(movie) {
    // Try common field names you might have in your API/UI
    const p =
      movie.poster_path ??
      movie.posterPath ??
      movie.poster_url ??
      movie.posterUrl ??
      movie.poster ??
      null;

    // Nothing at all → local placeholder
    if (!p) return '/assets/poster-fallback.jpg';

    // Absolute URL → use as-is
    if (typeof p === 'string' && /^https?:\/\//i.test(p)) return p;

    // TMDB-style relative path (e.g. "/nBRra0xY...jpg")
    if (typeof p === 'string' && p.startsWith('/')) {
      return `https://image.tmdb.org/t/p/w342${p}`;
    }

    // Any other string → try it directly
    return p;
  }

  // Helper: build one card (identical structure to favorites)
  function renderCard(movie) {
    const article = document.createElement('article');
    article.className = 'fav-card';

    const wrap = document.createElement('div');
    wrap.className = 'fav-card-wrap';

    const link = document.createElement('a');
    link.className = 'fav-card-link';
    link.href = `/moviepage.html?id=${movie.id}`;
    link.title = movie.title;

    const img = document.createElement('img');
    img.src = resolvePoster(movie);
    img.alt = movie.title;
    img.loading = 'lazy';

    const caption = document.createElement('div');
    caption.className = 'fav-card-caption';
    caption.textContent = movie.title;

    link.appendChild(img);
    wrap.appendChild(link);
    wrap.appendChild(caption);
    article.appendChild(wrap);
    return article;
  }

  try {
    // 1) Get the user’s watch history (list of movie IDs)
    const res = await fetch('/api/history', { credentials: 'include' });
    if (!res.ok) {
      // Not logged in or server returned error → show empty
      emptyMsg?.removeAttribute('hidden');
      return;
    }
    const { history } = await res.json();

    if (!Array.isArray(history) || history.length === 0) {
      emptyMsg?.removeAttribute('hidden');
      return;
    }

    // 2) Fetch all movies in parallel
    const movies = await Promise.all(
      history.map(async (id) => {
        try {
          const r = await fetch(`/api/movies/${id}`);
          if (!r.ok) throw new Error(`Movie ${id} not found`);
          return await r.json();
        } catch (e) {
          console.warn('history.js: movie fetch failed', id, e);
          return null;
        }
      })
    );

    // 3) Render cards
    const valid = movies.filter(Boolean);
    if (valid.length === 0) {
      emptyMsg?.removeAttribute('hidden');
      return;
    }

    // Clear just in case and append
    container.innerHTML = '';
    valid.forEach((movie) => container.appendChild(renderCard(movie)));
    emptyMsg?.setAttribute('hidden', 'hidden');
  } catch (err) {
    console.error('history.js:', err);
    emptyMsg?.removeAttribute('hidden');
  }
});
