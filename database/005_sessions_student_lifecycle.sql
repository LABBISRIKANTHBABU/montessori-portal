ALTER TABLE v2_users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS v2_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  CONSTRAINT fk_v2_session_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
  CONSTRAINT fk_v2_session_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_refresh_hash (refresh_token_hash),
  KEY idx_v2_session_active (user_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE v2_students
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS v2_student_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NOT NULL,
  reason VARCHAR(255) NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_status_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_status_user FOREIGN KEY (changed_by) REFERENCES v2_users(id),
  KEY idx_v2_status_student_time (student_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
