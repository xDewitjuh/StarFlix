// frontend/js/moviepage.js

// ---------------------------------------------------------------------------
// Basic helpers (shared)
// ---------------------------------------------------------------------------
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

  // expose for other IIFEs in this file
  window.api = api;
  window.$ = $;
  window.getId = getId;

  // --- Favourites helpers ---
  async function getFavorites() {
    const { res, data } = await api('/api/favorites');
    if (!res.ok) return new Set(); // not logged in or error
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

    // Favourite button
    if (favBtn) {
      let favorites = await getFavorites(); // Set() of ids (if not logged in => empty)
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

// ---------------------------------------------------------------------------
// Watch button toggle
// ---------------------------------------------------------------------------
(function initWatchButton() {
  const btn = document.getElementById('watch-btn');
  if (!btn) return;

  const labelEl = btn.querySelector('.label') || btn;

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
        res = await fetch(`/api/history/${movieId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
      } else {
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

// ---------------------------------------------------------------------------
// Reviews (list + create/upsert + delete) – tolerant to API shapes
// ---------------------------------------------------------------------------
(async function setupReviews() {
  const params = new URLSearchParams(location.search);
  const movieId = Number(params.get('id'));
  if (!Number.isFinite(movieId)) return;

  const form   = document.getElementById('review-form');
  const textEl = document.getElementById('review-text');
  const hint   = document.getElementById('review-login-hint');
  const list   = document.getElementById('reviews-list');
  const count  = document.getElementById('reviews-count');

  // Check session
  let me = null;
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    const d = await r.json();
    if (r.ok && d?.user) me = d.user;
  } catch {}

  if (me) {
    if (form) form.hidden = false;
    if (hint) hint.hidden = true;
  } else {
    if (form) form.hidden = true;
    if (hint) hint.hidden = false;
  }

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString(); }
    catch { return ''; }
  };

  // Normalize a review from different backend shapes into a consistent shape
  function normalizeReview(rev) {
    return {
      id: rev.id,
      userId: rev.userId ?? rev.author?.id ?? rev.authorId,
      email: rev.email ?? rev.author?.email ?? rev.user?.email ?? 'User',
      text: rev.reviewText ?? rev.text ?? '',
      createdAt: rev.createdAt,
      updatedAt: rev.updatedAt,
      isMine: !!(
        (me && rev.userId === me?.id) ||
        (me && rev.author?.isMe === true)
      )
    };
  }

  function renderReview(revRaw) {
    const rev = normalizeReview(revRaw);

    const card = document.createElement('article');
    card.className = 'review-card';

    const meta = document.createElement('div');
    meta.className = 'review-meta';

    const who = document.createElement('span');
    who.className = 'review-user';
    who.textContent = rev.email || 'User';

    const when = document.createElement('span');
    when.className = 'review-date';
    when.textContent = ' • ' + fmtDate(rev.updatedAt || rev.createdAt);

    meta.appendChild(who);
    meta.appendChild(when);

    // Delete button for own review
    if (rev.isMine) {
      const actions = document.createElement('div');
      actions.className = 'review-actions';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'review-delete';
      del.textContent = 'Delete';

      del.addEventListener('click', async () => {
        if (!confirm('Delete your review?')) return;

        // Try route that deletes your review for the movie (no id needed)
        let ok = false;
        try {
          const r1 = await fetch(`/api/movies/${movieId}/reviews`, {
            method: 'DELETE',
            credentials: 'include'
          });
          if (r1.status === 401) {
            location.href = '/account.html';
            return;
          }
          if (r1.ok) ok = true;
          // fallback to id-based route if 404 / not found
          if (!ok && rev.id != null) {
            const r2 = await fetch(`/api/reviews/${rev.id}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            if (r2.ok) ok = true;
          }
        } catch {}

        if (!ok) {
          alert('Could not delete review.');
          return;
        }
        await loadReviews(); // refresh inline
      });

      actions.appendChild(del);
      meta.appendChild(actions);
    }

    const body = document.createElement('div');
    body.className = 'review-body';
    body.textContent = rev.text;

    card.appendChild(meta);
    card.appendChild(body);
    return card;
  }

  async function loadReviews() {
    try {
      const r = await fetch(`/api/movies/${movieId}/reviews`, { credentials: 'include' });
      const d = await r.json();
      const reviews = Array.isArray(d?.reviews) ? d.reviews : [];

      if (count) count.textContent = String(reviews.length);
      if (list) {
        list.innerHTML = '';
        reviews.forEach((rev) => list.appendChild(renderReview(rev)));
      }
    } catch (e) {
      console.error('Failed to load reviews', e);
    }
  }

  await loadReviews();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!me) {
      location.href = '/account.html';
      return;
    }
    const text = (textEl?.value || '').trim();
    if (!text) return;

    try {
      const r = await fetch(`/api/movies/${movieId}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (r.status === 401) {
        location.href = '/account.html';
        return;
      }
      if (!r.ok) {
        const msg = (await r.text()) || 'Could not post review.';
        alert(msg);
        return;
      }

      if (textEl) textEl.value = '';
      await loadReviews(); // show immediately
    } catch (e) {
      console.error('Failed to post review', e);
    }
  });
})();

