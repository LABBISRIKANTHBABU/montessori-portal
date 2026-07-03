CREATE TABLE IF NOT EXISTS v2_permissions (
  code VARCHAR(100) PRIMARY KEY,
  module_name VARCHAR(60) NOT NULL,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS v2_role_permissions (
  role_code VARCHAR(60) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_code, permission_code),
  CONSTRAINT fk_v2_rp_permission FOREIGN KEY (permission_code) REFERENCES v2_permissions(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO v2_permissions (code, module_name, description) VALUES
('dashboard.view','dashboard','View the school dashboard'),
('student.view','students','View school-scoped student records'),
('student.create','students','Create student records'),
('student.update','students','Update student records'),
('student.status.change','students','Change student lifecycle status'),
('student.document.upload','students','Upload student documents'),
('student.identifier.view_sensitive','students','Reveal protected student identifiers'),
('student.export','students','Export student information'),
('academic.manage','academics','Manage academic years, boards, classes and sections'),
('user.manage','users','Manage users and role assignments');

INSERT IGNORE INTO v2_role_permissions (role_code, permission_code)
SELECT 'school_admin', code FROM v2_permissions WHERE code <> 'student.identifier.view_sensitive';
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code)
SELECT 'group_super_admin', code FROM v2_permissions;
INSERT IGNORE INTO v2_role_permissions VALUES
('principal','dashboard.view'),('principal','student.view'),('principal','student.status.change'),('principal','student.export'),
('office_staff','dashboard.view'),('office_staff','student.view'),('office_staff','student.create'),('office_staff','student.update'),('office_staff','student.document.upload'),
('teacher','dashboard.view'),('teacher','student.view'),
('accountant','dashboard.view'),('accountant','student.view'),
('auditor','dashboard.view'),('auditor','student.view'),('auditor','student.export');

