document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q')?.trim();
  const resultsEl = document.getElementById('search-results');
  const emptyEl = document.getElementById('search-empty');
  const titleEl = document.getElementById('search-title');

  if (!query) {
    titleEl.textContent = 'Please enter a search term.';
    emptyEl.hidden = false;
    return;
  }

  titleEl.textContent = `Results for "${query}"`;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
    const data = await res.json();

    resultsEl.innerHTML = '';

    if (!Array.isArray(data.results) || data.results.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    data.results.forEach((movie) => {
      const card = document.createElement('a');
      card.href = `/moviepage.html?id=${movie.id}`;
      card.className = 'movie-card';

      const img = document.createElement('img');
      img.src = movie.posterPath
        ? `https://image.tmdb.org/t/p/w500${movie.posterPath}`
        : '/assets/poster-placeholder.png';
      img.alt = movie.title;

      const title = document.createElement('h3');
      title.textContent = movie.title;

      card.appendChild(img);
      card.appendChild(title);
      resultsEl.appendChild(card);
    });
  } catch (err) {
    console.error('Search failed', err);
    emptyEl.hidden = false;
  }
});
