import { eq } from 'drizzle-orm'
import { Elysia, file } from 'elysia'
import { node } from '@elysiajs/node'
import { db } from './db'
import { movies, genres, movieGenres } from './db/schema'
import * as fs from 'fs'
import { asc, desc } from 'drizzle-orm'
import { cookie } from '@elysiajs/cookie'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { users } from './db/schema' // you already import movies, add users too

import 'dotenv/config'; // loads .env into process.env

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const AUTH_COOKIE = 'auth'; // cookie name

// Sign a short JWT with user id/email
function signToken(payload: { id: number; email: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}


const app = new Elysia({ adapter: node() })
.use(cookie()) 

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
    // All movies (with sorting)
api.get('/movies', async ({ query }) => {
  // Read query params, e.g. /api/movies?sort=title&order=desc
  const sortParam = String(query?.sort ?? '').toLowerCase();   // 'title' | 'releasedate'
  const orderParam = String(query?.order ?? '').toLowerCase(); // 'asc' | 'desc'

  // Whitelist: map user input -> actual Drizzle column
  const column =
    sortParam === 'title'       ? movies.title :
    sortParam === 'releasedate' ? movies.releaseDate :
    movies.id; // fallback

  const directionAsc = orderParam !== 'desc'; // default asc

  const result = await db
    .select()
    .from(movies)
    .orderBy(directionAsc ? asc(column) : desc(column));

  return result;
});


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

  //
  // AUTH: /api/auth/register /api/auth/login /api/auth/me /api/auth/logout
  //
  api.post('/auth/register', async ({ body, set, setCookie }) => {
    // Validate input
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    });
    const result = schema.safeParse(body);
    if (!result.success) {
      set.status = 400;
      return { error: result.error.flatten() };
    }

    const { email, password } = result.data;

    // Check if user exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      set.status = 409;
      return { error: 'Email already in use' };
    }

// Hash and insert
const passwordHash = await bcrypt.hash(password, 12);

const [created] = await db
  .insert(users)
  .values({ email, passwordHash })
  .returning({ id: users.id, email: users.email });

// If something went wrong and no row was returned
if (!created) {
  set.status = 500;
  return { error: 'User insert failed' };
}

// Issue JWT + cookie
const token = signToken({ id: created.id, email: created.email });
setCookie(AUTH_COOKIE, token, {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  secure: false,            // set true in production behind HTTPS
});

return { id: created.id, email: created.email };


  });

  api.post('/auth/login', async ({ body, set, setCookie }) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const result = schema.safeParse(body);
    if (!result.success) {
      set.status = 400;
      return { error: result.error.flatten() };
    }

    const { email, password } = result.data;

    const [userRow] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!userRow) {
      set.status = 401;
      return { error: 'Invalid email or password' };
    }

    const ok = await bcrypt.compare(password, userRow.passwordHash);
    if (!ok) {
      set.status = 401;
      return { error: 'Invalid email or password' };
    }

    const token = signToken({ id: userRow.id, email: userRow.email });
    setCookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: false
    });

    return { id: userRow.id, email: userRow.email };
  });

  api.get('/auth/me', async ({ cookie, set }) => {
    const token = cookie[AUTH_COOKIE];
    if (!token) {
      set.status = 401;
      return { user: null };
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string; iat: number; exp: number };
      // Optional: re-fetch user to ensure it still exists
      const [userRow] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, payload.id))
        .limit(1);

      if (!userRow) {
        set.status = 401;
        return { user: null };
      }

      return { user: userRow };
    } catch {
      set.status = 401;
      return { user: null };
    }
  });

  api.post('/auth/logout', async ({ removeCookie }) => {
    removeCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  });

    return api
  })

  .listen(3000, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`)
  })
