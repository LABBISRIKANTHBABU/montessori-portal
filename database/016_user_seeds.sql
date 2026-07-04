-- ============================================
-- USER SEED DATA
-- All real admin credentials with bcrypt hashes
-- Generated: 2026-07-03
-- ============================================

-- ============================================
-- SCHOOL ADMIN ACCOUNTS
-- ============================================

-- School 1: MEMHSVNK - Montessori EM High School, Vidya Nagar, Kurnool
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'montessorividyanagar1974@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVO.dsFoME7/v9dO.0e947AS.JWBnFutlK', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'montessorividyanagar1974@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'montessorividyanagar1974@gmail.com' AND s.legacy_code = 'MEMHSVNK'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 2: MHSA - Montessori High School, Alampur
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'alampur123@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOZJdrU9xUtyL12Zh3D/TL/.MBOlmnpDy', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'alampur123@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'alampur123@gmail.com' AND s.legacy_code = 'MHSA'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 3: MSSSACK - Montessori Senior Secondary School, A-Camp, Kurnool
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'montescbse17@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVO02TlyGQ8dMxr3uJaBsZuVbtJ92.QWJu', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'montescbse17@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'montescbse17@gmail.com' AND s.legacy_code = 'MSSSACK'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 4: MIRSNHK - Montessori Indus Residential School, Kallur
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'indusschool10@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVO8y27fORdrVGhpVX6iZkoAgTy7sia89.', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'indusschool10@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'indusschool10@gmail.com' AND s.legacy_code = 'MIRSNHK'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 5: MEMHSP - Montessori English Medium High School, Panchalingala
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'Panchalingala@GMAIL.COM', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOhmYfMjnwPW7rqtMXsjqCCRPY1LYmEzO', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'Panchalingala@GMAIL.COM');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'Panchalingala@GMAIL.COM' AND s.legacy_code = 'MEMHSP'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 6: MEEMSA - Montessori Elite EM School, Anantapur
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'Admin@montessorieliteschool.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVO7roYGdKOFWtaf.LuL6LprQvzydzhFbi', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'Admin@montessorieliteschool.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'Admin@montessorieliteschool.com' AND s.legacy_code = 'MEEMSA'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 7: MISNHK - Monte International School, Kallur
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'office.cbmonte@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOIBIS1VQbEDm8j29K5j4/.XgI0li3BPe', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'office.cbmonte@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'office.cbmonte@gmail.com' AND s.legacy_code = 'MISNHK'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 8: SSKH - Sproutz School, Khanamit, Hyderabad
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'contact@sproutzschool.in', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOk2.hWOxqQ4EJ3n2N40QTyoRXFKk2VGy', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'contact@sproutzschool.in');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'contact@sproutzschool.in' AND s.legacy_code = 'SSKH'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- School 9: MIH - Montessori Invictus, Hyderabad
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin', 'invitictus10@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOuPSKI3Ar32J30fjom/uRFVzxg1QQy9.', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'invitictus10@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'invitictus10@gmail.com' AND s.legacy_code = 'MIH'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- ============================================
-- SUPER ADMIN ACCOUNTS
-- ============================================

-- Super Admin 1
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Super Admin', 'montesraj@yahoo.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOXh5s2QC.5ehCnDIHOTSFr9By7YTQTGC', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'montesraj@yahoo.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'group_super_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'montesraj@yahoo.com'
ON DUPLICATE KEY UPDATE role_code = 'group_super_admin';

-- Super Admin 2
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Super Admin', 'Akmsmeta@gmail.com', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOn/pSd4BPGDvHfY4s2/IhrI2nyNaOY6G', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'Akmsmeta@gmail.com');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'group_super_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'Akmsmeta@gmail.com'
ON DUPLICATE KEY UPDATE role_code = 'group_super_admin';

-- ============================================
-- DEMO ACCOUNTS (for development)
-- ============================================

-- Demo School Admin
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Admin User', 'admin@montessori.edu', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOtuVmpkHb7YVxQQkh6vQvqV6oGKUfHEC', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'admin@montessori.edu');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'school_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'admin@montessori.edu' AND s.legacy_code = 'MEMHSVNK'
ON DUPLICATE KEY UPDATE role_code = 'school_admin';

-- Demo Super Admin
INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset)
SELECT 'Super Admin', 'superadmin@montessori.edu', '$2b$12$R2gVKOiA7Ib7I0m4mOUBVOtuVmpkHb7YVxQQkh6vQvqV6oGKUfHEC', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM v2_users WHERE email = 'superadmin@montessori.edu');

INSERT INTO v2_user_school_roles (user_id, school_id, role_code)
SELECT u.id, s.id, 'group_super_admin'
FROM v2_users u, v2_schools s
WHERE u.email = 'superadmin@montessori.edu'
ON DUPLICATE KEY UPDATE role_code = 'group_super_admin';
