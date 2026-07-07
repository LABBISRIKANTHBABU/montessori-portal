-- Client meeting requirements: secure recovery, canonical student lifecycle,
-- and a traceable one-to-one cashbook/voucher relationship.

CREATE TABLE IF NOT EXISTS v2_password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  requested_ip VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_reset_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
  CONSTRAINT fk_v2_reset_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_reset_hash (token_hash),
  KEY idx_v2_reset_lookup (school_id, token_hash, expires_at),
  KEY idx_v2_reset_user (user_id, used_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE v2_students
  MODIFY current_status ENUM(
    'active','inactive','dropped','transferred','alumni',
    'withdrawn','suspended','deleted'
  ) NOT NULL DEFAULT 'active';

ALTER TABLE v2_vouchers
  ADD COLUMN source_cashbook_id BIGINT UNSIGNED NULL AFTER approved_by,
  ADD CONSTRAINT fk_v2_voucher_cashbook
    FOREIGN KEY (source_cashbook_id) REFERENCES v2_daily_cashbook(id),
  ADD UNIQUE KEY uq_v2_voucher_cashbook (source_cashbook_id);
