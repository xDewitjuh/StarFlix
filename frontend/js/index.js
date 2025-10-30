function main() {
  // 1) initial load (newest first by default)
  loadMovies('releaseDate', 'desc');

  // 2) hook up the dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      // values look like: "releaseDate-desc", "title-asc"
      const [sort, order] = sortSelect.value.split('-');
      loadMovies(sort, order);
    });
  }
}

main();

// ---- fetch + render helpers ----

async function loadMovies(sort = 'releaseDate', order = 'desc') {
  // Ask the backend to sort for us
  const res = await fetch(`/api/movies?sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`);
  const movies = await res.json();

  // Render the list
  renderMovies(movies);
}

function renderMovies(movies) {
  const movieListDiv = document.getElementById('movie-list');
  if (!movieListDiv) return;

  // Clear before re-rendering (important for when you change sorting)
  movieListDiv.innerHTML = '';

  for (const movie of movies) {
    // Link to the details page
    const movieLink = document.createElement('a');
    movieLink.className = 'movie';
    movieLink.href = `/moviepage.html?id=${movie.id}`;

    // NOTE: your backend uses "posterPath" (camelCase).
    // If you ever see broken posters, log movie and check the property name.
    const poster = movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : '/assets/poster-placeholder.png';

    movieLink.innerHTML = `
      <img src="${poster}" alt="${movie.title ?? 'Movie'}" loading="lazy" />
    `;

    movieListDiv.appendChild(movieLink);
  }
}
