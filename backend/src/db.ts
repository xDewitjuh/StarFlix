import { configDotenv } from 'dotenv';
import { drizzle } from "drizzle-orm/node-postgres";
import * as fs from 'fs';
import path from 'path';

configDotenv({
    path: '../.env'
});

export const db = drizzle(`postgresql://postgres:${process.env.DB_PASS}@db:5432/starflix`);

// console.log('Running seed script...');
// const seedFile = fs.readFileSync(path.join(__dirname, 'db/seed.sql'), 'utf-8');
// db.execute(seedFile);
// console.log('Seed script completed.');
