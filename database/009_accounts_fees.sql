-- Module 6: Accounts & Fees
-- Fee categories, collections, receipts, daily accounts, suppliers, vouchers

CREATE TABLE IF NOT EXISTS v2_fee_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_feecat_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_feecat_school_name (school_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO v2_fee_categories (school_id, name, description) VALUES
  (1, 'Tuition Fee', 'Monthly tuition fee'),
  (1, 'Transport Fee', 'Bus transport charges'),
  (1, 'Library Fee', 'Annual library charges'),
  (1, 'Lab Fee', 'Science lab charges'),
  (1, 'Exam Fee', 'Examination charges'),
  (1, 'Development Fee', 'Annual development fund');

CREATE TABLE IF NOT EXISTS v2_fee_structures (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  fee_category_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_feeschool FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_feecat FOREIGN KEY (fee_category_id) REFERENCES v2_fee_categories(id),
  UNIQUE KEY uq_v2_feestruct (school_id, academic_year, class_name, fee_category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_fee_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  fee_category_id BIGINT UNSIGNED NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_mode ENUM('cash','bank_transfer','upi','cheque','card','other') NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100) NULL,
  receipt_number VARCHAR(60) NOT NULL,
  notes VARCHAR(500) NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_pay_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_pay_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_pay_category FOREIGN KEY (fee_category_id) REFERENCES v2_fee_categories(id),
  CONSTRAINT fk_v2_pay_recorder FOREIGN KEY (recorded_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_pay_receipt (school_id, receipt_number),
  KEY idx_v2_pay_student (student_id, academic_year),
  KEY idx_v2_pay_school (school_id, payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_fee_concessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  fee_category_id BIGINT UNSIGNED NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  concession_type ENUM('scholarship','discount','waiver') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NULL,
  approved_by BIGINT UNSIGNED NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_conv_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_conv_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_conv_category FOREIGN KEY (fee_category_id) REFERENCES v2_fee_categories(id),
  KEY idx_v2_conv_student (student_id, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily Accounts
CREATE TABLE IF NOT EXISTS v2_daily_cashbook (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  entry_type ENUM('income','expense','opening','closing') NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_mode ENUM('cash','bank_transfer','upi','cheque','other') NOT NULL DEFAULT 'cash',
  reference_number VARCHAR(100) NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_cashbook_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_cashbook_recorder FOREIGN KEY (recorded_by) REFERENCES v2_users(id),
  KEY idx_v2_cashbook_date (school_id, entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Supplier Management
CREATE TABLE IF NOT EXISTS v2_suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(190) NULL,
  gst_number VARCHAR(20) NULL,
  bank_account_number VARCHAR(30) NULL,
  bank_ifsc VARCHAR(20) NULL,
  address TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_supplier_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  KEY idx_v2_supplier_school (school_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_supplier_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('purchase','payment','credit','debit') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(500) NULL,
  reference_number VARCHAR(100) NULL,
  transaction_date DATE NOT NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_suptr_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_suptr_supplier FOREIGN KEY (supplier_id) REFERENCES v2_suppliers(id),
  CONSTRAINT fk_v2_suptr_recorder FOREIGN KEY (recorded_by) REFERENCES v2_users(id),
  KEY idx_v2_suptr_supplier (supplier_id, transaction_date),
  KEY idx_v2_suptr_school (school_id, transaction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Voucher Management
CREATE TABLE IF NOT EXISTS v2_vouchers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  voucher_type ENUM('payment','receipt','journal','expense') NOT NULL,
  voucher_number VARCHAR(60) NOT NULL,
  voucher_date DATE NOT NULL,
  payee_name VARCHAR(200) NULL,
  amount DECIMAL(10,2) NOT NULL,
  description VARCHAR(500) NULL,
  payment_mode ENUM('cash','bank_transfer','upi','cheque','other') NULL,
  status ENUM('draft','approved','cancelled') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_voucher_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_voucher_creator FOREIGN KEY (created_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_voucher_number (school_id, voucher_number),
  KEY idx_v2_voucher_school (school_id, voucher_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
