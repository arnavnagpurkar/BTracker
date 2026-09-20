import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);
const MAX_CODE = 2_000_000; // characters; real saves are far smaller
const MIN_GAP_MS = 2000; // best-effort per-user write throttle
const lastWrite = new Map<string, number>();

let ready: Promise<void> | null = null;
function init() {
  if (!ready) {
    ready = (async () => {
      await sql`create table if not exists states (
        user_id text primary key,
        code text not null,
        version integer not null default 1,
        updated_at timestamptz not null default now()
      )`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  await init();
  const rows = await sql`select code, version from states where user_id = ${userId}`;
  if (!rows.length) return Response.json({ code: null, version: 0 }, { headers: noStore });
  return Response.json({ code: rows[0].code, version: rows[0].version }, { headers: noStore });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const code = body?.code;
  const base = body?.baseVersion;
  if (typeof code !== "string" || code.length === 0 || code.length > MAX_CODE)
    return new Response("Bad request", { status: 400 });
  if (!Number.isInteger(base) || base < 0) return new Response("Bad request", { status: 400 });

  const now = Date.now();
  const last = lastWrite.get(userId) ?? 0;
  if (now - last < MIN_GAP_MS) return new Response("Slow down", { status: 429 });
  lastWrite.set(userId, now);

  await init();

  // Optimistic concurrency: only write if the client's copy is the one the server holds.
  const rows =
    base === 0
      ? await sql`insert into states (user_id, code, version) values (${userId}, ${code}, 1)
                  on conflict (user_id) do nothing returning version`
      : await sql`update states set code = ${code}, version = version + 1, updated_at = now()
                  where user_id = ${userId} and version = ${base} returning version`;

  if (!rows.length) {
    const cur = await sql`select version from states where user_id = ${userId}`;
    return Response.json({ error: "conflict", version: cur[0]?.version ?? 0 }, { status: 409, headers: noStore });
  }
  return Response.json({ version: rows[0].version }, { headers: noStore });
}
