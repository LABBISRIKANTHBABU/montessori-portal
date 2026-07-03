-- Module 10: Settings
-- School profile, configuration, and preferences

CREATE TABLE IF NOT EXISTS v2_school_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_setting_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_setting (school_id, setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default settings for all schools
INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'school_name', name FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'school_logo_path', NULL FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'principal_signature_path', NULL FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'current_academic_year', '2026-27' FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'default_board', 'CBSE' FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'fee_receipt_prefix', 'REC' FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'certificate_prefix', 'CERT' FROM v2_schools;

INSERT IGNORE INTO v2_school_settings (school_id, setting_key, setting_value)
SELECT id, 'admission_prefix', 'ADM' FROM v2_schools;

CREATE TABLE IF NOT EXISTS v2_school_logos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  logo_type ENUM('school_logo','principal_signature') NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_logo_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_logo_uploader FOREIGN KEY (uploaded_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_logo_school_type (school_id, logo_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
