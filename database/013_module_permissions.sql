-- Migration 013: Add missing permissions for accounts, events, certificates, reports, settings, imports
-- This migration adds module-specific permissions and updates role assignments.

-- Add new permissions
INSERT IGNORE INTO v2_permissions (code, module_name, description) VALUES
('account.view', 'accounts', 'View financial data, fee collections, cashbook, suppliers, vouchers'),
('account.manage', 'accounts', 'Create and modify financial records, fee structures, payments, vouchers'),
('event.view', 'events', 'View events, participants, media'),
('event.manage', 'events', 'Create, update, and manage events, participants, attendance, media'),
('certificate.view', 'certificates', 'View certificates and templates'),
('certificate.generate', 'certificates', 'Generate and revoke certificates'),
('report.view', 'reports', 'View student, academic, and operational reports'),
('report.financial', 'reports', 'View financial reports and summaries'),
('settings.view', 'settings', 'View school settings, academic years, audit logs'),
('settings.manage', 'settings', 'Modify school settings, academic years, boards, classes'),
('import.view', 'imports', 'View import batches and errors'),
('import.upload', 'imports', 'Upload import spreadsheets'),
('import.approve', 'imports', 'Approve and commit import batches');

-- Update role permissions for School Admin (gets all new permissions)
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code)
SELECT 'school_admin', code FROM v2_permissions
WHERE code IN ('account.view', 'account.manage', 'event.view', 'event.manage', 'certificate.view', 'certificate.generate', 'report.view', 'report.financial', 'settings.view', 'settings.manage', 'import.view', 'import.upload', 'import.approve');

-- Update role permissions for Group Super Admin (gets all new permissions)
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code)
SELECT 'group_super_admin', code FROM v2_permissions
WHERE code IN ('account.view', 'account.manage', 'event.view', 'event.manage', 'certificate.view', 'certificate.generate', 'report.view', 'report.financial', 'settings.view', 'settings.manage', 'import.view', 'import.upload', 'import.approve');

-- Principal: view accounts, manage events, view/generate certificates, view reports
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code) VALUES
('principal', 'account.view'),
('principal', 'event.view'),
('principal', 'event.manage'),
('principal', 'certificate.view'),
('principal', 'certificate.generate'),
('principal', 'report.view'),
('principal', 'report.financial'),
('principal', 'settings.view'),
('principal', 'import.view');

-- Office Staff: view accounts, view events, view certificates, view reports, view/upload imports
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code) VALUES
('office_staff', 'account.view'),
('office_staff', 'event.view'),
('office_staff', 'certificate.view'),
('office_staff', 'report.view'),
('office_staff', 'import.view'),
('office_staff', 'import.upload');

-- Teacher: view events, view reports
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code) VALUES
('teacher', 'event.view'),
('teacher', 'report.view');

-- Accountant: manage accounts, view financial reports
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code) VALUES
('accountant', 'account.view'),
('accountant', 'account.manage'),
('accountant', 'report.view'),
('accountant', 'report.financial');

-- Auditor: view accounts, view financial reports, view settings
INSERT IGNORE INTO v2_role_permissions (role_code, permission_code) VALUES
('auditor', 'account.view'),
('auditor', 'report.view'),
('auditor', 'report.financial'),
('auditor', 'settings.view');
