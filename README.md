# StockBoard

[![CI](https://github.com/dhairyagamdha2006-bit/StockBoard/actions/workflows/ci.yml/badge.svg)](https://github.com/dhairyagamdha2006-bit/StockBoard/actions/workflows/ci.yml)

StockBoard is a portfolio tracker I built to solve a problem I kept running into: my holdings were scattered across different brokerages and I had no single place to see them together. So I built one dashboard that brings everything into a single view — plus a market explorer, a watchlist, analytics, and an honest sync system.

The thing I care about most here is that it actually works for a new user **without** needing any broker to approve a developer app: **CSV import is the reliable default for every broker.** Official OAuth (Schwab, E\*TRADE) is an optional upgrade when you have it configured.

> **Want to try it instantly?** Sign up, open the dashboard, and click **Load Demo Data** — it seeds realistic sample holdings and 30 days of history so you can explore everything without connecting a real account.

---

## What it does

- **Unified holdings** from Fidelity, Schwab, E\*TRADE, and Robinhood via CSV import.
- **Optional OAuth** for Schwab and E\*TRADE when you have an approved developer app.
- **Market explorer** — search any stock, see a quote, and open a detail page with an interactive price chart (1D / 1W / 1M / 3M / 1Y).
- **Watchlist** — track symbols you don't own yet, with live-ish quotes.
- **Analytics** — allocation breakdown, top gainers/losers, and a performance chart built from real daily snapshots (honest empty state until history exists).
- **Sync logs** — every sync/import attempt is recorded with status, message, and duration, so you can see exactly what happened and why.
- **Demo mode** so anyone can explore the app immediately.
StockBoard is a portfolio tracker I built to solve a problem I kept running into: my investments were scattered across different brokerages, and I had no single place to see everything together. Instead of logging into multiple apps, I wanted one dashboard that pulls my holdings into a single view.

It connects to **Fidelity** (via CSV import), and **E\*TRADE** and **Charles Schwab** (through their official read-only OAuth APIs). It shows your holdings, portfolio value, allocation breakdown, daily snapshots, and refreshes prices automatically.

> **Want to try it without connecting a real account?** Sign up, open the dashboard, and click **Load Demo Data**. It seeds realistic sample holdings so you can explore everything — no brokerage credentials needed.

---

## What it does

- **Aggregates holdings** from multiple brokers into one dashboard.
- **Auto-updating prices** from Alpaca Markets (refreshed every ~30s during market hours, plus instant pushes through Supabase Realtime).
- **Daily portfolio snapshots** that power the performance chart (it shows an honest empty state until you have history — no fake data).
- **Analytics**: allocation breakdown, top gainers/losers, and a holdings table with search, sorting, filtering, and CSV export.
- **Demo mode** so anyone can explore the app instantly.
- **Connect / sync / disconnect** flows with clear status for each account (connected, syncing, error/reconnect, disconnected).

---

## Broker support (being upfront)

I didn't want to overstate what works, so here's the honest breakdown:

| Broker | How it connects | Status |
| --- | --- | --- |
| **Fidelity** | CSV import (export Positions → upload) | Works out of the box, no setup needed |
| **Charles Schwab** | Official OAuth 2.0 (read-only) | Implemented — needs an approved Schwab developer app |
| **E\*TRADE** | Official OAuth 1.0a (read-only) | Implemented — needs a developer consumer key (sandbox works for testing) |
| **Robinhood** | Unofficial private API | Experimental, off by default — Robinhood has no public API, so I don't recommend it for real accounts |

Fidelity CSV import works for anyone right away. Schwab and E\*TRADE are fully built, but each broker requires you to register a developer app and get it approved before their OAuth will work with real accounts — that approval is on the broker's side, not something the app can skip. Robinhood is intentionally disabled by default and only meant for experimentation.

## Broker support (being upfront)

| Broker | CSV import | Official OAuth | Notes |
| --- | --- | --- | --- |
| **Fidelity** | ✅ Works out of the box | — | Export Positions → upload |
| **Charles Schwab** | ✅ Works out of the box | Optional (needs approved dev app) | OAuth is read-only + auto-refreshing |
| **E\*TRADE** | ✅ Works out of the box | Optional (needs developer keys) | Sandbox keys work for testing |
| **Robinhood** | ✅ Works out of the box | — | No public API; unofficial login is experimental and **off by default** |
---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Supabase** — Postgres, Auth, Row Level Security, and Realtime
- **Alpaca Markets** for price data
- **Recharts** for charts, **Tailwind CSS** for styling
- **Vitest** for tests, **Playwright** for end-to-end tests
- Deployed on **Vercel** (with a daily cron job for background syncing)

CSV import needs no approval and works for everyone. OAuth requires you to register and get a developer app approved by the broker — that's on the broker's side, not something the app can skip. Robinhood's unofficial username/password login stays disabled unless you explicitly set `ENABLE_ROBINHOOD_EXPERIMENTAL=true`, and I don't recommend it for real accounts.

### CSV format expectations

Each parser understands its broker's standard export and falls back to flexible column detection if the format is unfamiliar (it'll warn you in the preview). At minimum it needs **Symbol**, **Quantity/Shares**, and a **Price**; cost basis is used when present.

- **Fidelity** — `Symbol, Description, Quantity, Last Price, Current Value, Average Cost Basis, Type`
- **Schwab** — `Symbol, Description, Quantity, Price, Market Value, Cost Basis, Security Type` (preamble + cash/total rows are ignored)
- **E\*TRADE** — `Symbol, Last Price $, Quantity, Price Paid $, Value $` (TOTAL row ignored)
- **Robinhood** — a simple `Symbol, Shares, Average Cost, Price` template
- **Anything else** — common column names like Ticker, Name, Qty, Cost Basis, Market Value

---

## Tech stack

Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, RLS, Realtime) · Alpaca Markets · Recharts · Tailwind CSS · Vitest · Playwright · deployed on Vercel.

---

## How it's built

```
app/
  dashboard/               Dashboard, holdings, analytics, history, market, sync-logs
  connect/<broker>/        CSV import + optional OAuth flows
  api/
    import/[broker]        Generic CSV import (fidelity|schwab|etrade|robinhood)
    sync/<broker> + all    Server-side sync engine (cron + manual)
    market/{search,quote,bars}   Server-side Alpaca data (keys never leave server)
    watchlist              GET/POST/DELETE the user's watchlist
    prices, disconnect, demo, brokers/status
lib/
  env.ts                   Zod env validation (fails loudly, no placeholders)
  brokers/csv-parsers/     Per-broker parsers + generic fallback + orchestrator
  brokers/support.ts       Honest support matrix (single source of truth)
  sync/                    Failure-safe sync engine + sync_logs
  prices/{alpaca,market}.ts  Quotes, historical bars, symbol search (cached)
  utils/{logger,encryption,validation,rateLimit,csv}.ts
supabase/migrations/       Schema, indexes, RLS, sync_logs, watchlist
tests/ + e2e/              Vitest unit/integration + Playwright E2E
```

A few decisions I'm happy with:

- **CSV is a first-class connection method**, not an afterthought — so the app is useful even with zero broker approvals.
- **Sync runs server-side** with a service-role key (never the browser session), only counts a sync as successful if the broker actually returned data, and is **failure-safe**: it updates holdings with upsert-then-delete-stale, so a broker outage never wipes your portfolio.
- **CSV import never silently destroys an OAuth connection** — if you import a CSV for a broker that's already connected via OAuth, it asks whether to keep OAuth or replace it.
- **Secrets stay server-side and never get logged.** A small logger deep-redacts anything sensitive (tokens, cookies, keys, codes) before writing.

---

## Getting it running locally

You'll need Node 18+, a Supabase project, and a free Alpaca API key.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local        # fill in real values (table below)
openssl rand -hex 32              # ENCRYPTION_KEY
openssl rand -hex 32              # CRON_SECRET
```

Run the database migrations in the Supabase SQL Editor:

- **Fresh project:** run `supabase/migrations/0001_initial_schema.sql`.
- **Upgrading an older DB:** also run `0002_hardening_upgrade.sql`, `0003_sync_logs_columns.sql`, and `0004_watchlist.sql`.

Then:

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # Vitest (unit + integration)
npm run build        # production build
```
## How it's built

```
app/
  page.tsx                 Landing page
  login / signup           Supabase Auth
  dashboard/               Holdings, analytics, history, connected accounts
  connect/<broker>/        Connect flows + OAuth callbacks
  api/
    connect/<broker>       Start/finish a broker connection
    sync/<broker>          Manual sync for one broker
    sync/all               Cron + "sync everything"
    import/fidelity        Parse a Fidelity CSV into holdings
    prices                 Fetch quotes + update the price cache
    disconnect             Remove a broker and its holdings
    demo                   Load / clear demo data
lib/
  env.ts                   Validates environment variables on startup
  sync/                    The sync engine (runs server-side)
  brokers/                 Per-broker clients + the support matrix
  prices/alpaca.ts         Alpaca price fetching
  utils/                   encryption, validation, rate limiting, CSV helpers
supabase/migrations/       SQL schema, indexes, and RLS policies
tests/                     Unit + integration tests
e2e/                       Playwright tests
```

A few decisions I'm happy with:

- **The sync runs server-side.** The cron job and manual "Sync Now" both use the same engine, which talks to the database with a service-role key on the server instead of relying on the user's browser session. It only counts a sync as successful if the broker actually returned data.
- **Syncing is safe.** When it updates holdings it upserts the new positions first and then removes the stale ones, so a broker outage mid-sync never wipes your portfolio. Every attempt gets logged so you can see what happened.
- **Tokens are encrypted.** Broker tokens are encrypted with AES-256-GCM before they're stored, and the app refuses to start if the encryption key isn't set properly.
- **The database is locked down.** Row Level Security makes sure each user can only read their own data, and the price cache is read-only for users — only the server can write to it.

---

## Getting it running locally

You'll need Node 18+, a Supabase project, and a (free) Alpaca API key.

1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Set up your environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Then fill in the values (see the table below). You can generate the secrets with:
   ```bash
   openssl rand -hex 32   # for ENCRYPTION_KEY
   openssl rand -hex 32   # for CRON_SECRET
   ```

3. Set up the database — in the Supabase SQL Editor, run:
   - `supabase/migrations/0001_initial_schema.sql` (for a fresh project)
   - `supabase/migrations/0002_hardening_upgrade.sql` (only if you have an older database)

4. Start it:
   ```bash
   npm run dev          # http://localhost:3000
   npm run typecheck    # type-check
   npm run lint         # lint
   npm test             # run the test suite
   npm run build        # production build
   ```

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key (server-only — never expose) |
| `ENCRYPTION_KEY` | Yes | Encrypts broker tokens (`openssl rand -hex 32`) |
| `CRON_SECRET` | Yes (prod) | Protects the cron sync endpoint |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | Yes | Alpaca market data (quotes, charts, search) |
| `SCHWAB_CLIENT_ID` / `_SECRET` / `SCHWAB_REDIRECT_URI` | Optional | Schwab OAuth |
| `ETRADE_CONSUMER_KEY` / `_SECRET` / `ETRADE_REDIRECT_URI` | Optional | E\*TRADE OAuth |
| `ENABLE_ROBINHOOD_EXPERIMENTAL` | Optional | `true` to enable the experimental Robinhood login |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional | Distributed rate limiting (else in-memory) |
| `SENTRY_DSN` | Optional | Error monitoring (no-op unless set) |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | Optional | Seeded user for authenticated E2E |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key (server-only — never expose this) |
| `ENCRYPTION_KEY` | Yes | Secret used to encrypt broker tokens (`openssl rand -hex 32`) |
| `CRON_SECRET` | Yes (prod) | Protects the cron sync endpoint |
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | Yes | Alpaca market-data credentials |
| `SCHWAB_CLIENT_ID` / `SCHWAB_CLIENT_SECRET` / `SCHWAB_REDIRECT_URI` | Optional | Schwab OAuth |
| `ETRADE_CONSUMER_KEY` / `ETRADE_CONSUMER_SECRET` / `ETRADE_REDIRECT_URI` | Optional | E\*TRADE OAuth |
| `ENABLE_ROBINHOOD_EXPERIMENTAL` | Optional | Set to `true` to enable the experimental Robinhood integration |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional | Distributed rate limiting (falls back to in-memory if unset) |

---

## Deploying to Vercel

1. Import the repo, add the env vars above.
2. Install command: `npm install --legacy-peer-deps`.
3. `vercel.json` declares a daily cron that hits `/api/sync/all`:
   ```json
   { "crons": [{ "path": "/api/sync/all", "schedule": "0 0 * * *" }] }
   ```
   Vercel attaches `Authorization: Bearer ${CRON_SECRET}`, which the route verifies before running a service-role sync.
4. Register production callback URLs with Schwab/E\*TRADE if you use OAuth.

---

## Security model

- **Encrypted tokens** — broker tokens are AES-256-GCM encrypted before storage; the app refuses to start without a real `ENCRYPTION_KEY`.
- **Validated env** — Zod validation fails loudly on missing/placeholder values.
- **Row Level Security** — every user table is scoped to `auth.uid()`. `price_cache` and `sync_logs` are read-only for users (only the server writes them); watchlists are user-owned.
- **Service-role isolation** — the privileged client is `server-only` and can't be imported into client code.
- **OAuth CSRF** — Schwab uses a `state` value bound to an httpOnly cookie; E\*TRADE binds the request-token secret the same way.
- **Safe logging** — tokens, secrets, cookies, auth codes, and API keys are deep-redacted; broker error bodies are never logged.
- **Rate limiting** — per-user limits on connect, sync, import, prices, market, watchlist, and demo routes (Upstash in prod, in-memory in dev).
1. Import the repo into Vercel and add all the environment variables above.
2. Set the install command to `npm install --legacy-peer-deps`.
3. The `vercel.json` file already sets up a daily cron job that hits `/api/sync/all` to refresh everyone's holdings:
   ```json
   { "crons": [{ "path": "/api/sync/all", "schedule": "0 0 * * *" }] }
   ```
4. If you're using Schwab or E\*TRADE, register your production callback URLs with them.

---

## Screenshots

I capture these with Playwright. Run:

```bash
npm run build
npx playwright install
npm run screenshots
```

Public pages are captured automatically. For the dashboard screenshots, set `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` to a seeded Supabase user first (no broker credentials needed) — the script logs in, loads demo data, and saves images to `public/screenshots/`.

| Dashboard | Holdings | Market |
| --- | --- | --- |
| `public/screenshots/dashboard.png` | `public/screenshots/holdings.png` | `public/screenshots/market.png` |

---

## Testing

```bash
npm test            # Vitest unit + integration
npm run test:e2e    # Playwright (after: npm run build && npx playwright install)
npm run test:e2e:ui # Playwright UI mode
```

The Vitest suite covers env validation, encryption, the safe logger's redaction, all CSV parsers (with fixtures), the generic import API (including OAuth-preservation), portfolio math, rate limiting, the sync engine (success/failure/skip + counting), the Schwab callback state check, the prices route, and the watchlist API.

Playwright covers the public pages and auth redirects out of the box. The authenticated flows (demo, holdings search, CSV import for each broker, market, sync logs) run when you provide a seeded test user — **no broker credentials are ever required.**

---

## Known limitations

- **Transaction history** is a read-only view — I haven't built importing transactions from brokers, so it stays empty until I add it.
- **CSV holdings** don't include intraday day-change until the live price refresh runs (I intentionally don't fabricate movement).
- The in-memory rate limiter is per-instance; use Upstash for multi-instance deployments.
- Symbol search depends on Alpaca's asset list (US equities) and a working Alpaca account.

## Production caveats

This started as a learning/portfolio project. The security fundamentals are here, but before trusting it with real money and real users I'd want a formal security review, managed secret storage (a KMS), token-rotation policies, and proper monitoring/alerting. I built it to learn how to do these things properly, and I tried to be honest about exactly where it stands.
npm test            # unit + integration tests
npm run test:e2e    # Playwright (run: npm run build && npx playwright install first)
```

The tests cover the encryption, environment validation, CSV parsing and export, the sync engine (including failure and skip cases), the holdings logic, rate limiting, and an API route. The Playwright tests cover the public pages and auth redirects.

---

## Things I'd improve next

- **Transaction history** is currently a read-only view — I haven't built importing transactions from brokers yet, so it stays empty for now.
- The built-in rate limiter is in-memory; for a real multi-instance deployment I'd wire up the Upstash Redis option.
- Adding more end-to-end tests for the logged-in flows (importing a CSV, disconnecting, etc.) with a seeded test user.

---

## A note on security

This started as a personal/learning project. The fundamentals are in place — encrypted tokens, row-level security, validated environment, rate limiting, and read-only broker access — but before trusting it with real money and real users, it would need a proper security review, managed secret storage, and monitoring. I built it to learn how to do these things right, and I tried to be honest about where it stands.
