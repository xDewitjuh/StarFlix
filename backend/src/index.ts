import { Elysia, file } from 'elysia'
import { node } from '@elysiajs/node'
import { db } from './db'
import { movies } from './db/schema'
import * as fs from 'fs'

const app = new Elysia({ adapter: node() })
    // serve our frontend
    .get('/*', ({ params, status }) => {
        if (fs.existsSync(`../frontend/${params['*']}`)&& !fs.lstatSync(`../frontend/${params['*']}`).isDirectory()) {
            return file(`../frontend/${params['*']}`)
        } else if (params['*'] === '' || params['*'].endsWith('/')) {
            return file(`../frontend/index.html`)
        }
        throw status(404, 'NOT_FOUND')
    })
    // Serve the API on /api
    .group('/api', (api) => {
        api.get('/movies', async () => {
            const result = await db.select().from(movies)
            return result
        })
        return api
    })
    .listen(3000, ({ hostname, port }) => {
        console.log(
            `🦊 Elysia is running at ${hostname}:${port}`
        )
    })