-- ============================================================
-- StockBoard — Production Hardening Migration
-- Safe to run against an existing database (idempotent).
-- Run in the Supabase SQL Editor.
-- ============================================================

-- 1) Required for safe upsert-then-delete-stale sync.
--    De-duplicate any existing (account_id, ticker) rows first, keeping newest.
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
