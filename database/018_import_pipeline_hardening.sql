-- Migration 018: Harden student bulk import pipeline
-- Adds rollback status support and keeps mapping metadata available for audited preview imports.

ALTER TABLE v2_import_batches
  MODIFY status ENUM(
    'validating',
    'ready',
    'approved',
    'importing',
    'completed',
    'completed_with_errors',
    'rejected',
    'cancelled',
    'rolled_back'
  ) NOT NULL DEFAULT 'validating';

ALTER TABLE v2_import_batches
  ADD COLUMN IF NOT EXISTS mapping_json JSON NULL AFTER last_processed_row;

ALTER TABLE v2_import_batches
  ADD COLUMN IF NOT EXISTS error_message TEXT NULL AFTER cancelled_by;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'v2_import_batches'
    AND INDEX_NAME = 'idx_v2_import_school_status_time'
);
SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE v2_import_batches ADD KEY idx_v2_import_school_status_time (school_id, status, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
