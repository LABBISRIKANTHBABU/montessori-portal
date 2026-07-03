-- Safe idempotent bootstrap from the existing school master.
INSERT IGNORE INTO v2_schools (legacy_code, name, city)
SELECT SchoolName, School_Name, NULL FROM SchoolName;

CREATE TABLE IF NOT EXISTS v2_boards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_v2_board_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_classes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  school_id BIGINT UNSIGNED NOT NULL,
  board_code VARCHAR(30) NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_v2_class_school FOREIGN KEY (school_id) REFERENCES v2_schools(id),
  UNIQUE KEY uq_v2_class_school_name (school_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(50) NOT NULL,
  capacity INT NULL,
  CONSTRAINT fk_v2_section_class FOREIGN KEY (class_id) REFERENCES v2_classes(id),
  UNIQUE KEY uq_v2_section_class_name (class_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO v2_boards (code, name) VALUES ('CBSE', 'Central Board of Secondary Education'), ('STATE', 'State Board'), ('ICSE', 'Indian Certificate of Secondary Education');

INSERT IGNORE INTO v2_academic_years (school_id, name, start_date, end_date, is_current)
SELECT id, '2026–27', '2026-06-01', '2027-05-31', 1 FROM v2_schools;

INSERT IGNORE INTO v2_classes (school_id, board_code, name)
SELECT s.id, NULLIF(UPPER(TRIM(d.Board)), ''), TRIM(d.ClassAdmitted)
FROM student_details d
JOIN v2_schools s ON s.legacy_code = d.SchoolName COLLATE utf8mb4_unicode_ci
WHERE d.ClassAdmitted IS NOT NULL AND TRIM(d.ClassAdmitted) NOT IN ('', '-', '_')
GROUP BY s.id, NULLIF(UPPER(TRIM(d.Board)), ''), TRIM(d.ClassAdmitted);
