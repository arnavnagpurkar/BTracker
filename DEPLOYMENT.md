# Deploying BTracker to Vercel

## How the build works

`npm run build` first runs `scripts/patch-tracker.mjs` (the `prebuild` step). It reads
**`original/tracker.html`** and writes `lib/tracker.generated.ts`, which the app serves at `/tracker`.
So the deploy needs:

- the file `original/tracker.html` (exactly that name, inside the `original` folder), and
- the file to be your un-patched tracker, with the lines the patch script looks for.

If a patch step can't find its line, the build stops with a message like
`✖ Patch step "…": expected 1 match(es), found 0`. That means the tracker changed in a way
the script doesn't know about yet; update the matching step in `scripts/patch-tracker.mjs`.

## Updating the tracker

1. Upload the new version into `original/` and make sure it ends up named `tracker.html`
   (delete or rename the old one; only one `tracker.html` should be there).
2. Run `npm test` locally, or push and check the **Build** check on GitHub (Actions tab).
3. Only once that's green will Vercel's deploy succeed.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Needed | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | `pk_live_…` or `pk_test_…` from the Clerk dashboard → API keys |
| `CLERK_SECRET_KEY` | yes | `sk_live_…` or `sk_test_…` from the same page |
| `DATABASE_URL` | yes | Neon connection string (`postgresql://…?sslmode=require`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | recommended | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | recommended | `/sign-up` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | optional | only if you set up the `user.deleted` webhook |

Enable them for **Production** and **Preview**, then redeploy. The build no longer fails when
one is missing, but the app won't work at runtime without them.

## Seeing why a deploy failed without the Vercel dashboard

Every push runs `.github/workflows/build.yml`, which does the same `npm ci` + `npm run build`
as Vercel, then the smoke tests. Open the repo on GitHub → **Actions** → the latest **Build**
run to read the full error.
