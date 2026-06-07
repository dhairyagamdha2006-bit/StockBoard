-- ============================================================
-- StockBoard — 0002 Hardening Upgrade (for databases created before hardening)
-- Idempotent: safe to run against an existing database.
-- Fresh installs already get all of this from 0001_initial_schema.sql.
-- ============================================================

-- 1) UNIQUE(account_id, ticker) for safe upsert-then-delete-stale sync.
--    De-duplicate any existing rows first, keeping the newest.
DELETE FROM holdings a
USING holdings b
WHERE a.account_id = b.account_id
  AND a.ticker = b.ticker
  AND a.ctid < b.ctid;

ALTER TABLE holdings DROP CONSTRAINT IF EXISTS holdings_account_id_ticker_key;
ALTER TABLE holdings ADD CONSTRAINT holdings_account_id_ticker_key
  UNIQUE (account_id, ticker);

-- 2) Lock down price_cache: authenticated read-only, service-role writes only.
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can upsert price cache" ON price_cache;
DROP POLICY IF EXISTS "Authenticated users can update price cache" ON price_cache;
DROP POLICY IF EXISTS "Authenticated users can read price cache" ON price_cache;
CREATE POLICY "Authenticated users can read price cache"
  ON price_cache FOR SELECT USING (auth.role() = 'authenticated');

-- 3) Performance indexes for common query patterns.
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_user_broker ON broker_accounts(user_id, broker_name);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date DESC);

-- 4) Sync logs table + RLS (read-only for users; service-role writes).
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL,
  broker_name TEXT NOT NULL,
  status TEXT NOT NULL,
  holdings_synced INT DEFAULT 0,
  holdings_removed INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_created ON sync_logs(user_id, created_at DESC);
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own sync logs" ON sync_logs;
CREATE POLICY "Users can read their own sync logs"
  ON sync_logs FOR SELECT USING (auth.uid() = user_id);
