CREATE TABLE IF NOT EXISTS "genres" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "history" (
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movie_genres" (
	"movie_id" integer NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "movie_genres_movie_id_genre_id_pk" PRIMARY KEY("movie_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movies" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"release_date" date,
	"poster_path" varchar(500)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"review_text" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_later" (
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL
);
--> statement-breakpoint
-- Foreign keys
DO $$
BEGIN
    ALTER TABLE "history" 
        ADD CONSTRAINT "history_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "history" 
        ADD CONSTRAINT "history_movie_id_movies_id_fk" 
        FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "movie_genres" 
        ADD CONSTRAINT "movie_genres_movie_id_movies_id_fk" 
        FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "movie_genres" 
        ADD CONSTRAINT "movie_genres_genre_id_genres_id_fk" 
        FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "reviews" 
        ADD CONSTRAINT "reviews_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "reviews" 
        ADD CONSTRAINT "reviews_movie_id_movies_id_fk" 
        FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "watch_later" 
        ADD CONSTRAINT "watch_later_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "watch_later" 
        ADD CONSTRAINT "watch_later_movie_id_movies_id_fk" 
        FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "history_user_movie_idx" 
    ON "history" USING btree ("user_id","movie_id");

CREATE UNIQUE INDEX IF NOT EXISTS "reviews_user_movie_idx" 
    ON "reviews" USING btree ("user_id","movie_id");

CREATE UNIQUE INDEX IF NOT EXISTS "watch_later_user_movie_idx" 
    ON "watch_later" USING btree ("user_id","movie_id");
