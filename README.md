# StockBoard

[![CI](https://github.com/dhairyagamdha2006-bit/StockBoard/actions/workflows/ci.yml/badge.svg)](https://github.com/dhairyagamdha2006-bit/StockBoard/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E)
![Tests](https://img.shields.io/badge/tests-58%20passing-brightgreen)

**One dashboard for your brokerage holdings.** StockBoard aggregates positions
from Fidelity (CSV), E\*TRADE, and Charles Schwab (official OAuth) into a single
auto-updating portfolio view — with quote refresh, daily snapshots, allocation
analytics, and a safe server-side sync engine.

> **Want to try it instantly?** Sign up, open the dashboard, and click **Load
> Demo Data** — realistic sample holdings, no brokerage credentials required.

---

## Why this project is interesting (engineering)

- **Honest, gated broker integrations.** A single source-of-truth support matrix
  drives the UI and docs. Unofficial integrations (Robinhood) are clearly labeled
  experimental and disabled by default; unconfigured OAuth brokers degrade to a
  graceful "not available" state instead of crashing.
- **Server-side, cookie-free sync engine.** Cron and manual syncs share one
  engine that runs with the Supabase **service-role** client. It’s **failure-safe**
  (uses upsert-then-delete-stale, so a broker outage never wipes your holdings) and
  **counts only genuine successes**, recording every attempt to a `sync_logs` table.
- **Security-first.** AES-256-GCM token encryption with **no fallback key**;
  Zod-validated env that **fails loudly**; RLS that makes `price_cache`
  read-only for users (service-role writes only); OAuth **state/CSRF** protection;
  audit-safe logging that never prints tokens/codes; `server-only`-guarded
  service-role client.
- **Production-minded infra.** Formal SQL migrations with indexes, Upstash Redis
  rate limiting (with in-memory dev fallback), and a CI pipeline running
  type-check, lint, tests, and build.
- **Real tests.** 58 unit/integration tests (Vitest) covering encryption, env
  validation, CSV parse/export, the sync engine (success/failure/skip + counting),
  holdings DB logic, rate limiting, and an HTTP route — plus Playwright E2E specs.

---

## Screenshots

Add images to `public/screenshots/` and they’ll render here.

| Dashboard | Holdings | Analytics |
| --- | --- | --- |
| `public/screenshots/dashboard.png` | `public/screenshots/holdings.png` | `public/screenshots/analytics.png` |

---

## Broker support matrix (honest)

| Broker | Integration | Status | API sync? | Notes |
| --- | --- | --- | --- | --- |
| **Fidelity** | CSV import | ✅ Works out of the box | No (manual CSV) | Export Positions → upload. No credentials needed. |
| **Charles Schwab** | Official OAuth 2.0 (read-only) | ⚙️ Requires approval | Yes | Needs an approved Schwab developer app + HTTPS callback. |
| **E\*TRADE** | Official OAuth 1.0a (read-only) | ⚙️ Requires approval | Yes | Needs a developer consumer key (sandbox works for testing). |
| **Robinhood** | Unofficial private API | 🧪 Experimental, off by default | Yes (gated) | No public API. Username/password. **Not for real accounts.** Enable with `ENABLE_ROBINHOOD_EXPERIMENTAL=true`. |

**Is real broker connection production-ready?** Fidelity CSV import is. Schwab and
E\*TRADE are fully implemented but **require you to register and get a developer app
approved by the broker** and provide credentials — that approval is outside this
project’s control. Robinhood is intentionally experimental and disabled.

---

## Architecture

```
Next.js 16 (App Router)
├── proxy.ts                     Edge middleware: session + route protection
├── app/
│   ├── page.tsx                 Landing
│   ├── login / signup           Supabase Auth
│   ├── dashboard/               Holdings, analytics, history, connected accounts
│   ├── connect/<broker>/        Connect flows + OAuth callbacks (graceful states)
│   └── api/
│       ├── connect/<broker>     Start/complete a connection (OAuth state/CSRF)
│       ├── sync/<broker>        Manual per-broker sync (user-auth → service-role)
│       ├── sync/all             Cron + "sync everything" (service-role)
│       ├── import/fidelity      CSV → holdings (safe replace)
│       ├── prices               Alpaca quotes; service-role cache write
│       ├── disconnect           Revoke a broker (wipe tokens + holdings)
│       ├── demo                 Seed / clear / status of demo data
│       └── brokers/status       Per-deployment broker availability
├── lib/
│   ├── env.ts                   Zod env validation (core + per-feature getters)
│   ├── sync/{engine,holdings,route-helper}.ts   Failure-safe sync + sync_logs
│   ├── brokers/                 Per-broker clients + support matrix + availability
│   ├── prices/alpaca.ts         Alpaca REST snapshots
│   ├── demo/seed.ts             Demo seeding (never overwrites real accounts)
│   └── utils/                   encryption, validation, rateLimit, csv, calculations
├── supabase/migrations/         Formal SQL migrations (schema, indexes, RLS, logs)
├── tests/                       Vitest unit/integration tests
└── e2e/                         Playwright E2E specs
```

### How sync works

1. **Auth.** Per-broker routes verify the signed-in user; `/api/sync/all` accepts
   either a signed-in user (their accounts) or a Vercel Cron request with
   `Authorization: Bearer ${CRON_SECRET}` (all accounts).
2. **Execution** always runs server-side with the **service-role** client — never
   by forwarding the caller’s cookie to sub-requests.
3. **Failure-safe writes.** Holdings are mutated only *after* a successful broker
   fetch, via upsert-then-delete-stale (needs `UNIQUE(account_id, ticker)`). A
   broker failure leaves existing holdings intact and marks the account `error`.
4. **Truthful counting + logs.** `syncAccounts` counts only `ok && !skipped`, and
   every attempt is written to `sync_logs`.

---

## Data model

Tables (see `supabase/migrations/0001_initial_schema.sql`): `broker_accounts`,
`holdings`, `transactions`, `price_cache`, `portfolio_snapshots`, `sync_logs`.

Indexes on `holdings(user_id)`, `holdings(account_id)`,
`broker_accounts(user_id, broker_name)`, `transactions(user_id, transaction_date)`,
`portfolio_snapshots(user_id, snapshot_date)`, `sync_logs(user_id, created_at)`.

---

## Security model

- **Token encryption.** Broker tokens are AES-256-GCM encrypted at rest
  (`lib/utils/encryption.ts`), key derived from `ENCRYPTION_KEY` via scrypt.
  **No fallback** — the module throws if the key is missing/weak/placeholder.
- **Env validation.** `lib/env.ts` validates required env with Zod and fails
  loudly. No placeholder Supabase values anywhere.
- **RLS.** Every user table is scoped to `auth.uid()`. `price_cache` and
  `sync_logs` are **read-only** for users; only service-role writes them.
- **Service-role isolation.** `lib/supabase/server.ts` is marked `server-only`;
  it can never be bundled into a client component.
- **OAuth CSRF.** Schwab uses a random `state` bound to an httpOnly cookie;
  E\*TRADE binds the OAuth 1.0a request-token secret to an httpOnly cookie.
- **Audit-safe logging.** Broker error bodies, tokens, auth codes, and refresh
  tokens are never logged.
- **Rate limiting.** Per-user/IP limits on connect, sync, import, prices, demo,
  and disconnect routes (Upstash Redis in prod, in-memory in dev).

---

## Demo mode

Click **Load Demo Data** on the dashboard to seed sample holdings across two
demo broker accounts plus 30 days of portfolio snapshots. Demo accounts carry
no tokens, so the sync engine never touches them, and seeding **never overwrites
a real connected account**. A banner shows while demo data is active; **Clear
Demo Data** removes it.

---

## Local setup

Prerequisites: Node 18+, a Supabase project, an Alpaca key (free).

```bash
npm install --legacy-peer-deps
cp .env.example .env.local          # fill in real values
openssl rand -hex 32                # ENCRYPTION_KEY
openssl rand -hex 32                # CRON_SECRET
```

Apply the database schema in the Supabase SQL Editor:

- **Fresh project:** run `supabase/migrations/0001_initial_schema.sql`.
- **Existing/older DB:** also run `supabase/migrations/0002_hardening_upgrade.sql`.

Run it:

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest (58 tests)
npm run build        # production build
```

---

## Environment variables

| Variable | Required | Scope | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **server** | Service-role key — bypasses RLS, never expose |
| `ENCRYPTION_KEY` | ✅ | server | ≥16-char secret for AES-256-GCM token encryption |
| `CRON_SECRET` | ✅ (prod) | server | Bearer token Vercel Cron uses to call `/api/sync/all` |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | ✅ | server | Alpaca market-data credentials |
| `ETRADE_CONSUMER_KEY` / `_SECRET` / `ETRADE_REDIRECT_URI` | optional | server | E\*TRADE OAuth 1.0a |
| `SCHWAB_CLIENT_ID` / `_SECRET` / `SCHWAB_REDIRECT_URI` | optional | server | Schwab OAuth 2.0 |
| `ENABLE_ROBINHOOD_EXPERIMENTAL` | optional | server | `true` to enable the experimental Robinhood integration |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | optional | server | Distributed rate limiting (falls back to in-memory) |

---

## Vercel deployment

1. Import the repo into Vercel; add every variable above as a project env var.
2. Install command: `npm install --legacy-peer-deps`.
3. `vercel.json` declares the daily cron:

   ```json
   { "crons": [{ "path": "/api/sync/all", "schedule": "0 0 * * *" }] }
   ```

   Vercel attaches `Authorization: Bearer ${CRON_SECRET}`, which `/api/sync/all`
   verifies before running an all-accounts service-role sync.
4. For Schwab/E\*TRADE, register the production callback URLs with the brokers.

---

## Testing

```bash
npm test            # unit + integration (Vitest)
npm run test:e2e    # Playwright E2E (needs: npm run build && npx playwright install)
```

Unit/integration coverage: env validation, encryption, validation helpers,
portfolio calculations, CSV parse + export, rate limiting, `computeHoldingRows`,
`replaceAccountHoldings`, sync-engine success/failure/skip + success counting,
and the `/api/prices` route. E2E covers public pages and auth redirects;
authenticated flows (demo/import/disconnect) are scaffolded and need a seeded
test user.

---

## Production caveats

- **Broker approval is on you.** Schwab and E\*TRADE require approved developer
  apps and credentials before their OAuth flows will work with real accounts.
- **Robinhood is experimental.** It relies on an unofficial endpoint and is
  disabled by default. Do not use it with a real-money account.
- **Real-money security.** This is a portfolio/demo project. Before handling real
  users’ live accounts you’d want a formal security review, secrets management
  (e.g. a KMS), token rotation policies, and monitoring/alerting.
- **Prices** come from Alpaca’s IEX feed and may differ slightly from your
  broker’s marks; the dashboard refreshes every ~30s during market hours.

## Known limitations

- Transaction history is a **read-only view** — transaction import from brokers
  is not implemented, so it stays empty until added.
- The in-memory rate limiter is per-instance; use Upstash for multi-instance.
- Playwright authenticated E2E needs a seeded test user (not included).

---

## Résumé bullets

- Built a full-stack multi-broker portfolio tracker (Next.js 16, TypeScript,
  Supabase Postgres + Auth + RLS + Realtime) with a failure-safe, cookie-free
  server-side sync engine and truthful success accounting.
- Hardened for production: AES-256-GCM token encryption with no fallback,
  Zod env validation, RLS least-privilege (service-role-only cache writes),
  OAuth CSRF protection, audit-safe logging, and Upstash-backed rate limiting.
- Authored formal SQL migrations with indexes and a `sync_logs` audit table; set
  up CI (type-check, lint, 58 tests, build) and Playwright E2E.

---

Built with Next.js · TypeScript · Supabase · Alpaca Markets · Recharts · Tailwind · Vitest · Playwright.
