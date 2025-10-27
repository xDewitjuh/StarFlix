function main() {
    initializeMovieList();
}

main();

async function initializeMovieList() {
    const response = await fetch('/api/movies');
    const movies = await response.json();
    console.log(movies);
    const movieListDiv = document.getElementById('movie-list');

    for (const movie of movies) {
        const movieLink = document.createElement('a');
        movieLink.className = 'movie';
        movieLink.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${movie.posterPath}" />
        `;
        movieLink.href = `/moviepage.html?id=${movie.id}`;

        movieListDiv.appendChild(movieLink);
    }
}
