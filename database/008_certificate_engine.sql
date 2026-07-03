-- Module 5: Certificate Engine
-- Auto-generated certificates with QR verification

CREATE TABLE IF NOT EXISTS v2_certificate_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  certificate_type VARCHAR(50) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  header_text TEXT NULL,
  footer_text TEXT NULL,
  body_template TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_certtpl_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_certtpl_school_type (school_id, certificate_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_certificates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  certificate_type VARCHAR(50) NOT NULL,
  certificate_number VARCHAR(60) NOT NULL,
  issued_date DATE NOT NULL,
  academic_year VARCHAR(20) NULL,
  qr_code_data VARCHAR(500) NULL,
  storage_path VARCHAR(500) NULL,
  status ENUM('draft','issued','revoked') NOT NULL DEFAULT 'issued',
  issued_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_cert_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_cert_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_cert_issuer FOREIGN KEY (issued_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_cert_number (school_id, certificate_number),
  KEY idx_v2_cert_student (student_id, certificate_type),
  KEY idx_v2_cert_school (school_id, issued_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_school_signatures (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  signature_type ENUM('principal','admin') NOT NULL,
  signer_name VARCHAR(150) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_sig_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_sig_school_type (school_id, signature_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
