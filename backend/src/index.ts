import { eq, asc, desc, sql, and } from 'drizzle-orm'
import { Elysia, file } from 'elysia'
import { node } from '@elysiajs/node'
import { db } from './db'
import { movies, genres, movieGenres, users, reviews, favorites, watchHistory } from './db/schema'
import * as fs from 'fs'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import 'dotenv/config'
import { swagger } from '@elysiajs/swagger'

// -------------------------------------------------------------------------
// Auth constants + helpers
// -------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const AUTH_COOKIE = 'auth' // cookie name

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

function setCookieHeader(set: any, name: string, value: string, options: { maxAge?: number } = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
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

// Health
app.get('/health', () => ({ status: 'ok' }), {
  detail: { tags: ['Health'], summary: 'Healthcheck endpoint' }
});

// Swagger (register this BEFORE the catch-all)
app.use(
  swagger({
    path: '/api-docs',
    documentation: {
      info: { title: 'StarFlix API', version: '1.0.0' },
      tags: [
        { name: 'Health', description: 'Healthcheck' },
        { name: 'Auth', description: 'Registreren, inloggen en profiel' },
        { name: 'Movies', description: 'Films en zoeken' },
        { name: 'Favorites', description: 'Favorieten van ingelogde gebruiker' },
        { name: 'History', description: 'Kijkgeschiedenis van ingelogde gebruiker' },
        { name: 'Reviews', description: 'Reviews per film' },
      ],
    },
  })
)

// -------------------------------------------------------------------------
// API routes
// -------------------------------------------------------------------------
app.group('/api', (api) => {

  // Movies list
  api.get('/movies', async ({ query }) => {
    const sortParam = String(query?.sort ?? '').toLowerCase()
    const orderParam = String(query?.order ?? '').toLowerCase()

    const column =
      sortParam === 'title' ? movies.title :
      sortParam === 'releasedate' ? movies.releaseDate :
      movies.id

    const directionAsc = orderParam !== 'desc'

    const result = await db.select().from(movies).orderBy(directionAsc ? asc(column) : desc(column))
    return result
  }, { detail: { tags: ['Movies'], summary: 'List all movies (sortable)' } })

  // One movie by ID
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
  }, { detail: { tags: ['Movies'], summary: 'Get movie by ID (with genres)' } })

  // Search
  api.get('/search', async ({ query }) => {
    const q = String(query?.q || '').trim();
    if (!q) return { results: [] };
    const results = await db
      .select()
      .from(movies)
      .where(sql`LOWER(${movies.title}) LIKE LOWER(${`%${q}%`})`)
      .limit(20);
    return { results };
  }, { detail: { tags: ['Movies'], summary: 'Search movies by title' } });

  // AUTH ----------------------------------------------------------
  api.post('/auth/register', async ({ body, set }) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(8) })
    const result = schema.safeParse(body)
    if (!result.success) {
      set.status = 400
      return { error: result.error.flatten() }
    }

    const { email, password } = result.data
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      set.status = 409
      return { error: 'Email already in use' }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [created] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id, email: users.email })
    if (!created) {
      set.status = 500
      return { error: 'User insert failed' }
    }

    const token = signToken({ id: created.id, email: created.email })
    setCookieHeader(set, AUTH_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 })
    return { id: created.id, email: created.email }
  }, { detail: { tags: ['Auth'], summary: 'Register a new user' } })

  api.post('/auth/login', async ({ body, set }) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(8) })
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

    if (!userRow || !(await bcrypt.compare(password, userRow.passwordHash))) {
      set.status = 401
      return { error: 'Invalid email or password' }
    }

    const token = signToken({ id: userRow.id, email: userRow.email })
    setCookieHeader(set, AUTH_COOKIE, token, { maxAge: 60 * 60 * 24 * 7 })
    return { id: userRow.id, email: userRow.email }
  }, { detail: { tags: ['Auth'], summary: 'Login and receive cookie' } })

  api.get('/auth/me', async ({ request, set }) => {
    const raw = request.headers.get('cookie')
    const token = getCookieFromHeader(raw, AUTH_COOKIE)
    if (!token) {
      set.status = 401
      return { user: null }
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string }
      const [userRow] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, payload.id)).limit(1)
      if (!userRow) {
        set.status = 401
        return { user: null }
      }
      return { user: userRow }
    } catch {
      set.status = 401
      return { user: null }
    }
  }, { detail: { tags: ['Auth'], summary: 'Get logged-in user info' } })

  api.post('/auth/logout', async ({ set }) => {
    clearCookieHeader(set, AUTH_COOKIE)
    return { ok: true }
  }, { detail: { tags: ['Auth'], summary: 'Logout current user' } })

  // FAVORITES -----------------------------------------------------
  api.get('/favorites', async ({ request, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { favorites: [] };
    const rows = await db.select({ movieId: favorites.movieId }).from(favorites).where(eq(favorites.userId, userId));
    return { favorites: rows.map(r => r.movieId) };
  }, { detail: { tags: ['Favorites'], summary: 'Get all favorite movies of user' } });

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
    await db.insert(favorites).values({ userId, movieId }).onConflictDoNothing({ target: [favorites.userId, favorites.movieId] });
    return { ok: true };
  }, { detail: { tags: ['Favorites'], summary: 'Add a favorite movie' } });

  api.delete('/favorites/:movieId', async ({ request, params, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { ok: false };
    const movieId = Number(params.movieId);
    if (!Number.isFinite(movieId)) {
      set.status = 400;
      return { ok: false, error: 'Invalid movieId' };
    }
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.movieId, movieId)));
    return { ok: true };
  }, { detail: { tags: ['Favorites'], summary: 'Remove a favorite movie' } });

  // HISTORY -------------------------------------------------------
  api.get('/history', async ({ request, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { history: [] };
    const rows = await db.select({ movieId: watchHistory.movieId }).from(watchHistory).where(eq(watchHistory.userId, userId));
    return { history: rows.map(r => r.movieId) };
  }, { detail: { tags: ['History'], summary: 'List watch history' } });

  api.post('/history', async ({ request, body, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { ok: false };
    const schema = z.object({ movieId: z.number() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: parsed.error.flatten() };
    }
    const { movieId } = parsed.data;
    await db.insert(watchHistory).values({ userId, movieId }).onConflictDoNothing({ target: [watchHistory.userId, watchHistory.movieId] });
    return { ok: true };
  }, { detail: { tags: ['History'], summary: 'Add movie to history' } });

  api.delete('/history/:movieId', async ({ request, params, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { ok: false };
    const movieId = Number(params.movieId);
    if (!Number.isFinite(movieId)) {
      set.status = 400;
      return { ok: false, error: 'Invalid movieId' };
    }
    await db.delete(watchHistory).where(and(eq(watchHistory.userId, userId), eq(watchHistory.movieId, movieId)));
    return { ok: true };
  }, { detail: { tags: ['History'], summary: 'Remove movie from history' } });

  // REVIEWS -------------------------------------------------------
  api.get('/movies/:id/reviews', async ({ params, request, set }) => {
    const movieId = Number(params.id);
    if (!Number.isFinite(movieId)) {
      set.status = 400;
      return { error: 'Invalid movie id' };
    }
    const me = requireUserIdFromRequest(request, { status: 200 });
    const rows = await db
      .select({
        id: reviews.id,
        text: reviews.reviewText,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userId: reviews.userId,
        userEmail: users.email,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.movieId, movieId))
      .orderBy(desc(reviews.createdAt));
    return {
      reviews: rows.map((r) => ({
        id: r.id,
        text: r.text,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        author: { id: r.userId, email: r.userEmail, isMe: me ? r.userId === me : false },
      })),
    };
  }, { detail: { tags: ['Reviews'], summary: 'List all reviews for a movie' } });

  api.post('/movies/:id/reviews', async ({ params, request, body, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { ok: false };
    const movieId = Number(params.id);
    if (!Number.isFinite(movieId)) {
      set.status = 400;
      return { ok: false, error: 'Invalid movie id' };
    }
    const schema = z.object({ text: z.string().trim().min(1).max(2000) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { ok: false, error: parsed.error.flatten() };
    }
    const { text } = parsed.data;
    const [row] = await db
      .insert(reviews)
      .values({ userId, movieId, reviewText: text })
      .onConflictDoUpdate({
        target: [reviews.userId, reviews.movieId],
        set: { reviewText: text, updatedAt: new Date() },
      })
      .returning({ id: reviews.id, text: reviews.reviewText, createdAt: reviews.createdAt, updatedAt: reviews.updatedAt });
    return { ok: true, review: row };
  }, { detail: { tags: ['Reviews'], summary: 'Create or update review for a movie' } });

  api.delete('/movies/:id/reviews', async ({ params, request, set }) => {
    const userId = requireUserIdFromRequest(request, set);
    if (!userId) return { ok: false };
    const movieId = Number(params.id);
    if (!Number.isFinite(movieId)) {
      set.status = 400;
      return { ok: false, error: 'Invalid movie id' };
    }
    await db.delete(reviews).where(and(eq(reviews.userId, userId), eq(reviews.movieId, movieId)));
    return { ok: true };
  }, { detail: { tags: ['Reviews'], summary: 'Delete my review for a movie' } });

  return api
})

// -------------------------------------------------------------------------
// Catch-all FRONTEND (LAST!)
// -------------------------------------------------------------------------
app.get('/*', ({ params }) => {
  // Never let the SPA catch /api-docs or /api/* requests
  const reqPath = '/' + String(params['*'] ?? '');
  if (
    reqPath === '/api-docs' ||
    reqPath.startsWith('/api-docs/') ||
    reqPath.startsWith('/api/')
  ) {
    return new Response('Not found', { status: 404 });
  }

  const path = `../frontend/${params['*']}`;
  try {
    if (fs.existsSync(path) && !fs.lstatSync(path).isDirectory()) {
      return file(path);
    }
    if (params['*'] === '' || String(params['*']).endsWith('/')) {
      return file('../frontend/index.html');
    }
  } catch {
    // fallthrough to 404
  }
  return new Response('Not found', { status: 404 });
});

// -------------------------------------------------------------------------
// Listen
// -------------------------------------------------------------------------
app.listen(3000, ({ hostname, port }) => {
  console.log(`🦊 Elysia is running at ${hostname}:${port}`)
});
