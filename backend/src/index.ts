import { eq } from 'drizzle-orm'
import { Elysia, file } from 'elysia'
import { node } from '@elysiajs/node'
import { db } from './db'
import { movies } from './db/schema'
import * as fs from 'fs'

const app = new Elysia({ adapter: node() })
    // serve our frontend
    .get('/*', ({ params, status }) => {
        if (fs.existsSync(`../frontend/${params['*']}`) && !fs.lstatSync(`../frontend/${params['*']}`).isDirectory()) {
            return file(`../frontend/${params['*']}`)
        } else if (params['*'] === '' || params['*'].endsWith('/')) {
            return file(`../frontend/index.html`)
        }
        throw status(404, 'NOT_FOUND')
    })
    .group('/api', (api) => {
        // 1) All movies
        api.get('/movies', async () => {
            const result = await db.select().from(movies)
            return result
        })

  api.get('/movies/:id', async ({ params, set }) => {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      set.status = 400
      return { error: 'Invalid movie id' }
    }

        const rows = await db.select().from(movies).where(eq(movies.id, id)).limit(1)
    const movie = rows[0]
    if (!movie) {
      set.status = 404
      return { error: 'Movie not found' }
    }
    return movie
  })

  // Serve the API on /api
.group('/api', (api) => {
  // 1) ALL movies
  api.get('/movies', async () => {
    const result = await db.select().from(movies)
    return result
  })

  // 2) ONE movie by id
  api.get('/movies/:id', async ({ params, set }) => {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      set.status = 400
      return { error: 'Invalid movie id' }
    }

    const rows = await db
      .select()
      .from(movies)
      .where(eq(movies.id, id))
      .limit(1)

    const movie = rows[0]
    if (!movie) {
      set.status = 404
      return { error: 'Movie not found' }
    }
    return movie
  })

  return api
})


            return api
        })
            .listen(3000, ({ hostname, port }) => {
                console.log(
                    `🦊 Elysia is running at ${hostname}:${port}`
                )
            })