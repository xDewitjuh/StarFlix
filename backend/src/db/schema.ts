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
} from "drizzle-orm/pg-core";

// Users
export const users = pgTable("users", {
    id: serial().primaryKey(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

// Movies
export const movies = pgTable("movies", {
    id: serial().primaryKey(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    releaseDate: date("release_date"),
    posterPath: varchar("poster_path", { length: 500 }),
});

// Genres
export const genres = pgTable("genres", {
    id: serial().primaryKey(),
    name: varchar({ length: 100 }).notNull(),
});

// Movie ↔ Genre (many-to-many junction)
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

// Watch Later (user → many movies)
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

// History (user → many movies watched)
export const history = pgTable(
    "history",
    {
        userId: integer("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        movieId: integer("movie_id")
            .notNull()
            .references(() => movies.id, { onDelete: "cascade" }),
    },
    (t) => [
        uniqueIndex("history_user_movie_idx").on(t.userId, t.movieId),
    ]
);

// Reviews (one review per user per movie)
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
        uniqueIndex("reviews_user_movie_idx").on(t.userId, t.movieId),
    ]
);
