import { eq } from 'drizzle-orm'
import { Elysia, file } from 'elysia'
import { node } from '@elysiajs/node'
import { db } from './db'
import { movies, genres, movieGenres } from './db/schema'
import * as fs from 'fs'

const app = new Elysia({ adapter: node() })

  // Serve the frontend
  .get('/*', ({ params, status }) => {
    const path = `../frontend/${params['*']}`
    if (fs.existsSync(path) && !fs.lstatSync(path).isDirectory()) {
      return file(path)
    } else if (params['*'] === '' || params['*'].endsWith('/')) {
      return file('../frontend/index.html')
    }
    throw status(404, 'NOT_FOUND')
  })

  // Serve the API on /api
  .group('/api', (api) => {
    // All movies
    api.get('/movies', async () => {
      const result = await db.select().from(movies)
      return result
    })

    // One movie by id — WITH GENRES
    api.get('/movies/:id', async ({ params, set }) => {
      const id = Number(params.id)
      if (!Number.isFinite(id)) {
        set.status = 400
        return { error: 'Invalid movie id' }
      }

      // 1) the movie itself
      const rows = await db.select().from(movies).where(eq(movies.id, id)).limit(1)
      const movie = rows[0]
      if (!movie) {
        set.status = 404
        return { error: 'Movie not found' }
      }

      // 2) its genres via the junction table
      const genreRows = await db
        .select({ name: genres.name })
        .from(movieGenres)
        .leftJoin(genres, eq(movieGenres.genreId, genres.id))
        .where(eq(movieGenres.movieId, id))

      const genreNames = genreRows.map(g => g.name).filter(Boolean)

      // 3) return movie + genres array
      return { ...movie, genres: genreNames }
    })

    return api
  })

  .listen(3000, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`)
  })
