-- Module 4: Document Management System
-- Each student has categorized documents with versioning

CREATE TABLE IF NOT EXISTS v2_document_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_v2_doc_cat_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO v2_document_categories (code, name, sort_order) VALUES
  ('aadhaar', 'Aadhaar', 1),
  ('birth_certificate', 'Birth Certificate', 2),
  ('marks_memo', 'Marks Memo', 3),
  ('income_certificate', 'Income Certificate', 4),
  ('caste_certificate', 'Caste Certificate', 5),
  ('bonafide', 'Bonafide', 6),
  ('transfer_certificate', 'Transfer Certificate', 7),
  ('photo', 'Student Photo', 8),
  ('other', 'Others', 9);

CREATE TABLE IF NOT EXISTS v2_student_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  category_code VARCHAR(50) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL,
  academic_year VARCHAR(20) NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_doc_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_doc_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_doc_uploader FOREIGN KEY (uploaded_by) REFERENCES v2_users(id),
  KEY idx_v2_doc_student (student_id, category_code),
  KEY idx_v2_doc_school (school_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_document_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  storage_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_docver_document FOREIGN KEY (document_id) REFERENCES v2_student_documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_docver_uploader FOREIGN KEY (uploaded_by) REFERENCES v2_users(id),
  KEY idx_v2_docver_document (document_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
