-- ============================================================
-- StockBoard — 0004 Watchlist (existing DBs)
-- Idempotent. Fresh installs already get this from 0001.
-- ============================================================

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_symbol ON watchlist_items(user_id, symbol);

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON watchlist_items;
CREATE POLICY "Users can manage their own watchlist"
  ON watchlist_items FOR ALL USING (auth.uid() = user_id);
