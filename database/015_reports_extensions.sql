-- Module 9 Extensions: Reports
-- Attendance tracking, staff directory, parent portal, saved report configurations

-- Attendance tracking
CREATE TABLE IF NOT EXISTS v2_student_attendance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('present','absent','late','excused','holiday') NOT NULL DEFAULT 'present',
  remarks VARCHAR(255) NULL,
  marked_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_att_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_att_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  CONSTRAINT fk_v2_att_marker FOREIGN KEY (marked_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_att_daily (school_id, student_id, attendance_date),
  KEY idx_v2_att_date (school_id, attendance_date),
  KEY idx_v2_att_student (student_id, attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Staff directory
CREATE TABLE IF NOT EXISTS v2_staff (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  employee_id VARCHAR(60) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role ENUM('teacher','admin','accountant','librarian','peon','principal','vice_principal','counselor','nurse','lab_assistant','other') NOT NULL,
  department VARCHAR(100) NULL,
  designation VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(190) NULL,
  join_date DATE NULL,
  qualification VARCHAR(200) NULL,
  experience_years INT NULL DEFAULT 0,
  salary DECIMAL(10,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_staff_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_staff_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_staff_employee (school_id, employee_id),
  KEY idx_v2_staff_school (school_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saved report configurations
CREATE TABLE IF NOT EXISTS v2_saved_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  report_name VARCHAR(200) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  config_json JSON NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  is_shared TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_sreport_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_sreport_creator FOREIGN KEY (created_by) REFERENCES v2_users(id),
  UNIQUE KEY uq_v2_sreport_name (school_id, report_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample staff data
INSERT IGNORE INTO v2_staff (school_id, employee_id, full_name, role, department, phone, is_active) VALUES
  (1, 'EMP001', 'Mrs. Priya Sharma', 'teacher', 'Primary', '9876543210', 1),
  (1, 'EMP002', 'Mr. Rajesh Kumar', 'teacher', 'Secondary', '9876543211', 1),
  (1, 'EMP003', 'Ms. Anita Desai', 'admin', 'Administration', '9876543212', 1),
  (1, 'EMP004', 'Mr. Suresh Patel', 'accountant', 'Accounts', '9876543213', 1),
  (1, 'EMP005', 'Mrs. Lakshmi Nair', 'librarian', 'Library', '9876543214', 1);
