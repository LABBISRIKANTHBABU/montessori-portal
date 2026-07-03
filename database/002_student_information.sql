-- Student Information System extension.
-- Apply to a staging clone first. Legacy student_details remains read-only.

ALTER TABLE v2_students
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NULL AFTER date_of_birth,
  ADD COLUMN IF NOT EXISTS mother_tongue VARCHAR(100) NULL AFTER nationality,
  ADD COLUMN IF NOT EXISTS religion VARCHAR(100) NULL AFTER mother_tongue,
  ADD COLUMN IF NOT EXISTS caste VARCHAR(250) NULL AFTER religion,
  ADD COLUMN IF NOT EXISTS sub_caste VARCHAR(100) NULL AFTER caste,
  ADD COLUMN IF NOT EXISTS student_email VARCHAR(190) NULL AFTER sub_caste,
  ADD COLUMN IF NOT EXISTS photo_path VARCHAR(255) NULL AFTER student_email;

CREATE TABLE IF NOT EXISTS v2_student_identifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  identifier_type ENUM('legacy_id','admission_no','aadhaar','pen','apaar','tc_no') NOT NULL,
  identifier_value VARCHAR(120) NULL,
  encrypted_value VARBINARY(512) NULL,
  masked_value VARCHAR(30) NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_identifier_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  UNIQUE KEY uq_v2_student_identifier (student_id, identifier_type),
  KEY idx_v2_identifier_lookup (identifier_type, identifier_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_guardians (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  relation_type ENUM('father','mother','guardian','other') NOT NULL,
  mobile VARCHAR(20) NULL,
  email VARCHAR(190) NULL,
  aadhaar_encrypted VARBINARY(512) NULL,
  aadhaar_last_four CHAR(4) NULL,
  qualification VARCHAR(150) NULL,
  occupation VARCHAR(150) NULL,
  bank_account_encrypted VARBINARY(512) NULL,
  bank_account_last_four CHAR(4) NULL,
  ifsc_code VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_v2_guardian_mobile (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_student_guardians (
  student_id BIGINT UNSIGNED NOT NULL,
  guardian_id BIGINT UNSIGNED NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_emergency_contact TINYINT(1) NOT NULL DEFAULT 0,
  is_pickup_authorized TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, guardian_id),
  CONSTRAINT fk_v2_sg_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_sg_guardian FOREIGN KEY (guardian_id) REFERENCES v2_guardians(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_student_addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  address_type ENUM('residential','permanent') NOT NULL DEFAULT 'residential',
  full_address VARCHAR(500) NOT NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  postal_code VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_address_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  KEY idx_v2_address_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_academic_years (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_v2_year_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_year_school_name (school_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_admissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  board_code VARCHAR(30) NOT NULL,
  admission_no VARCHAR(60) NOT NULL,
  admission_date DATE NOT NULL,
  class_admitted VARCHAR(50) NOT NULL,
  section_name VARCHAR(50) NULL,
  previous_school_class VARCHAR(255) NULL,
  previous_tc_no VARCHAR(50) NULL,
  status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'approved',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_admission_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_admission_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_admission_year FOREIGN KEY (academic_year_id) REFERENCES v2_academic_years(id),
  CONSTRAINT fk_v2_admission_user FOREIGN KEY (created_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_admission_number (school_id, admission_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_student_leaving_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  class_leaving VARCHAR(50) NULL,
  date_of_leaving DATE NULL,
  tc_number VARCHAR(50) NULL,
  tc_taken_date DATE NULL,
  status ENUM('draft','requested','approved','issued','cancelled') NOT NULL DEFAULT 'draft',
  approved_by BIGINT UNSIGNED NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_leaving_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_leaving_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_leaving_approver FOREIGN KEY (approved_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_student_leaving (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

