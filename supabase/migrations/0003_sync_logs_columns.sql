-- ============================================================
-- StockBoard — 0003 Sync Logs columns + indexes (existing DBs)
-- Idempotent. Fresh installs already get this from 0001.
-- ============================================================

ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_broker ON sync_logs(user_id, broker_name);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_status ON sync_logs(user_id, status);
