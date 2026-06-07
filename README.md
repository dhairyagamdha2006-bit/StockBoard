# StockBoard

**One dashboard for every brokerage.** StockBoard unifies your Robinhood,
Fidelity, E\*TRADE, and Charles Schwab positions into a single, auto-updating
portfolio view — with live-ish pricing, performance history, sector analytics,
and a full transaction log.

Built with Next.js 16 (App Router), Supabase (Postgres + Auth + Realtime + RLS),
and Alpaca Markets for quotes.

> **Just want to see it?** Sign up, open the dashboard, and click **Load Demo
> Data** — no real brokerage credentials required.

---

## Screenshots

> Add images to `docs/screenshots/` and reference them here.

| Dashboard | Holdings | Analytics |
| --- | --- | --- |
| `docs/screenshots/dashboard.png` | `docs/screenshots/holdings.png` | `docs/screenshots/analytics.png` |

---

## Features

- **4 brokers, one view** — Robinhood (credentials + MFA), Fidelity (CSV import),
  E\*TRADE (OAuth 1.0a), Charles Schwab (OAuth 2.0 with token refresh).
- **Auto-updating prices** — Alpaca quotes refreshed every 30s on the client,
  with instant Supabase Realtime pushes when the server cache updates.
- **Daily background sync** — a Vercel Cron job re-syncs every connected account
  once per day; **Sync Now** triggers an instant refresh.
- **Honest analytics** — performance chart is driven by real daily portfolio
  snapshots. No data yet? You get an empty state, not a fabricated trend line.
- **Demo mode** — seed realistic sample holdings + 30 days of snapshot history,
  and clear it again in one click.
- **Disconnect / reconnect** — revoke a broker (wipes tokens + holdings) and
  reconnect anytime.
- **Encrypted at rest** — broker tokens are AES-256-GCM encrypted before they
  hit the database.

---

## Architecture

```
Next.js (App Router)
├── app/
│   ├── page.tsx                 Landing page
│   ├── login, signup            Supabase Auth
│   ├── dashboard/               Portfolio UI (holdings, analytics, history)
│   ├── connect/<broker>/        Broker connect flows + OAuth callbacks
│   └── api/
│       ├── connect/<broker>     Start/complete a broker connection
│       ├── sync/<broker>        Manual per-broker sync (user-scoped auth)
│       ├── sync/all             Cron + user "sync everything" (service-role)
│       ├── import/fidelity      CSV upload → holdings
│       ├── prices               Alpaca quotes + price_cache write (service-role)
│       ├── disconnect           Revoke a broker
│       └── demo                 Seed / clear demo data
├── lib/
│   ├── sync/
│   │   ├── engine.ts            syncBrokerAccount / syncAccounts (server-side)
│   │   ├── holdings.ts          computeHoldingRows + safe upsert/delete-stale
│   │   └── route-helper.ts      Shared per-broker route handler
│   ├── brokers/                 Per-broker API clients + normalizers
│   ├── prices/alpaca.ts         Alpaca snapshots + websocket helper
│   ├── demo/seed.ts             Demo data seeding
│   └── utils/
│       ├── encryption.ts        AES-256-GCM (no insecure fallback)
│       ├── validation.ts        Ticker / broker / MFA / string guards
│       └── rateLimit.ts         In-memory fixed-window limiter
├── supabase-schema.sql          Full schema + RLS (fresh install)
└── supabase-migration-hardening.sql  Idempotent migration for existing DBs
```

### How sync works

1. **Auth.** `/api/sync/<broker>` verifies the signed-in user. `/api/sync/all`
   accepts either a signed-in user (syncs only their accounts) or a Vercel Cron
   request authenticated with `Authorization: Bearer ${CRON_SECRET}` (syncs all
   accounts across all users).
2. **Execution.** The actual broker pull + DB write always run **server-side
   with the Supabase service-role client** (`lib/sync/engine.ts`). Nothing
   depends on forwarding the caller's auth cookie to sub-requests.
3. **Safety.** Holdings are written with an **upsert-then-delete-stale** strategy
   (requires `UNIQUE(account_id, ticker)`), so an account is never momentarily
   emptied by a destructive delete-then-insert.
4. **Counting.** `syncAccounts` reports only accounts that *genuinely* synced
   (`ok && !skipped`) — not merely HTTP 200s.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project
- An Alpaca Markets API key (free tier is fine)

### 1. Install

```bash
npm install --legacy-peer-deps
```

### 2. Configure environment

```bash
cp .env.example .env.local
# then fill in real values (see the table below)
```

Generate strong secrets:

```bash
openssl rand -hex 32   # use for ENCRYPTION_KEY
openssl rand -hex 32   # use for CRON_SECRET
```

### 3. Set up the database

In the Supabase SQL Editor, run **`supabase-schema.sql`** (fresh project) or
**`supabase-migration-hardening.sql`** (existing project that predates the
hardening changes).

### 4. Run

```bash
npm run dev      # http://localhost:3000
npm test         # run the unit test suite
npm run build    # production build
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
| `ALPACA_API_KEY` | ✅ | server | Alpaca market-data key |
| `ALPACA_SECRET_KEY` | ✅ | server | Alpaca market-data secret |
| `ETRADE_CONSUMER_KEY` | optional | server | E\*TRADE OAuth 1.0a consumer key |
| `ETRADE_CONSUMER_SECRET` | optional | server | E\*TRADE OAuth 1.0a consumer secret |
| `ETRADE_REDIRECT_URI` | optional | server | E\*TRADE OAuth callback URL |
| `SCHWAB_CLIENT_ID` | optional | server | Schwab OAuth 2.0 client id |
| `SCHWAB_CLIENT_SECRET` | optional | server | Schwab OAuth 2.0 client secret |
| `SCHWAB_REDIRECT_URI` | optional | server | Schwab OAuth callback URL |

---

## Deployment (Vercel)

1. Import the repo into Vercel and add every variable above as a project env var.
2. `vercel.json` already declares the cron job:

   ```json
   { "crons": [{ "path": "/api/sync/all", "schedule": "0 0 * * *" }] }
   ```

   Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}` to cron
   invocations, which `/api/sync/all` verifies before running a service-role sync.
3. The install command is set to `npm install --legacy-peer-deps`.

---

## Security notes

- **Token encryption.** Broker access/refresh tokens are AES-256-GCM encrypted
  (`lib/utils/encryption.ts`) using a key derived from `ENCRYPTION_KEY` via
  scrypt. There is **no fallback key** — the module throws if the key is missing,
  too short, or the template placeholder, so tokens are never written with a
  guessable key.
- **Row Level Security.** Every user-owned table (`broker_accounts`, `holdings`,
  `transactions`, `portfolio_snapshots`) is RLS-scoped to `auth.uid()`.
  `price_cache` is **read-only for authenticated users**; only server-side
  service-role code may write it, so clients can't poison cached prices.
- **Service-role isolation.** The service-role key is used only in server routes
  and never shipped to the browser.
- **Input validation & rate limiting.** Connect, sync, import, prices, demo, and
  disconnect routes validate inputs (tickers, broker names, MFA codes, file
  size) and apply per-user fixed-window rate limits (`lib/utils/rateLimit.ts`).
  The in-memory limiter is single-instance; swap in Upstash Redis for
  multi-region scale (the call sites stay identical).
- **Cron auth.** `/api/sync/all` only runs an all-users sync when the request
  carries the correct `CRON_SECRET` bearer token.

---

## Testing

```bash
npm test
```

Vitest covers the pure logic that matters most: encryption round-trips and
failure modes, input validation, rate limiting, holdings math, and portfolio
calculations. See `tests/`.

---

## Tech stack

Next.js 16 · React 18 · TypeScript · Supabase (Postgres/Auth/Realtime/RLS) ·
Alpaca Markets · Recharts · Tailwind CSS · Vitest.
