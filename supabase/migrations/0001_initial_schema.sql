-- ============================================================
-- StockBoard — 0001 Initial Schema (canonical, fresh install)
-- Run in the Supabase SQL Editor, or via the Supabase CLI.
-- Idempotent: safe to re-run.
-- ============================================================

-- Broker accounts linked to each user
CREATE TABLE IF NOT EXISTS broker_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  connection_type TEXT,
  status TEXT DEFAULT 'active',
  -- Demo accounts are flagged so "Clear demo data" removes ONLY demo data and
  -- never a real (also token-less) CSV import.
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_name)
);

-- Unified holdings across all brokers
CREATE TABLE IF NOT EXISTS holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES broker_accounts(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  company_name TEXT,
  shares DECIMAL(18,6) NOT NULL,
  average_cost DECIMAL(18,4),
  current_price DECIMAL(18,4),
  market_value DECIMAL(18,2),
  day_change DECIMAL(18,4),
  day_change_pct DECIMAL(8,4),
  total_gain_loss DECIMAL(18,2),
  total_gain_loss_pct DECIMAL(8,4),
  sector TEXT,
  asset_type TEXT DEFAULT 'stock',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Required for the safe upsert-then-delete-stale sync (lib/sync/holdings.ts).
  UNIQUE(account_id, ticker)
);

-- Transaction history (read-only view in the app; not yet populated by sync)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES broker_accounts(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  shares DECIMAL(18,6),
  price DECIMAL(18,4),
  total_amount DECIMAL(18,2),
  fees DECIMAL(10,4) DEFAULT 0,
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price cache (written only by server/service-role; read by authenticated users)
CREATE TABLE IF NOT EXISTS price_cache (
  ticker TEXT PRIMARY KEY,
  current_price DECIMAL(18,4),
  previous_close DECIMAL(18,4),
  day_change DECIMAL(18,4),
  day_change_pct DECIMAL(8,4),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio snapshots for the performance chart
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_value DECIMAL(18,2),
  total_gain_loss DECIMAL(18,2),
  snapshot_date DATE NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- Sync logs — every sync/import attempt's outcome, surfaced to the user
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL,
  broker_name TEXT NOT NULL,
  status TEXT NOT NULL,            -- 'success' | 'failed' | 'skipped'
  message TEXT,                    -- user-friendly summary (never raw errors/tokens)
  holdings_synced INT DEFAULT 0,
  holdings_removed INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,             -- legacy column kept for back-compat
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlist — symbols a user is tracking (not necessarily owned)
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_user_broker ON broker_accounts(user_id, broker_name);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_created ON sync_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_broker ON sync_logs(user_id, broker_name);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_status ON sync_logs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_symbol ON watchlist_items(user_id, symbol);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own broker accounts" ON broker_accounts;
CREATE POLICY "Users can manage their own broker accounts"
  ON broker_accounts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own holdings" ON holdings;
CREATE POLICY "Users can manage their own holdings"
  ON holdings FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
CREATE POLICY "Users can manage their own transactions"
  ON transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own snapshots" ON portfolio_snapshots;
CREATE POLICY "Users can manage their own snapshots"
  ON portfolio_snapshots FOR ALL USING (auth.uid() = user_id);

-- sync_logs: users may READ their own; writes happen via service-role (bypasses RLS).
DROP POLICY IF EXISTS "Users can read their own sync logs" ON sync_logs;
CREATE POLICY "Users can read their own sync logs"
  ON sync_logs FOR SELECT USING (auth.uid() = user_id);

-- watchlist_items: users fully manage their own.
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON watchlist_items;
CREATE POLICY "Users can manage their own watchlist"
  ON watchlist_items FOR ALL USING (auth.uid() = user_id);

-- price_cache: authenticated READ only. Writes are service-role only (bypasses RLS),
-- so a malicious client can never poison cached prices.
DROP POLICY IF EXISTS "Authenticated users can read price cache" ON price_cache;
CREATE POLICY "Authenticated users can read price cache"
  ON price_cache FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Realtime — push price + holdings updates to the client
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'price_cache'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE price_cache;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'holdings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE holdings;
  END IF;
END $$;
