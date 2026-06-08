-- ============================================================
-- StockBoard — 0005 Demo marker (upgrade for existing databases)
-- ============================================================
-- Adds an explicit `is_demo` flag so "Clear demo data" removes ONLY demo data.
--
-- Why: demo accounts and CSV-imported accounts are both token-less. The previous
-- demo-cleanup heuristic ("token-less account on a demo broker") could therefore
-- delete a user's REAL CSV import for Robinhood/Schwab. The explicit flag fixes
-- that permanently.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE broker_accounts   ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE portfolio_snapshots ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: classify pre-existing demo accounts (token-less, NOT csv, on a demo
-- broker) so already-seeded demo data still cleans up. CSV imports are excluded
-- and therefore preserved.
UPDATE broker_accounts
   SET is_demo = TRUE
 WHERE is_demo = FALSE
   AND access_token IS NULL
   AND refresh_token IS NULL
   AND COALESCE(connection_type, '') <> 'csv'
   AND broker_name IN ('robinhood', 'schwab');

CREATE INDEX IF NOT EXISTS idx_broker_accounts_user_demo ON broker_accounts(user_id, is_demo);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_demo ON portfolio_snapshots(user_id, is_demo);
