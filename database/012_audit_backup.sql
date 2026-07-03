-- Module 11: Audit & Backup
-- Extended audit logging and backup tracking

-- Extend existing v2_audit_events with more detail
ALTER TABLE v2_audit_events
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS old_values JSON NULL,
  ADD COLUMN IF NOT EXISTS new_values JSON NULL;

-- System logs for application-level events
CREATE TABLE IF NOT EXISTS v2_system_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NULL,
  log_level ENUM('info','warn','error','critical') NOT NULL DEFAULT 'info',
  source VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_v2_syslog_school (school_id, created_at),
  KEY idx_v2_syslog_level (log_level, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backup tracking
CREATE TABLE IF NOT EXISTS v2_backups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  backup_type ENUM('database','files','full') NOT NULL,
  storage_location VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  status ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  initiated_by BIGINT UNSIGNED NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_backup_initiator FOREIGN KEY (initiated_by) REFERENCES v2_users(id),
  KEY idx_v2_backup_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
