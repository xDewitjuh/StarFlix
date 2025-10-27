// frontend/js/moviepage.js
(function () {
  function getId() {
    return new URLSearchParams(location.search).get('id');
  }
  const $ = (id) => document.getElementById(id);

  async function api(path) {
    // Helper to log and fetch
    console.log('[API] →', path);
    const res = await fetch(path);
    const text = await res.text(); // safer than res.json() for error cases
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    console.log('[API] status', res.status, 'data', data ?? text);
    return { res, data };
  }

  async function init() {
    const id = getId();
    const titleEl = $('movie-title');
    const overviewEl = $('movie-overview');
    const releaseEl = $('movie-release');
    const posterEl = $('movie-poster');

    if (!id) {
      if (titleEl) titleEl.textContent = 'Movie not found';
      return;
    }

    const { res, data: movie } = await api(`/api/movies/${id}`);

    if (!res.ok || !movie) {
      if (titleEl) titleEl.textContent = 'Movie not found';
      return;
    }

    // Render safely
    if (titleEl) titleEl.textContent = movie.title ?? 'Untitled';
    if (overviewEl) overviewEl.textContent = movie.description ?? 'No description available.';
    if (releaseEl) releaseEl.textContent = movie.releaseDate ? `Release date: ${movie.releaseDate}` : '';

    const posterSrc = movie.posterPath
      ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
      : '/assets/poster-placeholder.png'; // optional placeholder
    if (posterEl) posterEl.src = posterSrc;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
