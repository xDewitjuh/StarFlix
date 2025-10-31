// frontend/js/moviepage.js
(function () {
  function getId() {
    return new URLSearchParams(location.search).get('id');
  }
  const $ = (id) => document.getElementById(id);

  async function api(path, options) {
    try {
      const res = await fetch(path, { credentials: 'include', ...(options || {}) });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      return { res, data, text };
    } catch (e) {
      console.error('[API error]', e);
      return { res: { ok: false, status: 0 }, data: null, text: null };
    }
  }

  // --- Favourites helpers ---
  async function getFavorites() {
    const { res, data } = await api('/api/favorites');
    if (!res.ok) return new Set();                // not logged in or error
    const list = Array.isArray(data?.favorites) ? data.favorites : [];
    return new Set(list);
  }

  async function addFavorite(movieId) {
    return api('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId })
    });
  }

  async function removeFavorite(movieId) {
    return api(`/api/favorites/${movieId}`, { method: 'DELETE' });
  }

  function setFavButtonState(btn, active) {
    if (!btn) return;
    btn.classList.toggle('active', !!active);
    btn.textContent = active ? '❤' : '♡';
  }

  async function init() {
    const idStr = getId();
    const id = idStr ? Number(idStr) : NaN;
    const titleEl = $('movie-title');
    const overviewEl = $('movie-overview');
    const releaseEl = $('movie-release');
    const posterEl = $('movie-poster');
    const genresEl = $('movie-genres');
    const favBtn = $('fav-btn');

    if (!Number.isFinite(id)) {
      if (titleEl) titleEl.textContent = 'Movie not found';
      return;
    }

    // Load movie
    const { res, data: movie } = await api(`/api/movies/${id}`);
    if (!res.ok || !movie) {
      if (titleEl) titleEl.textContent = 'Movie not found';
      return;
    }

    // Render
    if (titleEl) titleEl.textContent = movie.title ?? 'Untitled';
    if (overviewEl) overviewEl.textContent = movie.description ?? 'No description available.';
    if (releaseEl) releaseEl.textContent = movie.releaseDate ? `Release date: ${movie.releaseDate}` : '';

    const posterSrc = movie.posterPath
      ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
      : '/assets/poster-placeholder.png';
    if (posterEl) posterEl.src = posterSrc;

    if (genresEl && Array.isArray(movie.genres)) {
      genresEl.innerHTML = '';
      movie.genres.forEach((g) => {
        const chip = document.createElement('span');
        chip.className = 'genre-chip';
        chip.textContent = g;
        genresEl.appendChild(chip);
      });
    }

    // --- Favourite button: set initial state from API + click to toggle ---
    if (favBtn) {
      let favorites = await getFavorites();       // Set() of ids (if not logged in => empty)
      setFavButtonState(favBtn, favorites.has(id));

      favBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const willActivate = !favBtn.classList.contains('active');
        // optimistic UI
        setFavButtonState(favBtn, willActivate);

        try {
          if (willActivate) {
            const { res } = await addFavorite(id);
            if (!res.ok) throw res;
            favorites.add(id);
          } else {
            const { res } = await removeFavorite(id);
            if (!res.ok) throw res;
            favorites.delete(id);
          }
        } catch (err) {
          // revert on failure
          setFavButtonState(favBtn, !willActivate);
          if (err && err.status === 401) {
            alert('Please sign in to use favourites.');
            location.href = '/account.html';
          } else {
            alert('Could not update favourites. Please try again.');
          }
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

// ---- Watch button toggle (copy/paste) ----
(function initWatchButton() {
  const btn = document.getElementById('watch-btn');
  if (!btn) return;

  const labelEl = btn.querySelector('.label') || btn;

  // Get movieId from query (?id=123)
  const params = new URLSearchParams(location.search);
  const movieId = Number(params.get('id'));
  if (!Number.isFinite(movieId)) {
    btn.disabled = true;
    return;
  }

  let inFlight = false;

  const setState = (watched) => {
    btn.classList.toggle('is-watched', watched);
    btn.setAttribute('aria-pressed', watched ? 'true' : 'false');
    if (labelEl) labelEl.textContent = watched ? 'Watched' : 'Mark as watched';
  };

  // Initial state: is this movie in the user's history?
  const loadState = async () => {
    try {
      const res = await fetch('/api/history', { credentials: 'include' });
      if (!res.ok) return setState(false);
      const data = await res.json(); // { history: number[] }
      const watched = Array.isArray(data?.history) && data.history.includes(movieId);
      setState(watched);
    } catch {
      setState(false);
    }
  };

  btn.addEventListener('click', async () => {
    if (inFlight) return;
    const wasWatched = btn.classList.contains('is-watched');

    // Optimistic UI
    setState(!wasWatched);
    inFlight = true;

    try {
      let res;
      if (wasWatched) {
        // UNDO → remove from history
        res = await fetch(`/api/history/${movieId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
      } else {
        // ADD to history
        res = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ movieId })
        });
      }

      if (!res.ok) throw new Error(`history toggle failed ${res.status}`);
    } catch (err) {
      console.error(err);
      // Roll back UI on failure
      setState(wasWatched);
      if (err?.status === 401) location.href = '/account.html';
    } finally {
      inFlight = false;
    }
  });

  loadState();
})();
