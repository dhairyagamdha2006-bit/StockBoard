# StockBoard

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

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Supabase** — Postgres, Auth, Row Level Security, and Realtime
- **Alpaca Markets** for price data
- **Recharts** for charts, **Tailwind CSS** for styling
- **Vitest** for tests, **Playwright** for end-to-end tests
- Deployed on **Vercel** (with a daily cron job for background syncing)

---

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

1. Import the repo into Vercel and add all the environment variables above.
2. Set the install command to `npm install --legacy-peer-deps`.
3. The `vercel.json` file already sets up a daily cron job that hits `/api/sync/all` to refresh everyone's holdings:
   ```json
   { "crons": [{ "path": "/api/sync/all", "schedule": "0 0 * * *" }] }
   ```
4. If you're using Schwab or E\*TRADE, register your production callback URLs with them.

---

## Testing

```bash
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
