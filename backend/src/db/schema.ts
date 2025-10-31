import {
    pgTable,
    serial,
    varchar,
    text,
    date,
    integer,
    timestamp,
    primaryKey,
    uniqueIndex,
    numeric,
    index
} from "drizzle-orm/pg-core";

// -----------------------------------------------------------------------------
// USERS
// -----------------------------------------------------------------------------
export const users = pgTable("users", {
    id: serial().primaryKey(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

// -----------------------------------------------------------------------------
// MOVIES
// -----------------------------------------------------------------------------
export const movies = pgTable("movies", {
    id: serial().primaryKey(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    releaseDate: date("release_date"),
    posterPath: varchar("poster_path", { length: 500 }),
    rating: numeric("rating", { precision: 3, scale: 1 }), // e.g. 7.5
});

// -----------------------------------------------------------------------------
// GENRES
// -----------------------------------------------------------------------------
export const genres = pgTable("genres", {
    id: serial().primaryKey(),
    name: varchar({ length: 100 }).notNull(),
});

// -----------------------------------------------------------------------------
// MOVIE ↔ GENRE (Many-to-Many)
// -----------------------------------------------------------------------------
export const movieGenres = pgTable(
    "movie_genres",
    {
        movieId: integer("movie_id")
            .notNull()
            .references(() => movies.id, { onDelete: "cascade" }),
        genreId: integer("genre_id")
            .notNull()
            .references(() => genres.id, { onDelete: "cascade" }),
    },
    (t) => [
        primaryKey({ columns: [t.movieId, t.genreId] }),
    ]
);

// -----------------------------------------------------------------------------
// WATCH LATER (user → many movies)
// -----------------------------------------------------------------------------
export const watchLater = pgTable(
    "watch_later",
    {
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        movieId: integer("movie_id")
            .notNull()
            .references(() => movies.id, { onDelete: "cascade" }),
    },
    (t) => [
        uniqueIndex("watch_later_user_movie_idx").on(t.userId, t.movieId),
    ]
);

// -----------------------------------------------------------------------------
// REVIEWS (one per user per movie — allows many users per movie)
// -----------------------------------------------------------------------------
export const reviews = pgTable(
    "reviews",
    {
        id: serial().primaryKey(),
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        movieId: integer("movie_id")
            .notNull()
            .references(() => movies.id, { onDelete: "cascade" }),
        reviewText: text("review_text").notNull(),
        createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    },
    (t) => [
        uniqueIndex("reviews_user_movie_idx").on(t.userId, t.movieId), // ✅ each user can review a movie once
        index("reviews_movie_id_idx").on(t.movieId),                   // ✅ multiple users per movie, faster queries
    ]
);

// -----------------------------------------------------------------------------
// FAVORITES (user ↔ movie)
// -----------------------------------------------------------------------------
export const favorites = pgTable(
  "favorites",
  {
    userId: integer("user_id").notNull().references(() => users.id),
    movieId: integer("movie_id").notNull().references(() => movies.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.movieId] }), // ✅ one favorite per user/movie pair
  })
);

// -----------------------------------------------------------------------------
// WATCH HISTORY (user ↔ movie watched)
// -----------------------------------------------------------------------------
export const watchHistory = pgTable(
  "watch_history",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    watchedAt: timestamp("watched_at", { withTimezone: false }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.movieId] }),
  })
);
