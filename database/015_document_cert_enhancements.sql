-- Module 4 & 5 Enhancements: Document Sharing, Metadata, Certificate Cancellation/Regeneration

-- Document Shares table
CREATE TABLE IF NOT EXISTS v2_document_shares (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  shared_by_user_id BIGINT UNSIGNED NOT NULL,
  shared_with_user_id BIGINT UNSIGNED NOT NULL,
  permission ENUM('view', 'edit') NOT NULL DEFAULT 'view',
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_docshare_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_docshare_document FOREIGN KEY (document_id) REFERENCES v2_student_documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_docshare_by FOREIGN KEY (shared_by_user_id) REFERENCES v2_users(id),
  CONSTRAINT fk_v2_docshare_with FOREIGN KEY (shared_with_user_id) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_docshare_doc_user (document_id, shared_with_user_id),
  KEY idx_v2_docshare_document (document_id),
  KEY idx_v2_docshare_user (shared_with_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add metadata columns to v2_student_documents
-- (Already executed)
-- ALTER TABLE v2_student_documents
--  ADD COLUMN description TEXT NULL AFTER document_name,
--  ADD COLUMN tags JSON NULL AFTER description;

-- Add cancellation and superseded columns to v2_certificates
ALTER TABLE v2_certificates
  ADD COLUMN reason TEXT NULL AFTER issued_by,
  ADD COLUMN cancelled_reason TEXT NULL,
  ADD COLUMN cancelled_at TIMESTAMP NULL,
  ADD COLUMN cancelled_by BIGINT UNSIGNED NULL,
  ADD COLUMN superseded_by BIGINT UNSIGNED NULL,
  MODIFY COLUMN status ENUM('draft','issued','revoked','cancelled','superseded') NOT NULL DEFAULT 'issued' AFTER storage_path;

ALTER TABLE v2_certificates
  ADD CONSTRAINT fk_v2_cert_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES v2_users(id);

-- Add reason column to v2_certificates if not exists (needed for bulk generate)
-- The column already exists in the original schema via the route, so we just ensure it's there
SET @column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'v2_certificates' AND COLUMN_NAME = 'reason');
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE v2_certificates ADD COLUMN reason TEXT NULL AFTER approved_by', 
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
