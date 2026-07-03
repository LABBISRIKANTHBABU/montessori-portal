CREATE TABLE IF NOT EXISTS v2_import_batches (
  id CHAR(36) PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  source_type ENUM('excel','csv','legacy') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  status ENUM('validating','ready','approved','importing','completed','completed_with_errors','rejected','cancelled') NOT NULL DEFAULT 'validating',
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  chunk_size INT NOT NULL DEFAULT 1000,
  last_processed_row INT NOT NULL DEFAULT 0,
  mapping_json JSON NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  error_message TEXT NULL,
  CONSTRAINT fk_v2_import_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_import_user FOREIGN KEY (uploaded_by) REFERENCES v2_users(id),
  CONSTRAINT fk_v2_import_approver FOREIGN KEY (approved_by) REFERENCES v2_users(id),
  KEY idx_v2_import_school_time (school_id,created_at),
  KEY idx_v2_import_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_import_rows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id CHAR(36) NOT NULL,
  source_row_number INT NOT NULL,
  source_record_id BIGINT NULL,
  raw_json JSON NOT NULL,
  normalized_json JSON NULL,
  row_status ENUM('valid','error','duplicate','imported') NOT NULL,
  errors_json JSON NULL,
  imported_student_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_import_row_batch FOREIGN KEY (batch_id) REFERENCES v2_import_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_import_row_student FOREIGN KEY (imported_student_id) REFERENCES v2_students(id),
  UNIQUE KEY uq_v2_import_source_row (batch_id,source_row_number),
  KEY idx_v2_import_row_status (batch_id,row_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO v2_permissions (code,module_name,description) VALUES
('import.view','imports','View import batches and validation results'),
('import.upload','imports','Upload and validate student spreadsheets'),
('import.approve','imports','Approve and execute validated imports'),
('import.legacy.stage','imports','Stage legacy student records for migration');

INSERT IGNORE INTO v2_role_permissions VALUES
('group_super_admin','import.view'),('group_super_admin','import.upload'),('group_super_admin','import.approve'),('group_super_admin','import.legacy.stage'),
('school_admin','import.view'),('school_admin','import.upload'),('school_admin','import.approve'),('school_admin','import.legacy.stage'),
('principal','import.view'),('principal','import.approve'),
('office_staff','import.view'),('office_staff','import.upload'),
('auditor','import.view');
