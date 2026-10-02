import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Created on first use, not at import: `next build` loads every route to collect page data,
// and neon() throws when DATABASE_URL is missing, which would fail the whole deployment.
let client: NeonQueryFunction<false, false> | null = null;

export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables.");
    client = neon(url);
  }
  return client;
}
