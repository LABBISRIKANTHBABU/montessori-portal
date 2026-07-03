-- Module 7: Events
-- Event scheduling, participation, attendance, media archive, folders, budgets

CREATE TABLE IF NOT EXISTS v2_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  event_type ENUM('cultural','sports','academic','general','holiday','other') NOT NULL DEFAULT 'general',
  start_date DATETIME NOT NULL,
  end_date DATETIME NULL,
  location VARCHAR(200) NULL,
  status ENUM('draft','published','ongoing','completed','cancelled') NOT NULL DEFAULT 'draft',
  academic_year VARCHAR(20) NULL,
  budget DECIMAL(12,2) NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_event_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  CONSTRAINT fk_v2_event_creator FOREIGN KEY (created_by) REFERENCES v2_users(id),
  KEY idx_v2_event_school (school_id, start_date),
  KEY idx_v2_event_type (school_id, event_type),
  KEY idx_v2_event_academic_year (school_id, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_event_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(50) NULL,
  attendance ENUM('present','absent','late','excused') NULL,
  certificate_issued TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_epart_event FOREIGN KEY (event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_epart_student FOREIGN KEY (student_id) REFERENCES v2_students(id),
  UNIQUE KEY uq_v2_epart (event_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_event_folders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  folder_type ENUM('photos','videos','documents','invitations','reports','certificates','budget','other') NOT NULL DEFAULT 'other',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_efolder_event FOREIGN KEY (event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_efolder_parent FOREIGN KEY (parent_id) REFERENCES v2_event_folders(id) ON DELETE CASCADE,
  KEY idx_v2_efolder_event (event_id, folder_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_event_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  folder_id BIGINT UNSIGNED NULL,
  media_type ENUM('photo','video','document','invitation','brochure') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL,
  caption VARCHAR(255) NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_emedia_event FOREIGN KEY (event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_emedia_folder FOREIGN KEY (folder_id) REFERENCES v2_event_folders(id) ON DELETE SET NULL,
  CONSTRAINT fk_v2_emedia_uploader FOREIGN KEY (uploaded_by) REFERENCES v2_users(id),
  KEY idx_v2_emedia_event (event_id, media_type),
  KEY idx_v2_emedia_folder (folder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_event_budgets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  expense_type ENUM('planned','actual') NOT NULL DEFAULT 'planned',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_v2_ebudget_event FOREIGN KEY (event_id) REFERENCES v2_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_v2_ebudget_creator FOREIGN KEY (created_by) REFERENCES v2_users(id),
  KEY idx_v2_ebudget_event (event_id, expense_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
