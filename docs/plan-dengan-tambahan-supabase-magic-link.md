# Plan: Implement Auth (Supabase Magic Link) + Backend OpenAPI Integration

## Summary
Implement Supabase Magic Link email auth in the Vite+React UI, while keeping anonymous usage for the free tier. The UI will:
- Maintain the existing `session_id` flow for anonymous users.
- Add Supabase login to enrich `/api/v1/session/me` with authenticated identity (`is_authenticated`, `supabase_user_id`, `email`) and support Pro linking.
- Send `Authorization: Bearer <supabase_access_token>` to backend endpoints that accept it (per OpenAPI), alongside `X-Session-Id`.
- Use a dedicated SPA route `/auth/callback` for magic-link return handling.
- Provide both Header modal login and inline Paywall login/restore entrypoints.

## Key Interface / Contract Changes (per OpenAPI)
Frontend must align with these request headers/behaviors:
- `Authorization` header is optional but supported on:
  - `GET /api/v1/session/me`
  - `POST /api/v1/optimize`
  - `POST /api/v1/checkout/lemonsqueezy`
  - `POST /api/v1/session/restore`
- `X-Session-Id` stays supported and should still be sent for the above (plus optimize).
- Logout is server-side:
  - `POST /api/v1/session/logout` (no auth header required), returns `SessionLogoutResponse { session_id }`.

## Implementation Changes (Frontend)

### 1) Supabase Setup
- Add dependency: `@supabase/supabase-js`.
- Add env vars (Vite):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_REDIRECT_URL` (default prod: `https://<domain>/auth/callback`, local: `http://localhost:3000/auth/callback`)
- Add `lib/supabaseClient.ts`:
  - `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- Add `vite-env.d.ts` entries if needed for TS typing (or extend existing typing) for the new env vars.

### 2) Auth Context + Session Lifecycle
- Add `context/AuthContext.tsx`:
  - Holds `user`, `session`, `accessToken`, `email`, `loadingAuth`.
  - Subscribes to `supabase.auth.onAuthStateChange` to keep session current (auto refresh).
  - Exposes actions:
    - `signInWithMagicLink(email)` using `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`
    - `signOut()` using `supabase.auth.signOut()` (optional; separate from backend session logout)
- Ensure app root wraps with `<AuthProvider>` (in `src/main.tsx`).

### 3) Auth Callback Route
- Add route `/auth/callback` in React Router:
  - Shows a “Signing you in…” screen.
  - Waits for Supabase SDK to establish session (usually already done by the time route renders).
  - Immediately calls backend `GET /api/v1/session/me` with:
    - `Authorization: Bearer <accessToken>` (if present)
    - `X-Session-Id`
    - `credentials: include`
  - On success: store returned `session_id` (if backend rotated) and redirect to `/`.

### 4) API Client: Centralize Header Injection
- Refactor API client (currently `lib/imageopzApi.ts`) to accept an optional `accessToken` and always attach:
  - `X-Session-Id` (if present)
  - `Authorization: Bearer <token>` (if present) — **only** when OpenAPI indicates the endpoint accepts it
  - `credentials: "include"` for cookie session consistency
- Recommended implementation detail:
  - Create a small helper `buildHeaders({ sessionId, accessToken, json })` and reuse across calls.

### 5) Update Session Sync Logic to Use Auth + OpenAPI Fields
- Update the “authoritative session state” refresh to call `GET /api/v1/session/me` with both:
  - `X-Session-Id`
  - `Authorization` when logged in
- Store the `email` returned by backend (preferred over local) for UI display:
  - Use backend `SessionMeResponse.email` when non-null.
- Update Pro gating logic to use backend signals (no heuristics):
  - `isProUI = me.is_pro && me.pro_verified && !me.needs_restore`
  - If `me.is_pro` but `me.needs_restore` → show Restore CTA
- Credit display:
  - If `isProUI` → use `me.pro_credits_remaining`
  - Else → use `me.credits_remaining`

### 6) Login UX (Hybrid: Header Modal + Paywall Inline)
- Header:
  - If not authenticated: show “Sign in” button → modal with email input → sends magic link.
  - If authenticated: show email pill (truncate) + “Sign out” (Supabase signOut) optional.
- Paywall:
  - When credits exhausted, show inline:
    - Email input to start magic link (for GTM conversion)
    - Purchase CTA for LemonSqueezy checkout (still server-side)
- Add friendly upsell copy for anonymous users (per request) when free quota is used up:
  - Example: “Love the results? Sign in to keep history and unlock Pro features…”

### 7) Restore + Logout Flows With Auth
- Restore Pro (`POST /api/v1/session/restore`):
  - Send `Authorization` if logged in + `X-Session-Id`.
  - After success: refresh `/session/me`.
- Logout Session (`POST /api/v1/session/logout`):
  - Always call backend logout to rotate cookie session.
  - Also clear local `session_id` and regenerate a new UUID for `X-Session-Id`.
  - After logout: refresh `/session/me` (without Authorization if user also signed out) and return UI to “Upgrade to Pro”.

### 8) PRD/Docs Updates
- Update `docs/prd-ui.v2.md` with:
  - Magic link auth flow
  - `/auth/callback` route behavior
  - Header modal login + inline paywall login
  - Backend as source of truth (`/session/me`) including auth fields
- Add/Update `docs/prd-tambahan-auth-with-supabase.md` to match the concrete UI routing and API header behavior (Authorization + X-Session-Id + cookies).

## Test Plan (Acceptance Scenarios)
1) Anonymous user:
- Can optimize within free credits.
- `/session/me` works without Authorization.
- On 429 or credits exhaustion: paywall triggers.
2) Sign in (Magic link):
- Request magic link, click link → lands on `/auth/callback` → ends on `/`.
- `/session/me` shows `is_authenticated=true`, `email` populated.
3) Pro detected but not verified:
- `/session/me` returns `needs_restore=true` → UI shows Restore CTA (not Pro UI).
4) Restore flow:
- Enter email → `POST /session/restore` succeeds → `/session/me` refresh → Pro UI active.
5) Checkout flow:
- From paywall, create checkout → redirect overlay shown → redirected to LemonSqueezy.
6) Logout:
- `POST /session/logout` rotates session; UI returns to Upgrade state and does not show Pro UI unless backend returns verified Pro for new session.
7) CORS/Preflight:
- Confirm backend allows `Authorization` + `X-Session-Id` headers for the endpoints; verify POST requests actually proceed after OPTIONS.

## Assumptions / Defaults
- Anonymous optimization remains allowed (free tier) and does not require Supabase login.
- Magic link redirect path is `/auth/callback` (both local and prod).
- Frontend always sends `X-Session-Id` and includes cookies (`credentials: "include"`).
- Backend `/session/me` is the single source of truth for: authentication state, pro state, and remaining credits.
