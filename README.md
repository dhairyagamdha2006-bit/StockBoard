# StockBoard

StockBoard is a full-stack portfolio dashboard that lets users import stock holdings from multiple brokerages, track portfolio performance, search market data, build a watchlist, and view analytics in one secure dashboard.

Built with **Next.js 16**, **TypeScript**, **Supabase**, **PostgreSQL**, **Alpaca Market Data**, **Recharts**, **Tailwind CSS**, and **Vercel**.

---

## Features

* **Multi-broker CSV import** — import holdings from Fidelity, Schwab, E*TRADE, and Robinhood.
* **Broker-specific CSV parsers** — normalizes different brokerage CSV formats into one holdings model.
* **Duplicate ticker handling** — merges duplicate ticker rows before database upsert.
* **Persistent holdings** — imported CSV holdings are saved in Supabase and remain available after logout/login.
* **Portfolio dashboard** — view total value, daily movement, returns, holdings, and broker allocation.
* **Performance chart** — view 1W / 1M / 3M / 1Y portfolio movement based on current holdings and historical market prices.
* **Market Explorer** — search stocks and ETFs, view popular symbols, and track watchlist items.
* **Stock detail pages** — view quote data, price charts, and add/remove symbols from watchlist.
* **Watchlist** — save stocks and ETFs to monitor separately from portfolio holdings.
* **Analytics** — sector allocation, broker breakdown, top gainers, and top losers.
* **Sync logs** — view import/sync status, skipped accounts, failures, and last sync results.
* **Demo mode** — load sample holdings without connecting a real account.
* **Secure by design** — Supabase Auth, Row Level Security, server-only service-role access, encrypted optional OAuth tokens, rate limiting, and safe redacted logging.

---

## Broker Support

| Broker    | CSV Import | OAuth / API Support         | Notes                                                        |
| --------- | ---------- | --------------------------- | ------------------------------------------------------------ |
| Fidelity  | Yes        | No                          | CSV import works out of the box.                             |
| Schwab    | Yes        | Optional OAuth 2.0          | OAuth requires an approved Schwab developer app.             |
| E*TRADE   | Yes        | Optional OAuth 1.0a         | OAuth requires E*TRADE developer keys.                       |
| Robinhood | Yes        | Experimental/off by default | Robinhood has no official public API, so CSV is recommended. |

CSV import is the reliable default connection method. OAuth integrations are optional advanced features when broker developer credentials are available.

---

## Tech Stack

| Layer           | Technology                                               |
| --------------- | -------------------------------------------------------- |
| Framework       | Next.js 16 App Router                                    |
| Language        | TypeScript                                               |
| UI              | React, Tailwind CSS                                      |
| Charts          | Recharts                                                 |
| Auth / Database | Supabase Auth, PostgreSQL, Row Level Security            |
| Market Data     | Alpaca Markets API                                       |
| Testing         | Vitest, Playwright                                       |
| Hosting         | Vercel                                                   |
| Security        | AES-256-GCM token encryption, safe logger, rate limiting |

---

## Architecture

* `app/` — landing page, auth pages, dashboard routes, market pages, and API routes.
* `app/api/import/[broker]` — generic broker CSV import endpoint with preview and confirmation.
* `app/api/portfolio/history` — portfolio performance API using current holdings and historical prices.
* `app/api/market/*` — quote, search, and historical bar endpoints.
* `app/api/watchlist` — authenticated watchlist CRUD.
* `lib/brokers/csv-parsers/` — broker-specific and fallback CSV parsers.
* `lib/sync/` — holdings normalization, duplicate merging, account sync, and safe upsert logic.
* `lib/prices/` — Alpaca market-data integration and fallback asset search.
* `lib/portfolio/` — portfolio history aggregation logic.
* `lib/utils/logger.ts` — safe logging with secret redaction.
* `supabase/migrations/` — database schema, RLS policies, sync logs, watchlist, and demo markers.
* `tests/` — unit and API tests for imports, sync behavior, market search, portfolio history, and CSV persistence.

---

## Screenshots

### Front Page
<img width="1278" height="797" alt="StockBoard front page" src="https://github.com/user-attachments/assets/1362202b-330a-4a3c-83ee-62a9c5f63c7a" />

### Sign In
<img width="1375" height="765" alt="StockBoard sign in page" src="https://github.com/user-attachments/assets/33a73756-d7ff-4e6d-93c3-4cae42fe0fcf" />

### Dashboard
<img width="1370" height="692" alt="StockBoard dashboard" src="https://github.com/user-attachments/assets/377d2007-dc83-4675-9e7c-576aec107adc" />

### Holdings
<img width="1376" height="607" alt="StockBoard holdings table" src="https://github.com/user-attachments/assets/99658b40-beef-4267-a092-f50444671171" />

### Market Explorer
<img width="1390" height="729" alt="StockBoard market explorer" src="https://github.com/user-attachments/assets/5a94a800-598a-4cfb-8201-0e849001edfe" />

### Analytics
<img width="1394" height="743" alt="StockBoard analytics page" src="https://github.com/user-attachments/assets/595420c4-6888-4a4f-a929-a8b96a1e5276" />

## Getting Started

### Prerequisites

* Node.js 20+
* Supabase project
* Alpaca API keys
* Vercel account for deployment

### 1. Clone and install

```bash
git clone https://github.com/dhairyagamdha2006-bit/StockBoard.git
cd StockBoard
npm install --legacy-peer-deps
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Generate secure keys:

```bash
openssl rand -hex 32
```

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=
CRON_SECRET=
ALPACA_API_KEY=
ALPACA_SECRET_KEY=
```

Optional environment variables:

```env
SCHWAB_CLIENT_ID=
SCHWAB_CLIENT_SECRET=
SCHWAB_REDIRECT_URI=
ETRADE_CONSUMER_KEY=
ETRADE_CONSUMER_SECRET=
ETRADE_REDIRECT_URI=
ENABLE_ROBINHOOD_EXPERIMENTAL=false
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```

### 3. Run Supabase migrations

In Supabase SQL Editor, run the migration files in order from:

```text
supabase/migrations/
```

For a fresh database, start with:

```text
0001_initial_schema.sql
```

For an existing database, also run later migrations such as sync logs, watchlist, and demo marker migrations.

### 4. Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Testing

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Optional E2E tests:

```bash
npx playwright install
npm run test:e2e
```

Generate screenshots:

```bash
npm run screenshots
```

---

## Deployment

Deploy on Vercel:

```bash
npx vercel --prod
```

Add all required environment variables in:

```text
Vercel → Project → Settings → Environment Variables
```

If using cron sync, set `CRON_SECRET` and configure the scheduled route in `vercel.json`.

---

## Security Notes

* Supabase Row Level Security isolates each user’s data.
* Service-role access is server-only.
* Optional OAuth tokens are encrypted at rest.
* CSV imports do not require broker credentials.
* Robinhood login is experimental, disabled by default, and not recommended for real accounts.
* Logs redact secrets such as tokens, passwords, cookies, API keys, auth codes, and service-role keys.

---

## Known Limitations

* CSV accounts are manually updated by re-uploading a new CSV.
* Portfolio history is calculated from current holdings and historical prices; it is not a full transaction-based account history.
* Transaction import is not implemented yet.
* Schwab and E*TRADE OAuth require approved broker developer credentials.
* Live market data depends on valid Alpaca API keys.

---

## License

MIT
