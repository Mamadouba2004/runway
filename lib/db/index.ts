// Placeholder — Drizzle client.
//
// Intended shape:
//   import { drizzle } from "drizzle-orm/postgres-js";
//   import postgres from "postgres";
//   const client = postgres(process.env.DATABASE_URL!, { prepare: false });
//   export const db = drizzle(client, { schema });
//
// `prepare: false` matters if DATABASE_URL points at a Supabase pooler.

export {};
