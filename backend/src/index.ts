import { eq } from 'drizzle-orm'
import { Elysia, file } from 'elysia'
import { node } from '@elysiajs/node'
import { db } from './db'
import { movies, genres, movieGenres } from './db/schema'
import * as fs from 'fs'
import { asc, desc } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { users } from './db/schema' // keep users + movies imports
import 'dotenv/config' // loads .env into process.env
import { favorites } from './db/schema';
import { and } from 'drizzle-orm';


// -------------------------------------------------------------------------
// Auth constants + helpers
// -------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const AUTH_COOKIE = 'auth' // cookie name

// Sign a short JWT with user id/email
function signToken(payload: { id: number; email: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function requireUserId(cookie: Record<string, string | undefined>, set: any): number | null {
  const token = cookie[AUTH_COOKIE];
  if (!token) {
    set.status = 401;
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    return payload.id;
  } catch {
    set.status = 401;
    return null;
  }
}

// Minimal cookie helpers (replace cookie plugin)
function setCookieHeader(
  set: any,
  name: string,
  value: string,
  options: { maxAge?: number } = {}
) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
    // Do not force Secure in dev; set in prod behind HTTPS
  ]
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
  const cookie = parts.join('; ')
  set.headers = { ...(set.headers ?? {}), 'Set-Cookie': cookie }
}

function clearCookieHeader(set: any, name: string) {
  const cookie = `${name}=; Path=/; Max-Age=0`
  set.headers = { ...(set.headers ?? {}), 'Set-Cookie': cookie }
}

function getCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(';').map(s => s.trim())
  for (const p of pairs) {
    const [k, ...rest] = p.split('=')
    if (k === name) return rest.join('=')
  }
  return null
}

// Read user id from the request's Cookie header (no cookie plugin needed)
function requireUserIdFromRequest(request: Request, set: any): number | null {
  const raw = request.headers.get('cookie');
  const token = getCookieFromHeader(raw, AUTH_COOKIE);
  if (!token) {
    set.status = 401;
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    return payload.id;
  } catch {
    set.status = 401;
    return null;
  }
}


// -------------------------------------------------------------------------
// App
// -------------------------------------------------------------------------
const app = new Elysia({ adapter: node() })

// Serve the frontend
app.get('/*', ({ params, status }) => {
  const path = `../frontend/${params['*']}`
  if (fs.existsSync(path) && !fs.lstatSync(path).isDirectory()) {
    return file(path)
  } else if (params['*'] === '' || params['*'].endsWith('/')) {
    return file('../frontend/index.html')
  }
  throw status(404, 'NOT_FOUND')
})

// Serve the API on /api
app.group('/api', (api) => {
  // -----------------------------------------------------------------------
  // Movies list (with sorting)  <-- unchanged logic
  // -----------------------------------------------------------------------
  api.get('/movies', async ({ query }) => {
    const sortParam = String(query?.sort ?? '').toLowerCase()   // 'title' | 'releasedate'
    const orderParam = String(query?.order ?? '').toLowerCase() // 'asc' | 'desc'

    const column =
      sortParam === 'title'       ? movies.title :
      sortParam === 'releasedate' ? movies.releaseDate :
      movies.id // fallback

    const directionAsc = orderParam !== 'desc' // default asc

    const result = await db
      .select()
      .from(movies)
      .orderBy(directionAsc ? asc(column) : desc(column))

    return result
  })

  // -----------------------------------------------------------------------
  // One movie by id WITH GENRES  <-- unchanged logic
  // -----------------------------------------------------------------------
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

    const genreRows = await db
      .select({ name: genres.name })
      .from(movieGenres)
      .leftJoin(genres, eq(movieGenres.genreId, genres.id))
      .where(eq(movieGenres.movieId, id))

    const genreNames = genreRows.map(g => g.name).filter(Boolean)

    return { ...movie, genres: genreNames }
  })

  // -----------------------------------------------------------------------
  // AUTH: register / login / me / logout
  // (Only cookie handling changed to header helpers)
  // -----------------------------------------------------------------------

  api.post('/auth/register', async ({ body, set }) => {
    // Validate input
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    })
    const result = schema.safeParse(body)
    if (!result.success) {
      set.status = 400
      return { error: result.error.flatten() }
    }

    const { email, password } = result.data

    // Check if user exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      set.status = 409
      return { error: 'Email already in use' }
    }

    // Hash and insert
    const passwordHash = await bcrypt.hash(password, 12)
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email })

    if (!created) {
      set.status = 500
      return { error: 'User insert failed' }
    }

    // Issue JWT + cookie
    const token = signToken({ id: created.id, email: created.email })
    setCookieHeader(set, AUTH_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 }) // 7 days

    return { id: created.id, email: created.email }
  })

  api.post('/auth/login', async ({ body, set }) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    })
    const result = schema.safeParse(body)
    if (!result.success) {
      set.status = 400
      return { error: result.error.flatten() }
    }

    const { email, password } = result.data

    const [userRow] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (!userRow) {
      set.status = 401
      return { error: 'Invalid email or password' }
    }

    const ok = await bcrypt.compare(password, userRow.passwordHash)
    if (!ok) {
      set.status = 401
      return { error: 'Invalid email or password' }
    }

    const token = signToken({ id: userRow.id, email: userRow.email })
    setCookieHeader(set, AUTH_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 })

    return { id: userRow.id, email: userRow.email }
  })

  // No cookie plugin — parse cookie header manually
  api.get('/auth/me', async ({ request, set }) => {
    const raw = request.headers.get('cookie')
    const token = getCookieFromHeader(raw, AUTH_COOKIE)
    if (!token) {
      set.status = 401
      return { user: null }
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string; iat: number; exp: number }

      // Optional re-check that user still exists
      const [userRow] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, payload.id))
        .limit(1)

      if (!userRow) {
        set.status = 401
        return { user: null }
      }

      return { user: userRow }
    } catch {
      set.status = 401
      return { user: null }
    }
  })

  api.post('/auth/logout', async ({ set }) => {
    clearCookieHeader(set, AUTH_COOKIE)
    return { ok: true }
  })

// -------------------------------------------------------------------------
// FAVORITES
// -------------------------------------------------------------------------

// GET /api/favorites  -> list of movieIds the user has favorited
api.get('/favorites', async ({ request, set }) => {
  const userId = requireUserIdFromRequest(request, set);
  if (!userId) return { favorites: [] };

  const rows = await db
    .select({ movieId: favorites.movieId })
    .from(favorites)
    .where(eq(favorites.userId, userId));

  return { favorites: rows.map(r => r.movieId) };
});

// POST /api/favorites  body: { movieId: number }
// Adds a favorite (no error if it already exists)
api.post('/favorites', async ({ request, body, set }) => {
  const userId = requireUserIdFromRequest(request, set);
  if (!userId) return { ok: false };

  const schema = z.object({ movieId: z.number() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    set.status = 400;
    return { ok: false, error: parsed.error.flatten() };
  }

  const { movieId } = parsed.data;

  await db
    .insert(favorites)
    .values({ userId, movieId })
    .onConflictDoNothing({ target: [favorites.userId, favorites.movieId] });

  return { ok: true };
});

// DELETE /api/favorites/:movieId
api.delete('/favorites/:movieId', async ({ request, params, set }) => {
  const userId = requireUserIdFromRequest(request, set);
  if (!userId) return { ok: false };

  const movieId = Number(params.movieId);
  if (!Number.isFinite(movieId)) {
    set.status = 400;
    return { ok: false, error: 'Invalid movieId' };
  }

  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.movieId, movieId)));

  return { ok: true };
});


  return api
})

.listen(3000, ({ hostname, port }) => {
  console.log(`🦊 Elysia is running at ${hostname}:${port}`)
})
