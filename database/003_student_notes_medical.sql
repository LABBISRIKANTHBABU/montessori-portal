-- Student Notes & Medical Information (Phase 5)

CREATE TABLE IF NOT EXISTS v2_student_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  note_type ENUM('academic','medical','behaviour','counselling','general') NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES v2_students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  KEY idx_v2_snote_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_student_medical (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  school_id BIGINT UNSIGNED NOT NULL,
  blood_group VARCHAR(10) NULL,
  allergies TEXT NULL,
  medications TEXT NULL,
  conditions TEXT NULL,
  emergency_contact_name VARCHAR(200) NULL,
  emergency_contact_phone VARCHAR(20) NULL,
  insurance_info TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES v2_students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_smedical (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
