import { configDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

configDotenv({
    path: '../.env'
});

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: `postgresql://postgres:${process.env.DB_PASS}@db:5432/starflix`,
  },
});
