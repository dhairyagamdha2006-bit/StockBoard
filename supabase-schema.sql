-- ============================================================
-- StockBoard — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
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

-- Transaction history
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

-- Price cache
CREATE TABLE IF NOT EXISTS price_cache (
  ticker TEXT PRIMARY KEY,
  current_price DECIMAL(18,4),
  previous_close DECIMAL(18,4),
  day_change DECIMAL(18,4),
  day_change_pct DECIMAL(8,4),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio snapshots for performance chart
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_value DECIMAL(18,2),
  total_gain_loss DECIMAL(18,2),
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
-- price_cache: RLS enabled below; authenticated read-only, service-role writes.

-- broker_accounts policies
CREATE POLICY "Users can manage their own broker accounts"
  ON broker_accounts FOR ALL USING (auth.uid() = user_id);

-- holdings policies
CREATE POLICY "Users can manage their own holdings"
  ON holdings FOR ALL USING (auth.uid() = user_id);

-- transactions policies
CREATE POLICY "Users can manage their own transactions"
  ON transactions FOR ALL USING (auth.uid() = user_id);

-- portfolio_snapshots policies
CREATE POLICY "Users can manage their own snapshots"
  ON portfolio_snapshots FOR ALL USING (auth.uid() = user_id);

-- price_cache: authenticated users may READ only.
-- Writes are performed exclusively by server-side code using the service-role
-- key, which BYPASSES RLS. We deliberately do NOT grant INSERT/UPDATE/DELETE to
-- the `authenticated` role, so a malicious client can never poison cached prices.
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read price cache"
  ON price_cache FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- Realtime — enable for price_cache updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE price_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE holdings;
