-- Additive v2 schema. Run only after testing against a clone of the Hostinger database.
-- The four legacy tables remain untouched and are never queried by the new login flow.
-- The migration runner selects the configured database; this file must never CREATE or USE another database.

CREATE TABLE IF NOT EXISTS v2_schools (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  legacy_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(120) NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_v2_school_code (legacy_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  force_password_reset TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_v2_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_user_school_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  role_code VARCHAR(60) NOT NULL,
  PRIMARY KEY (user_id, school_id, role_code),
  CONSTRAINT fk_v2_usr_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
  CONSTRAINT fk_v2_usr_school FOREIGN KEY (school_id) REFERENCES v2_schools(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  legacy_student_id INT NULL,
  student_uid VARCHAR(60) NOT NULL,
  admission_no VARCHAR(60) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  gender ENUM('male','female','other') NULL,
  date_of_birth DATE NULL,
  current_status ENUM('active','alumni','withdrawn','transferred','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_students_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_student_uid (school_id, student_uid),
  UNIQUE KEY uq_v2_admission_no (school_id, admission_no),
  UNIQUE KEY uq_v2_legacy_student (legacy_student_id),
  KEY idx_v2_student_name (school_id, full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  action_name VARCHAR(100) NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_v2_audit_school_time (school_id, created_at),
  KEY idx_v2_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
