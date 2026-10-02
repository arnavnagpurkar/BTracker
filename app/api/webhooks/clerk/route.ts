import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Optional. Point a Clerk webhook (event: user.deleted) at /api/webhooks/clerk and set
// CLERK_WEBHOOK_SIGNING_SECRET, and deleting an account also erases that user's progress.
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (evt.type === "user.deleted" && evt.data.id) {
    await db()`delete from states where user_id = ${evt.data.id}`;
  }
  return new Response("ok");
}
