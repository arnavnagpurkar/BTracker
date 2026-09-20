import { auth } from "@clerk/nextjs/server";
import html from "@/lib/tracker.generated";

export const dynamic = "force-dynamic";

// The tracker itself, shown inside the page at "/". Signed-in users only.
// The user id is injected so the page knows which account it belongs to.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const inject = `<script>window.__USER__=${JSON.stringify(userId)}</script>`;
  return new Response(html.replace("</head>", inject + "</head>"), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
