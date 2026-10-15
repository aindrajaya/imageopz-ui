# AGENTS.md

Shared agent memory for imageopz-ui (CLAUDE.md is a symlink to this file). Every rule carries a one-line why.

## Read first
- docs/engineering/STATE.md - baseline, CI, open tasks; a snapshot, overwritten each task
- docs/engineering/tasks/ - task contracts and handoffs; SECURITY.md - compromised history
- Backend and cross-repo state live in imageopz-server (docs/engineering/STATE.md there)

## Stack
- React 19 + TypeScript 5.8, Vite 6, Tailwind CSS 4, shadcn-style components (@base-ui/react), react-router-dom 7
- Supabase Auth (magic link) for Pro access, PostHog and Vercel Analytics; hosted on Vercel (vercel.json SPA rewrite)
- pnpm 10.33.0 (packageManager), Node 24 (.nvmrc, engines)

## Layout
- src/main.tsx (providers, PostHog init), src/App.tsx (routes and most UI; large), src/index.css
- components/ (auth/AuthCallback, results/MyResults, ui/ primitives), context/AuthContext.tsx
- lib/imageopzApi.ts (backend client), lib/supabaseClient.ts, lib/resultsStore.ts; openapi.json = backend spec copy
- docs/ (PRDs, Indonesian/English), issues/ (notes); `@/` alias = repo root
- CI: .github/workflows/ui-ci.yml (job `build`), repo-safety.yml (job `check`, required)

## Commands
- pnpm install --frozen-lockfile; pnpm run dev (port 3000, proxies /api to the backend)
- pnpm run lint (tsc --noEmit; no ESLint configured); pnpm run build (vite build -> dist/)
- ./scripts/check-repo-safety.sh - must exit 0 before any install/dev/build
- No test suite exists yet

## Rules
- Never run install, dev or build on commits or branches you have not inspected; never on commits before fd1032e - build tooling executes repository code (SECURITY.md)
- Read vite.config.* and package.json scripts before running pnpm on a new baseline - they run on every dev/build/install
- No secrets in VITE_ variables - every VITE_ value ships to the browser; only public keys (Supabase anon, PostHog project token)
- Lockfile changes: only registry sources; review new install scripts before `pnpm approve-builds` - supply-chain risk
- New dependencies need a stated reason; remove unused ones - smaller attack surface
- Never read or print .env files or secrets - they leak through logs and history
- Stay inside the task's scope and authorization; the owner commits and pushes; no git stash/reset/clean or history rewrite
- Fix lint/type/build problems your change introduces; log pre-existing defects as follow-ups in the task file
- Plain hyphens, no em-dashes; no AI co-author trailers - owner convention
