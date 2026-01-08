import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const primaryDb = drizzle(process.env.DATABASE_URL!, {
  schema,
  casing: "snake_case",
});

export const db = primaryDb;

export type Database = typeof db;
