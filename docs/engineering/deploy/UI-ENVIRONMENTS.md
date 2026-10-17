# UI environments (Vercel) - Production, staging, Preview

Source of truth for the imageopz-ui `VITE_` variables per Vercel environment. Server side: imageopz-server
docs/engineering/deploy/DEPLOY-PLAN.md (section 5 env vars, section 7 networking and CORS).

**Every `VITE_` value is compiled into the JavaScript bundle and ships to every visitor's browser. Never put a secret
in a `VITE_` variable** - no service-role keys, no API secrets, no webhook signing secrets, no R2 tokens. Only public
values belong here: URLs, the Supabase anon key, the PostHog project token.

All variables are read in one place, `lib/config.ts`. Vite inlines them at build time, so a change in Vercel needs a
redeploy to take effect.

## Production - `https://imageopz.aindrajaya.my.id` (branch `main`)

| Variable | Value / source |
|---|---|
| `VITE_IMAGEOPZ_API_BASE_URL` | prod api run.app URL from T-008c: `https://imageopz-api-prod-<PROJECT_NUMBER>.asia-northeast1.run.app` (no trailing slash). Required: a production build without it shows a "not configured" screen. |
| `VITE_IMAGEOPZ_SEND_COOKIES` | `false` (header-only sessions; the cross-site run.app API never receives the `SameSite=Lax` cookie) |
| `VITE_IMAGEOPZ_USE_VITE_PROXY` | unset (dev-server only; ignored in builds) |
| `VITE_SUPABASE_URL` | prod Supabase project: Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | prod Supabase project: anon / publishable key (public). Never the service-role key. |
| `VITE_SUPABASE_REDIRECT_URL` | `https://imageopz.aindrajaya.my.id/auth/callback` (must be in the prod project's Auth > URL Configuration > Redirect URLs) |
| `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` | prod PostHog project token (public `phc_...`) |
| `VITE_PUBLIC_POSTHOG_HOST` | the PostHog ingest host of that project (e.g. `https://us.i.posthog.com` or `https://eu.i.posthog.com`) |

## Staging - `https://staging.imageopz.aindrajaya.my.id` (branch `staging`)

In Vercel these are Preview-environment variables scoped to the `staging` Git branch.

| Variable | Value / source |
|---|---|
| `VITE_IMAGEOPZ_API_BASE_URL` | staging api run.app URL from T-008c: `https://imageopz-api-staging-<PROJECT_NUMBER>.asia-northeast1.run.app` |
| `VITE_IMAGEOPZ_SEND_COOKIES` | `false` |
| `VITE_IMAGEOPZ_USE_VITE_PROXY` | unset |
| `VITE_SUPABASE_URL` | staging Supabase project (the second free project, DEPLOY-PLAN Q7) |
| `VITE_SUPABASE_ANON_KEY` | staging Supabase project anon key |
| `VITE_SUPABASE_REDIRECT_URL` | `https://staging.imageopz.aindrajaya.my.id/auth/callback` (add to the staging project's Redirect URLs) |
| `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` | unset (analytics off: the UI skips PostHog init when the token is empty) or a separate staging PostHog project's token. Never the prod token - staging traffic would pollute prod analytics. |
| `VITE_PUBLIC_POSTHOG_HOST` | unset, or the staging PostHog project's host |

## Preview - every other branch (`*.vercel.app` per commit)

| Variable | Value / source |
|---|---|
| `VITE_IMAGEOPZ_API_BASE_URL` | staging api run.app URL (same as staging), so the page loads and shows the config |
| `VITE_IMAGEOPZ_SEND_COOKIES` | `false` |
| `VITE_IMAGEOPZ_USE_VITE_PROXY` | unset |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | staging Supabase project |
| `VITE_SUPABASE_REDIRECT_URL` | unset (falls back to `<preview origin>/auth/callback`, which is not in the allowed list, so magic links will not complete on previews) |
| `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`, `VITE_PUBLIC_POSTHOG_HOST` | unset |

**Expected limitation:** Vercel Preview URLs are not in the API `CORS_ALLOW_ORIGINS` list nor in the R2 uploads
bucket CORS rules (DEPLOY-PLAN section 7: never preview URLs, never `*`). API calls and uploads fail with CORS errors
on previews. That is by design; test end to end on staging.

## Local development

Copy `.env.example` to `.env` (never commit it). Typical: `VITE_IMAGEOPZ_API_BASE_URL=http://localhost:8000`,
`VITE_IMAGEOPZ_USE_VITE_PROXY=true` (same-origin `/api` through the Vite proxy, cookies work), cookies on or off.

## Session modes

| `VITE_IMAGEOPZ_SEND_COOKIES` | `credentials` | Session identity |
|---|---|---|
| `false` (prod, staging, preview) | `omit` on every API call | `X-Session-Id` header from localStorage `imageopz_session_id` only |
| anything else / unset (local default) | `include` on every API call | `X-Session-Id` header plus the `imageopz_sid` cookie |

One helper decides this for every request (`apiFetch` / `apiCredentials` in `lib/imageopzApi.ts`); a test fails if any
other code sets `credentials` or calls `fetch`. The presigned R2 PUT never sends credentials in either mode.

After the UI with this change is live in an environment, set the api's `CORS_ALLOW_CREDENTIALS=false` there
(DEPLOY-PLAN section 5 and 7); before it, logout needed credentials and the flag had to stay true.

## Owner steps (Vercel and Cloudflare; not done by agents)

1. Create the long-lived branch: `git switch main && git pull && git switch -c staging && git push -u origin staging`.
2. Vercel > Project > Settings > Domains: add `staging.imageopz.aindrajaya.my.id` and assign it to Git branch `staging`.
3. Cloudflare DNS for `aindrajaya.my.id`: add `CNAME staging.imageopz -> cname.vercel-dns.com` (or the target Vercel
   shows for the domain) with proxy status **DNS only** (grey cloud), so Vercel can issue the certificate.
4. Vercel > Settings > Environment Variables: enter the Production values; enter the staging values as Preview variables
   scoped to branch `staging`; enter the generic Preview values for all other Preview branches.
5. Supabase (each project): Auth > URL Configuration: Site URL and Redirect URLs for that environment's origin.
6. Redeploy each environment after changing variables, then open it: a missing API URL shows "ImageOpz is not
   configured" instead of the app.
7. Server side (DEPLOY-PLAN): `CORS_ALLOW_ORIGINS` staging = `https://staging.imageopz.aindrajaya.my.id`, prod =
   `https://imageopz.aindrajaya.my.id`; R2 uploads bucket CORS for the same origins; then `CORS_ALLOW_CREDENTIALS=false`.
