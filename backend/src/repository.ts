/**
 * Centralized Data Access Layer
 *
 * All data access goes through this module. Every function queries
 * the MySQL database directly — no mock data, no demo mode.
 */

import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getConfig } from "./config/env.js";
import { getPool, query } from "./database/pool.js";
import { createProductionStudent, getProductionAcademicSetup, getProductionDashboard, getProductionStudent, listProductionStudents, updateProductionStudent, changeProductionStudentStatus, restoreProductionStudent, exportProductionStudents, checkDuplicateAdmission, bulkPromoteProductionStudents, bulkAssignProductionStudents, getProductionStudentTimeline, getProductionStudentMedical, upsertProductionStudentMedical, getProductionStudentNotes, createProductionStudentNote, deleteProductionStudentNote } from "./modules/students/studentRepository.js";
import { listBatches, getBatch, stageBatch, approveBatch, existingAdmissionNumbers } from "./modules/imports/importService.js";
import type { RowDataPacket } from "mysql2/promise";

// ─── Types ───────────────────────────────────────────────────────────────

export type School = { id: number; code: string; name: string; city: string };

export type AuthAccount = {
  userId: number; userName: string; passwordHash: string; forcePasswordReset: boolean;
  roleCode: string; schoolId: number; code: string; schoolName: string; city: string;
};

export type SessionRecord = {
  id: string; userId: number; schoolId: number; roleCode: string; forcePasswordReset: boolean;
};

// ─── Helper ──────────────────────────────────────────────────────────────

const ROLE_NAMES: Record<string, string> = {
  group_super_admin: "Group Super Admin", school_admin: "School Admin", principal: "Principal",
  office_staff: "Office Staff", teacher: "Teacher", accountant: "Accountant", auditor: "Auditor",
};

// ─── Schools ─────────────────────────────────────────────────────────────

export async function listSchools(): Promise<School[]> {
  try {
    const [rows] = await getPool().execute<RowDataPacket[]>(
      "SELECT id, legacy_code code, name, city FROM v2_schools WHERE status = 'active'"
    );
    return rows as School[];
  } catch {
    // Fallback if status column doesn't exist
    const [rows] = await getPool().execute<RowDataPacket[]>(
      "SELECT id, legacy_code code, name, city FROM v2_schools"
    );
    return rows as School[];
  }
}

export async function getSchoolById(schoolId: number): Promise<School | null> {
  try {
    const [rows] = await getPool().execute<RowDataPacket[]>(
      "SELECT id, legacy_code code, name, city FROM v2_schools WHERE id = ? AND status = 'active' LIMIT 1",
      [schoolId]
    );
    return (rows[0] as School) || null;
  } catch {
    const [rows] = await getPool().execute<RowDataPacket[]>(
      "SELECT id, legacy_code code, name, city FROM v2_schools WHERE id = ? LIMIT 1",
      [schoolId]
    );
    return (rows[0] as School) || null;
  }
}

// ─── Authentication ──────────────────────────────────────────────────────

export async function authenticateUser(schoolId: number, email: string, password: string, ipAddress?: string, userAgent?: string): Promise<{
  token: string; mustChangePassword: boolean;
  user: { name: string; role: string }; school: School;
} | null> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(getConfig().JWT_SECRET);

  // Super admin login (schoolId = 0): don't filter by school
  const isSuperAdminLogin = schoolId === 0;
  const query = `SELECT u.id AS userId, u.name AS userName, u.email, u.password_hash AS passwordHash, u.force_password_reset AS forcePasswordReset, usr.role_code AS roleCode,
            s.id AS schoolId, s.legacy_code AS code, s.name AS schoolName, COALESCE(s.city, '') AS city
     FROM v2_users u
     JOIN v2_user_school_roles usr ON usr.user_id = u.id
     JOIN v2_schools s ON s.id = usr.school_id
     WHERE LOWER(u.email) = LOWER(?) AND u.is_active = 1 ${isSuperAdminLogin ? "" : "AND s.id = ?"} LIMIT 1`;
  const params = isSuperAdminLogin ? [email] : [email, schoolId];
  
  const [rows] = await getPool().execute<RowDataPacket[]>(query, params);
  
  const account = rows[0] as AuthAccount | undefined;
  if (!account) return null;
  
  const passwordMatch = await bcrypt.compare(password, String(account.passwordHash));
  if (!passwordMatch) return null;
  
  // Super admin login must have group_super_admin role
  if (isSuperAdminLogin && account.roleCode !== "group_super_admin") return null;

  const roleDisplay = ROLE_NAMES[account.roleCode] || account.roleCode;
  const [permRows] = await getPool().execute<RowDataPacket[]>(
    "SELECT permission_code FROM v2_role_permissions WHERE role_code = ?", [account.roleCode]
  );
  const permissions = permRows.map((r: any) => String(r.permission_code));

  // Concurrent session limit (max 5 per user)
  const [sessionCount] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [account.userId]
  );
  if (Number(sessionCount[0]?.cnt || 0) >= 5) {
    const [oldest] = await getPool().execute<RowDataPacket[]>(
      "SELECT id FROM v2_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() ORDER BY expires_at ASC LIMIT 1",
      [account.userId]
    );
    if (oldest[0]) {
      await getPool().execute("UPDATE v2_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ?", [String(oldest[0].id)]);
    }
  }

  const sessionId = randomUUID();
  const refreshToken = randomBytes(48).toString("base64url");
  const hashToken = (v: string) => require("node:crypto").createHash("sha256").update(v).digest("hex");
  await getPool().execute(
    "INSERT INTO v2_sessions (id,user_id,school_id,refresh_token_hash,expires_at,ip_address,user_agent) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY),?,?)",
    [sessionId, account.userId, schoolId, hashToken(refreshToken), ipAddress || null, userAgent || null]
  );
  await getPool().execute("UPDATE v2_users SET last_login_at=UTC_TIMESTAMP() WHERE id=?", [account.userId]);
  await getPool().execute(
    `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
     VALUES (?, ?, 'user', ?, 'auth.login', JSON_OBJECT('ip_address', ?, 'user_agent', ?))`,
    [schoolId, account.userId, account.userId, ipAddress || null, userAgent || null]
  );

  const jwt = await new SignJWT({ schoolId, role: account.roleCode, permissions, sid: sessionId, mustChangePassword: account.forcePasswordReset })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(account.userId))
    .setIssuedAt().setExpirationTime("7d").sign(secret);

  return {
    token: jwt, mustChangePassword: account.forcePasswordReset,
    user: { name: account.userName, role: roleDisplay },
    school: { id: account.schoolId, code: account.code, name: account.schoolName, city: account.city },
  };
}

export async function refreshSession(refreshTokenHash: string): Promise<{
  token: string; mustChangePassword: boolean;
} | null> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(getConfig().JWT_SECRET);

  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT se.id, se.user_id, se.school_id, u.force_password_reset, usr.role_code
     FROM v2_sessions se JOIN v2_users u ON u.id = se.user_id
     JOIN v2_user_school_roles usr ON usr.user_id = u.id AND usr.school_id = se.school_id
     WHERE se.refresh_token_hash = ? AND se.revoked_at IS NULL AND se.expires_at > UTC_TIMESTAMP() AND u.is_active = 1 LIMIT 1`,
    [refreshTokenHash]
  );
  if (!rows[0]) return null;

  const roleDisplay = ROLE_NAMES[String(rows[0].role_code)] || String(rows[0].role_code);
  const [permRows] = await getPool().execute<RowDataPacket[]>(
    "SELECT permission_code FROM v2_role_permissions WHERE role_code = ?", [rows[0].role_code]
  );
  const permissions = permRows.map((r: any) => String(r.permission_code));

  const hashToken = (v: string) => require("node:crypto").createHash("sha256").update(v).digest("hex");
  const nextRefresh = randomBytes(48).toString("base64url");
  await getPool().execute(
    "UPDATE v2_sessions SET refresh_token_hash = ?, last_used_at = UTC_TIMESTAMP() WHERE id = ?",
    [hashToken(nextRefresh), rows[0].id]
  );

  const jwt = await new SignJWT({
    schoolId: rows[0].school_id, role: String(rows[0].role_code), permissions,
    sid: rows[0].id, mustChangePassword: Boolean(rows[0].force_password_reset),
  }).setProtectedHeader({ alg: "HS256" }).setSubject(String(rows[0].user_id))
    .setIssuedAt().setExpirationTime("7d").sign(secret);

  return { token: jwt, mustChangePassword: Boolean(rows[0].force_password_reset) };
}

export async function validateSession(sessionId: string, userId: number, schoolId: number): Promise<boolean> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id FROM v2_sessions WHERE id = ? AND user_id = ? AND school_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [sessionId, userId, schoolId]
  );
  return Boolean(rows[0]);
}

export async function revokeSession(sessionId: string, userId: number): Promise<void> {
  await getPool().execute(
    "UPDATE v2_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ?",
    [sessionId, userId]
  );
}

export async function changePassword(userId: number, newPasswordHash: string): Promise<void> {
  await getPool().execute(
    "UPDATE v2_users SET password_hash = ?, force_password_reset = 0, password_changed_at = UTC_TIMESTAMP() WHERE id = ?",
    [newPasswordHash, userId]
  );
  // Audit logged by caller
}

export async function getCurrentPasswordHash(userId: number): Promise<string | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT password_hash FROM v2_users WHERE id = ? AND is_active = 1", [userId]
  );
  return rows[0] ? String(rows[0].password_hash) : null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────

export async function getDashboard(schoolId: number) {
  return getProductionDashboard(schoolId);
}

// ─── Students ────────────────────────────────────────────────────────────

export async function listStudents(schoolId: number, search: string, status: string, limit: number, offset: number) {
  const result = await listProductionStudents(schoolId, search, status, limit, offset);
  return { data: result.data, total: result.total };
}

export async function getStudent(schoolId: number, studentId: number) {
  return getProductionStudent(schoolId, studentId);
}

export async function createStudent(input: any, context: { schoolId: number; userId: number }, photoPath?: string) {
  return createProductionStudent(input, context, photoPath);
}

export async function updateStudent(schoolId: number, studentId: number, userId: number, input: any) {
  return updateProductionStudent(schoolId, studentId, userId, input);
}

export async function changeStudentStatus(schoolId: number, studentId: number, userId: number, status: string, reason?: string) {
  return changeProductionStudentStatus(schoolId, studentId, userId, status, reason);
}

export async function restoreStudent(schoolId: number, studentId: number) {
  return restoreProductionStudent(schoolId, studentId);
}

export async function exportStudents(schoolId: number, search: string, status?: string) {
  return exportProductionStudents(schoolId, search, status);
}

export async function checkDuplicate(schoolId: number, admissionNo: string, excludeStudentId?: number) {
  return checkDuplicateAdmission(schoolId, admissionNo, excludeStudentId);
}

export async function bulkPromoteStudents(schoolId: number, studentIds: number[], targetClass: string, targetSection: string | undefined, userId: number) {
  return bulkPromoteProductionStudents(schoolId, studentIds, targetClass, targetSection, userId);
}

export async function bulkAssignStudents(schoolId: number, studentIds: number[], assignType: "class" | "section", value: string, userId: number) {
  return bulkAssignProductionStudents(schoolId, studentIds, assignType, value, userId);
}

export async function getStudentTimeline(schoolId: number, studentId: number) {
  return getProductionStudentTimeline(schoolId, studentId);
}

export async function getStudentMedical(schoolId: number, studentId: number) {
  return getProductionStudentMedical(schoolId, studentId);
}

export async function upsertStudentMedical(schoolId: number, studentId: number, data: any) {
  return upsertProductionStudentMedical(schoolId, studentId, data);
}

export async function getStudentNotes(schoolId: number, studentId: number, noteType?: string) {
  return getProductionStudentNotes(schoolId, studentId, noteType);
}

export async function createStudentNote(schoolId: number, studentId: number, userId: number, data: { noteType: string; title: string; content: string }) {
  return createProductionStudentNote(schoolId, studentId, userId, data);
}

export async function deleteStudentNote(schoolId: number, noteId: number) {
  return deleteProductionStudentNote(schoolId, noteId);
}

// ─── Academic Setup ──────────────────────────────────────────────────────

export async function getAcademicSetup(schoolId: number) {
  return getProductionAcademicSetup(schoolId);
}

// ─── Imports ─────────────────────────────────────────────────────────────

export async function listImportBatches(schoolId: number) {
  return listBatches(schoolId);
}

export async function getImportBatch(schoolId: number, batchId: string) {
  return getBatch(schoolId, batchId);
}

export async function createImportBatch(schoolId: number, payload: { context: { schoolId: number; userId: number }; sourceType: "excel" | "csv" | "legacy"; filename: string; rows: any[] }) {
  const { stageBatch } = await import("./modules/imports/importService.js");
  return stageBatch(payload.context, payload.sourceType, payload.filename, payload.rows);
}

export async function approveImport(schoolId: number, userId: number, batchId: string) {
  return approveBatch({ schoolId, userId }, batchId);
}

export async function rejectImport(schoolId: number, userId: number, batchId: string) {
  const { rejectBatch } = await import("./modules/imports/importService.js");
  return rejectBatch({ schoolId, userId }, batchId);
}

export async function rollbackImport(schoolId: number, userId: number, batchId: string) {
  const { rollbackBatch } = await import("./modules/imports/importService.js");
  return rollbackBatch({ schoolId, userId }, batchId);
}

export async function cancelImport(schoolId: number, userId: number, batchId: string) {
  const { cancelBatch } = await import("./modules/imports/importService.js");
  return cancelBatch({ schoolId, userId }, batchId);
}

export async function getImportHistory(schoolId: number) {
  const { getImportHistory: getHistory } = await import("./modules/imports/importService.js");
  return getHistory(schoolId);
}

export async function getImportProgress(schoolId: number, batchId: string) {
  const { getImportProgress: getProgress } = await import("./modules/imports/importService.js");
  return getProgress(schoolId, batchId);
}

export async function resumeImport(schoolId: number, userId: number, batchId: string) {
  const { approveBatch } = await import("./modules/imports/importService.js");
  return approveBatch({ schoolId, userId }, batchId);
}

export async function getExistingAdmissionNumbers(schoolId: number): Promise<Set<string>> {
  return existingAdmissionNumbers(schoolId);
}

export async function getImportErrors(batchId: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT source_row_number, errors_json, raw_json FROM v2_import_rows WHERE batch_id = ? AND row_status IN ('error', 'duplicate') ORDER BY source_row_number",
    [batchId]
  );
  return rows;
}

// ─── Accounts Repository Functions ──────────────────────────────────────

export async function listFeeCategories(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, description, is_active active FROM v2_fee_categories WHERE school_id = ? ORDER BY name",
    [schoolId]
  );
  return rows;
}

export async function createFeeCategory(schoolId: number, name: string, description?: string) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    "INSERT INTO v2_fee_categories (school_id, name, description) VALUES (?, ?, ?)",
    [schoolId, name, description || null]
  );
  return (result as any).insertId;
}

export async function listFeeStructures(schoolId: number, year?: string, className?: string) {
  const conditions = ["f.school_id = ?"];
  const params: any[] = [schoolId];
  if (year) { conditions.push("f.academic_year = ?"); params.push(year); }
  if (className) { conditions.push("f.class_name = ?"); params.push(className); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT f.id, f.academic_year year, f.class_name className, fc.name categoryName,
            f.amount, f.due_date dueDate
     FROM v2_fee_structures f JOIN v2_fee_categories fc ON fc.id = f.fee_category_id
     WHERE ${conditions.join(" AND ")} ORDER BY f.class_name, fc.name`,
    params
  );
  return rows;
}

export async function createFeeStructure(schoolId: number, data: { academicYear: string; className: string; feeCategoryId: number; amount: number; dueDate?: string }) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    "INSERT INTO v2_fee_structures (school_id, academic_year, class_name, fee_category_id, amount, due_date) VALUES (?, ?, ?, ?, ?, ?)",
    [schoolId, data.academicYear, data.className, data.feeCategoryId, data.amount, data.dueDate || null]
  );
  return (result as any).insertId;
}

export async function listFeePayments(schoolId: number, studentId?: number, year?: string) {
  const conditions = ["p.school_id = ?"];
  const params: any[] = [schoolId];
  if (studentId) { conditions.push("p.student_id = ?"); params.push(studentId); }
  if (year) { conditions.push("p.academic_year = ?"); params.push(year); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT p.id, p.student_id studentId, s.full_name studentName, fc.name categoryName,
            p.amount, p.payment_mode paymentMode, p.payment_date paymentDate,
            p.receipt_number receiptNumber, p.reference_number referenceNumber,
            p.notes, u.name recordedByName, p.created_at createdAt
     FROM v2_fee_payments p
     JOIN v2_students s ON s.id = p.student_id
     JOIN v2_fee_categories fc ON fc.id = p.fee_category_id
     JOIN v2_users u ON u.id = p.recorded_by
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.payment_date DESC LIMIT 200`,
    params
  );
  return rows;
}

export async function recordFeePayment(schoolId: number, userId: number, data: {
  studentId: number; feeCategoryId: number; academicYear: string; amount: number;
  paymentMode: string; paymentDate: string; referenceNumber?: string; notes?: string;
}) {
  const [countResult] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_fee_payments WHERE school_id = ?", [schoolId]
  );
  const seq = Number(countResult[0]?.cnt || 0) + 1;
  const receiptNumber = `REC-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_fee_payments (school_id, student_id, fee_category_id, academic_year, amount, payment_mode, payment_date, reference_number, receipt_number, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.studentId, data.feeCategoryId, data.academicYear,
     data.amount, data.paymentMode, data.paymentDate,
     data.referenceNumber || null, receiptNumber, data.notes || null, userId]
  );
  await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
     VALUES (?, ?, 'fee_payment', ?, 'fee.collect', JSON_OBJECT('receipt', ?, 'amount', ?))`,
    [schoolId, userId, (result as any).insertId, receiptNumber, data.amount]
  );
  return { id: (result as any).insertId, receiptNumber };
}

export async function getStudentFeeSummary(schoolId: number, studentId: number, year: string) {
  const [structures] = await getPool().execute<RowDataPacket[]>(
    `SELECT fc.name categoryName, SUM(f.amount) totalAmount
     FROM v2_fee_structures f JOIN v2_fee_categories fc ON fc.id = f.fee_category_id
     WHERE f.school_id = ? AND f.academic_year = ? AND f.class_name = (
       SELECT a.class_admitted FROM v2_admissions a WHERE a.student_id = ? LIMIT 1
     ) GROUP BY fc.name`,
    [schoolId, year, studentId]
  );
  const [payments] = await getPool().execute<RowDataPacket[]>(
    `SELECT fc.name categoryName, SUM(p.amount) paidAmount
     FROM v2_fee_payments p JOIN v2_fee_categories fc ON fc.id = p.fee_category_id
     WHERE p.school_id = ? AND p.student_id = ? AND p.academic_year = ?
     GROUP BY fc.name`,
    [schoolId, studentId, year]
  );
  const [concessions] = await getPool().execute<RowDataPacket[]>(
    `SELECT fc.name categoryName, SUM(c.amount) concessionAmount
     FROM v2_fee_concessions c JOIN v2_fee_categories fc ON fc.id = c.fee_category_id
     WHERE c.school_id = ? AND c.student_id = ? AND c.academic_year = ? AND c.status = 'approved'
     GROUP BY fc.name`,
    [schoolId, studentId, year]
  );
  const feeMap = new Map<string, any>();
  for (const s of structures) {
    feeMap.set(s.categoryName, { categoryName: s.categoryName, total: Number(s.totalAmount), paid: 0, concession: 0, pending: Number(s.totalAmount) });
  }
  for (const p of payments) {
    const entry = feeMap.get(p.categoryName) || { categoryName: p.categoryName, total: 0, paid: 0, concession: 0, pending: 0 };
    entry.paid = Number(p.paidAmount);
    entry.pending = entry.total - entry.paid - entry.concession;
    feeMap.set(p.categoryName, entry);
  }
  for (const c of concessions) {
    const entry = feeMap.get(c.categoryName) || { categoryName: c.categoryName, total: 0, paid: 0, concession: 0, pending: 0 };
    entry.concession = Number(c.concessionAmount);
    entry.pending = entry.total - entry.paid - entry.concession;
    feeMap.set(c.categoryName, entry);
  }
  const summary = Array.from(feeMap.values());
  const totalPending = summary.reduce((sum, f) => sum + f.pending, 0);
  return { summary, totalPending, academicYear: year };
}

export async function listCashbook(schoolId: number, date: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, entry_type entryType, category, description, amount, payment_mode paymentMode,
            reference_number referenceNumber, u.name recordedByName, created_at createdAt
     FROM v2_daily_cashbook c JOIN v2_users u ON u.id = c.recorded_by
     WHERE c.school_id = ? AND c.entry_date = ? ORDER BY c.created_at`,
    [schoolId, date]
  );
  return rows;
}

export async function addCashbookEntry(schoolId: number, userId: number, data: {
  entryType: string; category: string; description: string; amount: number;
  paymentMode: string; referenceNumber?: string; entryDate: string;
}) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_daily_cashbook (school_id, entry_date, entry_type, category, description, amount, payment_mode, reference_number, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.entryDate, data.entryType, data.category, data.description,
     data.amount, data.paymentMode, data.referenceNumber || null, userId]
  );
  return (result as any).insertId;
}

export async function getAccountsDashboard(schoolId: number) {
  const today = new Date().toISOString().split("T")[0];
  const [collResult] = await query(
    "SELECT COALESCE(SUM(amount),0) total FROM v2_fee_payments WHERE school_id = ? AND payment_date = ?",
    [schoolId, today]
  );
  const [expResult] = await query(
    "SELECT COALESCE(SUM(amount),0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_date = ? AND entry_type = 'expense'",
    [schoolId, today]
  );
  const [totalCollResult] = await query(
    "SELECT COALESCE(SUM(amount),0) total FROM v2_fee_payments WHERE school_id = ?",
    [schoolId]
  );
  const [totalExpResult] = await query(
    "SELECT COALESCE(SUM(amount),0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense'",
    [schoolId]
  );
  const [pendingResult] = await query(
    `SELECT COALESCE(SUM(f.amount),0) - COALESCE((SELECT SUM(p.amount) FROM v2_fee_payments p WHERE p.student_id = s.id AND p.academic_year = '2026-27'),0) pending
     FROM v2_students s JOIN v2_admissions a ON a.student_id = s.id
     LEFT JOIN v2_fee_structures f ON f.school_id = s.school_id AND f.class_name = a.class_admitted AND f.academic_year = '2026-27'
     WHERE s.school_id = ? AND s.current_status = 'active' AND s.deleted_at IS NULL`,
    [schoolId]
  );
  const [totalStudentsResult] = await query(
    "SELECT COUNT(*) cnt FROM v2_students WHERE school_id = ? AND current_status = 'active' AND deleted_at IS NULL",
    [schoolId]
  );
  const [collectedStudentsResult] = await query(
    "SELECT COUNT(DISTINCT student_id) cnt FROM v2_fee_payments WHERE school_id = ? AND academic_year = '2026-27'",
    [schoolId]
  );
  const [defaultersResult] = await query(
    `SELECT COUNT(*) cnt FROM (
      SELECT s.id, COALESCE(SUM(f.amount),0) - COALESCE((SELECT SUM(p.amount) FROM v2_fee_payments p WHERE p.student_id = s.id AND p.academic_year = '2026-27'),0) pending
      FROM v2_students s JOIN v2_admissions a ON a.student_id = s.id
      LEFT JOIN v2_fee_structures f ON f.school_id = s.school_id AND f.class_name = a.class_admitted AND f.academic_year = '2026-27'
      WHERE s.school_id = ? AND s.current_status = 'active' AND s.deleted_at IS NULL
      GROUP BY s.id HAVING pending > 0
    ) d`,
    [schoolId]
  );
  const [supplierOutstanding] = await query(
    `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN amount ELSE -amount END),0) outstanding
     FROM v2_supplier_transactions WHERE school_id = ?`,
    [schoolId]
  );
  const totalIncome = Number(totalCollResult[0]?.total || 0);
  const totalExpenses = Number(totalExpResult[0]?.total || 0);
  return {
    todayCollection: Number(collResult[0]?.total || 0), todayExpenses: Number(expResult[0]?.total || 0),
    openingBalance: 0, closingBalance: 0,
    pendingFees: Number(pendingResult[0]?.pending || 0),
    totalStudents: Number(totalStudentsResult[0]?.cnt || 0),
    collectedStudents: Number(collectedStudentsResult[0]?.cnt || 0),
    defaultersCount: Number(defaultersResult[0]?.cnt || 0),
    totalIncome, totalExpenses, cashFlow: totalIncome - totalExpenses,
    outstandingSuppliers: Number(supplierOutstanding[0]?.outstanding || 0),
  };
}

export async function getBankBook(schoolId: number, month?: string) {
  const conditions = ["c.school_id = ?", "c.payment_mode = 'bank_transfer'"];
  const params: any[] = [schoolId];
  if (month) { conditions.push("DATE_FORMAT(c.entry_date, '%Y-%m') = ?"); params.push(month); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT c.id, c.entry_date date, c.entry_type type, c.category, c.description,
            c.amount, c.reference_number referenceNumber, u.name recordedByName
     FROM v2_daily_cashbook c JOIN v2_users u ON u.id = c.recorded_by
     WHERE ${conditions.join(" AND ")} ORDER BY c.entry_date DESC`,
    params
  );
  return rows;
}

export async function listSuppliers(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, contact_person contactPerson, phone, email, gst_number gstNumber, is_active active FROM v2_suppliers WHERE school_id = ? ORDER BY name",
    [schoolId]
  );
  return rows;
}

export async function createSupplier(schoolId: number, data: {
  name: string; contactPerson?: string; phone?: string; email?: string;
  gstNumber?: string; bankAccountNumber?: string; bankIfsc?: string; address?: string;
}) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_suppliers (school_id, name, contact_person, phone, email, gst_number, bank_account_number, bank_ifsc, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.name, data.contactPerson || null, data.phone || null, data.email || null,
     data.gstNumber || null, data.bankAccountNumber || null, data.bankIfsc || null, data.address || null]
  );
  return (result as any).insertId;
}

export async function listSupplierTransactions(schoolId: number, supplierId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, transaction_type type, amount, description, reference_number referenceNumber,
            transaction_date transactionDate, created_at createdAt
     FROM v2_supplier_transactions WHERE school_id = ? AND supplier_id = ?
     ORDER BY transaction_date DESC LIMIT 100`,
    [schoolId, supplierId]
  );
  return rows;
}

export async function addSupplierTransaction(schoolId: number, supplierId: number, userId: number, data: {
  transactionType: string; amount: number; description?: string;
  referenceNumber?: string; transactionDate: string;
}) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_supplier_transactions (school_id, supplier_id, transaction_type, amount, description, reference_number, transaction_date, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, supplierId, data.transactionType, data.amount, data.description || null,
     data.referenceNumber || null, data.transactionDate, userId]
  );
  return (result as any).insertId;
}

export async function listVouchers(schoolId: number, type?: string) {
  const conditions = ["v.school_id = ?"];
  const params: any[] = [schoolId];
  if (type) { conditions.push("v.voucher_type = ?"); params.push(type); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT v.id, v.voucher_type type, v.voucher_number number, v.voucher_date date,
            v.payee_name payeeName, v.amount, v.description, v.payment_mode paymentMode,
            v.status, u.name createdByName, v.created_at createdAt
     FROM v2_vouchers v JOIN v2_users u ON u.id = v.created_by
     WHERE ${conditions.join(" AND ")} ORDER BY v.voucher_date DESC LIMIT 200`,
    params
  );
  return rows;
}

export async function createVoucher(schoolId: number, userId: number, data: {
  voucherType: string; voucherDate: string; payeeName?: string;
  amount: number; description?: string; paymentMode?: string;
}) {
  const prefix = data.voucherType === "payment" ? "PV" : data.voucherType === "receipt" ? "RV" : data.voucherType === "journal" ? "JV" : "EV";
  const [countResult] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_vouchers WHERE school_id = ? AND voucher_type = ?",
    [schoolId, data.voucherType]
  );
  const seq = Number(countResult[0]?.cnt || 0) + 1;
  const voucherNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_vouchers (school_id, voucher_type, voucher_number, voucher_date, payee_name, amount, description, payment_mode, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
    [schoolId, data.voucherType, voucherNumber, data.voucherDate,
     data.payeeName || null, data.amount, data.description || null,
     data.paymentMode || null, userId]
  );
  return { id: (result as any).insertId, voucherNumber };
}

export async function getDailyCollection(schoolId: number, date: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT fc.name categoryName, COUNT(*) transactionCount, SUM(p.amount) totalCollected
     FROM v2_fee_payments p JOIN v2_fee_categories fc ON fc.id = p.fee_category_id
     WHERE p.school_id = ? AND p.payment_date = ?
     GROUP BY fc.name`,
    [schoolId, date]
  );
  const [total] = await getPool().execute<RowDataPacket[]>(
    "SELECT SUM(amount) total FROM v2_fee_payments WHERE school_id = ? AND payment_date = ?",
    [schoolId, date]
  );
  return { date, categories: rows, totalCollected: Number(total[0]?.total || 0) };
}

export async function getFeeDefaulters(schoolId: number, year: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT s.id, s.full_name studentName, s.admission_no admissionNo, a.class_admitted className,
            COALESCE(SUM(f.amount), 0) totalFee,
            COALESCE((SELECT SUM(p.amount) FROM v2_fee_payments p WHERE p.student_id = s.id AND p.academic_year = ?), 0) paid,
            COALESCE(SUM(f.amount), 0) - COALESCE((SELECT SUM(p.amount) FROM v2_fee_payments p WHERE p.student_id = s.id AND p.academic_year = ?), 0) pending
     FROM v2_students s
     JOIN v2_admissions a ON a.student_id = s.id
     LEFT JOIN v2_fee_structures f ON f.school_id = s.school_id AND f.class_name = a.class_admitted AND f.academic_year = ?
     WHERE s.school_id = ? AND s.current_status = 'active' AND s.deleted_at IS NULL
     GROUP BY s.id HAVING pending > 0
     ORDER BY pending DESC LIMIT 100`,
    [year, year, year, schoolId]
  );
  return rows;
}

export async function getMonthlyCollection(schoolId: number, month: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT fc.name categoryName, SUM(p.amount) total
     FROM v2_fee_payments p JOIN v2_fee_categories fc ON fc.id = p.fee_category_id
     WHERE p.school_id = ? AND DATE_FORMAT(p.payment_date, '%Y-%m') = ?
     GROUP BY fc.name`,
    [schoolId, month]
  );
  const [modeRows] = await getPool().execute<RowDataPacket[]>(
    `SELECT payment_mode mode, SUM(amount) amount
     FROM v2_fee_payments WHERE school_id = ? AND DATE_FORMAT(payment_date, '%Y-%m') = ?
     GROUP BY payment_mode`,
    [schoolId, month]
  );
  const total = rows.reduce((s: number, r: any) => s + Number(r.total), 0);
  return { month, total, byCategory: rows, byMode: modeRows };
}

export async function getExpenseReport(schoolId: number, month: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT category, SUM(amount) total
     FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND DATE_FORMAT(entry_date, '%Y-%m') = ?
     GROUP BY category`,
    [schoolId, month]
  );
  const [modeRows] = await getPool().execute<RowDataPacket[]>(
    `SELECT payment_mode mode, SUM(amount) amount
     FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND DATE_FORMAT(entry_date, '%Y-%m') = ?
     GROUP BY payment_mode`,
    [schoolId, month]
  );
  const total = rows.reduce((s: number, r: any) => s + Number(r.total), 0);
  return { month, total, byCategory: rows, byMode: modeRows };
}

// ─── Fee Concessions ────────────────────────────────────────────────────

export async function listConcessions(schoolId: number, studentId?: number, year?: string) {
  const conditions = ["c.school_id = ?"];
  const params: any[] = [schoolId];
  if (studentId) { conditions.push("c.student_id = ?"); params.push(studentId); }
  if (year) { conditions.push("c.academic_year = ?"); params.push(year); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT c.id, c.student_id studentId, s.full_name studentName, s.admission_no admissionNo,
            a.class_admitted className, fc.name categoryName, c.amount, c.reason, c.status,
            c.academic_year academicYear, u.name approvedByName, c.created_at createdAt
     FROM v2_fee_concessions c
     JOIN v2_students s ON s.id = c.student_id
     JOIN v2_admissions a ON a.student_id = s.id
     JOIN v2_fee_categories fc ON fc.id = c.fee_category_id
     LEFT JOIN v2_users u ON u.id = c.approved_by
     WHERE ${conditions.join(" AND ")} ORDER BY c.created_at DESC`,
    params
  );
  return rows;
}

export async function createConcession(schoolId: number, userId: number, data: {
  studentId: number; feeCategoryId: number; academicYear: string; amount: number; reason: string;
}) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_fee_concessions (school_id, student_id, fee_category_id, academic_year, amount, reason, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [schoolId, data.studentId, data.feeCategoryId, data.academicYear, data.amount, data.reason, userId]
  );
  return (result as any).insertId;
}

export async function approveConcession(schoolId: number, userId: number, concessionId: number) {
  await getPool().execute(
    "UPDATE v2_fee_concessions SET status = 'approved', approved_by = ? WHERE id = ? AND school_id = ?",
    [userId, concessionId, schoolId]
  );
  return true;
}

export async function rejectConcession(schoolId: number, userId: number, concessionId: number) {
  await getPool().execute(
    "UPDATE v2_fee_concessions SET status = 'rejected', approved_by = ? WHERE id = ? AND school_id = ?",
    [userId, concessionId, schoolId]
  );
  return true;
}

// ─── Cash Flow & Financial Reports ──────────────────────────────────────

export async function getCashFlowReport(schoolId: number, startDate: string, endDate: string) {
  const [incomeResult] = await getPool().execute<RowDataPacket[]>(
    `SELECT category, SUM(amount) amount FROM v2_daily_cashbook
     WHERE school_id = ? AND entry_type = 'income' AND entry_date BETWEEN ? AND ? GROUP BY category`,
    [schoolId, startDate, endDate]
  );
  const [expenseResult] = await getPool().execute<RowDataPacket[]>(
    `SELECT category, SUM(amount) amount FROM v2_daily_cashbook
     WHERE school_id = ? AND entry_type = 'expense' AND entry_date BETWEEN ? AND ? GROUP BY category`,
    [schoolId, startDate, endDate]
  );
  const [totalIncomeResult] = await getPool().execute<RowDataPacket[]>(
    "SELECT COALESCE(SUM(amount),0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'income' AND entry_date BETWEEN ? AND ?",
    [schoolId, startDate, endDate]
  );
  const [totalExpenseResult] = await getPool().execute<RowDataPacket[]>(
    "SELECT COALESCE(SUM(amount),0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND entry_date BETWEEN ? AND ?",
    [schoolId, startDate, endDate]
  );
  const totalIncome = Number(totalIncomeResult[0]?.total || 0);
  const totalExpenses = Number(totalExpenseResult[0]?.total || 0);
  return { startDate, endDate, totalIncome, totalExpenses, netCashFlow: totalIncome - totalExpenses, incomeByCategory: incomeResult, expensesByCategory: expenseResult };
}

export async function getWeeklyReport(schoolId: number) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const startDate = weekStart.toISOString().split("T")[0] ?? "";
  const endDate = today.toISOString().split("T")[0] ?? "";
  return getCashFlowReport(schoolId, startDate, endDate);
}

export async function getAnnualReport(schoolId: number, year: string) {
  const startDate = `${year}-04-01`;
  const endDate = `${String(Number(year) + 1).padStart(4, "0")}-03-31`;
  return getCashFlowReport(schoolId, startDate, endDate);
}

export async function getSupplierOutstanding(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT sp.id supplierId, sp.name,
            COALESCE(SUM(CASE WHEN st.transaction_type = 'purchase' THEN st.amount ELSE 0 END),0) purchases,
            COALESCE(SUM(CASE WHEN st.transaction_type = 'payment' THEN st.amount ELSE 0 END),0) payments,
            COALESCE(SUM(CASE WHEN st.transaction_type = 'purchase' THEN st.amount ELSE -st.amount END),0) outstanding
     FROM v2_suppliers sp
     LEFT JOIN v2_supplier_transactions st ON st.supplier_id = sp.id AND st.school_id = sp.school_id
     WHERE sp.school_id = ?
     GROUP BY sp.id HAVING outstanding > 0
     ORDER BY outstanding DESC`,
    [schoolId]
  );
  return rows;
}

// ─── Users ──────────────────────────────────────────────────────────────

export async function deleteUser(schoolId: number, userId: number, targetUserId: number) {
  await getPool().execute("UPDATE v2_users SET is_active = 0 WHERE id = ?", [targetUserId]);
  await getPool().execute(
    "DELETE FROM v2_user_school_roles WHERE user_id = ? AND school_id = ?",
    [targetUserId, schoolId]
  );
  await getPool().execute(
    `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
     VALUES (?, ?, 'user', ?, 'user.delete', JSON_OBJECT('target_user', ?))`,
    [schoolId, userId, targetUserId, targetUserId]
  );
  return true;
}

// ─── Audit Trail ────────────────────────────────────────────────────────

export async function getAuditTrail(schoolId: number, entityType?: string, limit = 50) {
  const conditions = ["school_id = ?"];
  const params: any[] = [schoolId];
  if (entityType) { conditions.push("entity_type = ?"); params.push(entityType); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, entity_type entityType, entity_id entityId, action_name action,
            u.name userName, metadata_json metadata, created_at createdAt
     FROM v2_audit_events a LEFT JOIN v2_users u ON u.id = a.user_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

// ─── Global Search ───────────────────────────────────────────────────────

export async function globalSearch(schoolId: number, query: string) {
  const like = `%${query}%`;
  const results: { type: string; id: number; title: string; subtitle: string; module: string }[] = [];

  const [students] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, full_name title, CONCAT(admission_no, ' · ', class_admitted) subtitle
     FROM v2_students WHERE school_id = ? AND deleted_at IS NULL
     AND (full_name LIKE ? OR admission_no LIKE ?) LIMIT 10`,
    [schoolId, like, like]
  );
  for (const r of students) results.push({ type: "student", id: r.id, title: r.title, subtitle: r.subtitle, module: "students" });

  const [users] = await getPool().execute<RowDataPacket[]>(
    `SELECT u.id, u.name title, usr.role_code subtitle
     FROM v2_users u JOIN v2_user_school_roles usr ON usr.user_id = u.id
     WHERE usr.school_id = ? AND u.is_active = 1 AND u.name LIKE ? LIMIT 10`,
    [schoolId, like]
  );
  for (const r of users) results.push({ type: "user", id: r.id, title: r.title, subtitle: r.subtitle, module: "users" });

  const [events] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, title, CONCAT(event_type, ' · ', DATE(start_date)) subtitle
     FROM v2_events WHERE school_id = ? AND title LIKE ? LIMIT 10`,
    [schoolId, like]
  );
  for (const r of events) results.push({ type: "event", id: r.id, title: r.title, subtitle: r.subtitle, module: "events" });

  const [certs] = await getPool().execute<RowDataPacket[]>(
    `SELECT c.id, CONCAT(c.certificate_type, ' — ', s.full_name) title, CONCAT(s.admission_no, ' · ', c.status) subtitle
     FROM v2_certificates c JOIN v2_students s ON s.id = c.student_id
     WHERE c.school_id = ? AND (s.full_name LIKE ? OR c.certificate_type LIKE ?) LIMIT 10`,
    [schoolId, like, like]
  );
  for (const r of certs) results.push({ type: "certificate", id: r.id, title: r.title, subtitle: r.subtitle, module: "certificates" });

  const [receipts] = await getPool().execute<RowDataPacket[]>(
    `SELECT p.id, CONCAT('Receipt ', p.receipt_number) title, CONCAT(s.full_name, ' · ₹', p.amount) subtitle
     FROM v2_fee_payments p JOIN v2_students s ON s.id = p.student_id
     WHERE p.school_id = ? AND (p.receipt_number LIKE ? OR s.full_name LIKE ?) LIMIT 10`,
    [schoolId, like, like]
  );
  for (const r of receipts) results.push({ type: "receipt", id: r.id, title: r.title, subtitle: r.subtitle, module: "fees" });

  const [suppliers] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, name title, COALESCE(contact_person, '') subtitle
     FROM v2_suppliers WHERE school_id = ? AND (name LIKE ? OR contact_person LIKE ?) LIMIT 10`,
    [schoolId, like, like]
  );
  for (const r of suppliers) results.push({ type: "supplier", id: r.id, title: r.title, subtitle: r.subtitle, module: "fees" });

  return results.slice(0, 20);
}

// ─── Notifications ──────────────────────────────────────────────────────

export async function getNotifications(schoolId: number, userId: number) {
  const [countResult] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) cnt FROM v2_notifications WHERE school_id = ? AND user_id = ? AND is_read = 0`,
    [schoolId, userId]
  );
  const [notifications] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, title, message, notification_type type, is_read read, created_at createdAt, module_name module, entity_id entityId
     FROM v2_notifications WHERE school_id = ? AND user_id = ?
     ORDER BY created_at DESC LIMIT 20`,
    [schoolId, userId]
  );
  return { unreadCount: Number(countResult[0]?.cnt || 0), notifications };
}

export async function markNotificationsRead(schoolId: number, userId: number, notificationIds?: number[]) {
  if (notificationIds && notificationIds.length > 0) {
    await getPool().execute(
      `UPDATE v2_notifications SET is_read = 1 WHERE school_id = ? AND user_id = ? AND id IN (${notificationIds.map(() => "?").join(",")})`,
      [schoolId, userId, ...notificationIds]
    );
  } else {
    await getPool().execute(
      "UPDATE v2_notifications SET is_read = 1 WHERE school_id = ? AND user_id = ? AND is_read = 0",
      [schoolId, userId]
    );
  }
  return true;
}

export async function createNotification(schoolId: number, data: { userId: number; title: string; message: string; type: string; module?: string; entityId?: number }) {
  await getPool().execute(
    `INSERT INTO v2_notifications (school_id, user_id, title, message, notification_type, module_name, entity_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.userId, data.title, data.message, data.type, data.module || null, data.entityId || null]
  );
}

// ─── Dashboard Extended (role-based) ────────────────────────────────────

export async function getDashboardExtended(schoolId: number, role: string) {
  const [studentCount] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) total, SUM(CASE WHEN current_status = 'active' THEN 1 ELSE 0 END) active FROM v2_students WHERE school_id = ? AND deleted_at IS NULL",
    [schoolId]
  );
  const [certCount] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_certificates WHERE school_id = ? AND status = 'pending'",
    [schoolId]
  );
  const [feeCount] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT s.id) cnt FROM v2_students s
     JOIN v2_admissions a ON a.student_id = s.id
     LEFT JOIN v2_fee_structures f ON f.school_id = s.school_id AND f.class_name = a.class_admitted AND f.academic_year = '2026-27'
     LEFT JOIN (SELECT student_id, SUM(amount) paid FROM v2_fee_payments WHERE school_id = ? AND academic_year = '2026-27' GROUP BY student_id) p ON p.student_id = s.id
     WHERE s.school_id = ? AND s.current_status = 'active' AND s.deleted_at IS NULL
     AND COALESCE(f.amount, 0) - COALESCE(p.paid, 0) > 0`,
    [schoolId, schoolId]
  );
  const [eventDrafts] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_events WHERE school_id = ? AND status = 'draft'",
    [schoolId]
  );
  const today = new Date().toISOString().split("T")[0] || "";
  const [todayFees] = await getPool().execute<RowDataPacket[]>(
    "SELECT COALESCE(SUM(amount), 0) total FROM v2_fee_payments WHERE school_id = ? AND payment_date = ?",
    [schoolId, today]
  );
  const [recentActivity] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, action_name action, CONCAT(entity_type, ' #', entity_id) detail,
            created_at createdAt, entity_type module
     FROM v2_audit_events WHERE school_id = ?
     ORDER BY created_at DESC LIMIT 10`,
    [schoolId]
  );
  return {
    totalStudents: Number(studentCount[0]?.total || 0),
    activeStudents: Number(studentCount[0]?.active || 0),
    pendingCertificates: Number(certCount[0]?.cnt || 0),
    unpaidFees: Number(feeCount[0]?.cnt || 0),
    draftEvents: Number(eventDrafts[0]?.cnt || 0),
    feesCollectedToday: Number(todayFees[0]?.total || 0),
    recentActivity: recentActivity.map((r: any) => ({
      id: r.id, action: r.action, detail: r.detail, time: r.createdAt, module: r.module,
    })),
    pendingTasks: [
      { id: 1, task: `Approve ${certCount[0]?.cnt || 0} pending certificates`, module: "certificates", count: Number(certCount[0]?.cnt || 0) },
      { id: 2, task: `${feeCount[0]?.cnt || 0} students with unpaid fees`, module: "fees", count: Number(feeCount[0]?.cnt || 0) },
      { id: 3, task: `${eventDrafts[0]?.cnt || 0} draft events to publish`, module: "events", count: Number(eventDrafts[0]?.cnt || 0) },
    ],
  };
}

// ─── Events Repository Functions ────────────────────────────────────────

export async function listEvents(schoolId: number, type?: string, status?: string) {
  const conditions = ["e.school_id = ?"];
  const params: any[] = [schoolId];
  if (type) { conditions.push("e.event_type = ?"); params.push(type); }
  if (status) { conditions.push("e.status = ?"); params.push(status); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT e.id, e.title, e.description, e.event_type type, e.start_date startDate, e.end_date endDate,
            e.location, e.status, u.name createdByName,
            (SELECT COUNT(*) FROM v2_event_participants ep WHERE ep.event_id = e.id) participantCount,
            (SELECT COUNT(*) FROM v2_event_media em WHERE em.event_id = e.id) mediaCount
     FROM v2_events e JOIN v2_users u ON u.id = e.created_by
     WHERE ${conditions.join(" AND ")}
     ORDER BY e.start_date DESC LIMIT 100`,
    params
  );
  return rows;
}

export async function getEvent(schoolId: number, eventId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT e.id, e.title, e.description, e.event_type type, e.start_date startDate, e.end_date endDate,
            e.location, e.status, u.name createdByName, e.created_at createdAt
     FROM v2_events e JOIN v2_users u ON u.id = e.created_by
     WHERE e.id = ? AND e.school_id = ?`,
    [eventId, schoolId]
  );
  if (!rows[0]) return null;
  const [participants] = await getPool().execute<RowDataPacket[]>(
    `SELECT ep.id, s.id studentId, s.full_name studentName, s.admission_no admissionNo,
            ep.role, ep.attendance, ep.certificate_issued certificateIssued
     FROM v2_event_participants ep JOIN v2_students s ON s.id = ep.student_id
     WHERE ep.event_id = ?`,
    [eventId]
  );
  const [media] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, media_type mediaType, original_filename filename, file_size_bytes fileSize,
            mime_type mimeType, caption, created_at createdAt
     FROM v2_event_media WHERE event_id = ? ORDER BY created_at DESC`,
    [eventId]
  );
  return { ...rows[0], participants, media };
}

export async function createEvent(schoolId: number, userId: number, data: {
  title: string; description?: string; eventType: string;
  startDate: string; endDate?: string; location?: string;
}) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_events (school_id, title, description, event_type, start_date, end_date, location, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
    [schoolId, data.title, data.description || null, data.eventType, data.startDate, data.endDate || null, data.location || null, userId]
  );
  return (result as any).insertId;
}

export async function updateEventStatus(schoolId: number, eventId: number, status: string) {
  await getPool().execute<RowDataPacket[]>(
    "UPDATE v2_events SET status = ? WHERE id = ? AND school_id = ?",
    [status, eventId, schoolId]
  );
}

export async function addEventParticipants(schoolId: number, eventId: number, studentIds: number[], role?: string) {
  for (const studentId of studentIds) {
    await getPool().execute<RowDataPacket[]>(
      "INSERT IGNORE INTO v2_event_participants (event_id, student_id, role) SELECT ?, ?, ? FROM v2_events WHERE id = ? AND school_id = ?",
      [eventId, studentId, role || null, eventId, schoolId]
    );
  }
}

export async function removeEventParticipant(schoolId: number, eventId: number, studentId: number) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `DELETE ep FROM v2_event_participants ep
     JOIN v2_events e ON e.id = ep.event_id
     WHERE ep.event_id = ? AND ep.student_id = ? AND e.school_id = ?`,
    [eventId, studentId, schoolId]
  );
  return (result as any).affectedRows > 0;
}

export async function updateEventAttendance(schoolId: number, eventId: number, records: { participantId: number; attendance: string }[]) {
  for (const record of records) {
    await getPool().execute<RowDataPacket[]>(
      `UPDATE v2_event_participants SET attendance = ? WHERE id = ? AND event_id = ?
       AND event_id IN (SELECT id FROM v2_events WHERE id = ? AND school_id = ?)`,
      [record.attendance, record.participantId, eventId, eventId, schoolId]
    );
  }
}

export async function uploadEventMedia(schoolId: number, eventId: number, userId: number, files: Express.Multer.File[], mediaType: string, caption?: string) {
  // Verify event belongs to this school before uploading
  const [evCheck] = await getPool().execute<RowDataPacket[]>(
    "SELECT id FROM v2_events WHERE id = ? AND school_id = ?", [eventId, schoolId]
  );
  if (!evCheck[0]) return 0;
  let count = 0;
  for (const file of files) {
    await getPool().execute<RowDataPacket[]>(
      `INSERT INTO v2_event_media (event_id, media_type, original_filename, storage_path, file_size_bytes, mime_type, caption, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, mediaType, file.originalname, file.path, file.size, file.mimetype, caption || null, userId]
    );
    count++;
  }
  return count;
}

export async function getEventsDashboard(schoolId: number) {
  const [upcoming] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_events WHERE school_id = ? AND start_date > UTC_TIMESTAMP() AND status != 'cancelled'",
    [schoolId]
  );
  const [completed] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_events WHERE school_id = ? AND status = 'completed'",
    [schoolId]
  );
  const [drafts] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_events WHERE school_id = ? AND status = 'draft'",
    [schoolId]
  );
  const [total] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) cnt FROM v2_events WHERE school_id = ?", [schoolId]
  );
  const [mediaStats] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) totalMedia,
            SUM(CASE WHEN media_type = 'photo' THEN 1 ELSE 0 END) totalPhotos,
            SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) totalVideos,
            COALESCE(SUM(file_size_bytes), 0) totalStorageBytes
     FROM v2_event_media em JOIN v2_events e ON e.id = em.event_id WHERE e.school_id = ?`,
    [schoolId]
  );
  const [recentUploads] = await getPool().execute<RowDataPacket[]>(
    `SELECT em.id, em.original_filename filename, em.media_type mediaType, em.file_size_bytes fileSize, em.created_at createdAt
     FROM v2_event_media em JOIN v2_events e ON e.id = em.event_id
     WHERE e.school_id = ? ORDER BY em.created_at DESC LIMIT 5`,
    [schoolId]
  );
  return {
    upcoming: Number(upcoming[0]?.cnt || 0), completed: Number(completed[0]?.cnt || 0),
    drafts: Number(drafts[0]?.cnt || 0), total: Number(total[0]?.cnt || 0),
    totalMedia: Number(mediaStats[0]?.totalMedia || 0), totalPhotos: Number(mediaStats[0]?.totalPhotos || 0),
    totalVideos: Number(mediaStats[0]?.totalVideos || 0), totalStorageBytes: Number(mediaStats[0]?.totalStorageBytes || 0),
    recentUploads,
  };
}

export async function getEventsArchive(schoolId: number, academicYear?: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT e.id, e.title, e.event_type type, e.start_date startDate, e.end_date endDate,
            e.location, e.status,
            (SELECT COUNT(*) FROM v2_event_participants ep WHERE ep.event_id = e.id) participantCount,
            (SELECT COUNT(*) FROM v2_event_media em WHERE em.event_id = e.id) mediaCount
     FROM v2_events e WHERE e.school_id = ? AND e.status = 'completed'
     ORDER BY e.start_date DESC`,
    [schoolId]
  );
  return [{ year: academicYear || "2026–27", events: rows }];
}

export async function deleteEvent(schoolId: number, eventId: number) {
  await getPool().execute<RowDataPacket[]>(
    "DELETE FROM v2_events WHERE id = ? AND school_id = ?", [eventId, schoolId]
  );
}

export async function updateEvent(schoolId: number, eventId: number, data: {
  title?: string; description?: string; eventType?: string;
  startDate?: string; endDate?: string; location?: string; academicYear?: string; budget?: number;
}) {
  const fields: string[] = [];
  const params: any[] = [];
  if (data.title) { fields.push("title = ?"); params.push(data.title); }
  if (data.description !== undefined) { fields.push("description = ?"); params.push(data.description); }
  if (data.eventType) { fields.push("event_type = ?"); params.push(data.eventType); }
  if (data.startDate) { fields.push("start_date = ?"); params.push(data.startDate); }
  if (data.endDate !== undefined) { fields.push("end_date = ?"); params.push(data.endDate || null); }
  if (data.location !== undefined) { fields.push("location = ?"); params.push(data.location || null); }
  if (data.academicYear !== undefined) { fields.push("academic_year = ?"); params.push(data.academicYear || null); }
  if (data.budget !== undefined) { fields.push("budget = ?"); params.push(data.budget); }
  if (fields.length === 0) return;
  params.push(eventId, schoolId);
  await getPool().execute<RowDataPacket[]>(
    `UPDATE v2_events SET ${fields.join(", ")} WHERE id = ? AND school_id = ?`, params
  );
}

export async function getEventMedia(schoolId: number, mediaId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT em.id, em.original_filename filename, em.storage_path storagePath, em.mime_type mimeType,
            em.file_size_bytes fileSize, em.media_type mediaType
     FROM v2_event_media em JOIN v2_events e ON e.id = em.event_id
     WHERE em.id = ? AND e.school_id = ?`,
    [mediaId, schoolId]
  );
  return rows[0] || null;
}

export async function deleteEventMedia(schoolId: number, mediaId: number) {
  const [media] = await getPool().execute<RowDataPacket[]>(
    `SELECT em.id FROM v2_event_media em
     JOIN v2_events e ON e.id = em.event_id
     WHERE em.id = ? AND e.school_id = ?`,
    [mediaId, schoolId]
  );
  if (!media[0]) return false;
  await getPool().execute("DELETE FROM v2_event_media WHERE id = ?", [mediaId]);
  return true;
}

export async function listEventFolders(schoolId: number, eventId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT ef.id, ef.name, ef.folder_type folderType, ef.parent_id parentId
     FROM v2_event_folders ef JOIN v2_events e ON e.id = ef.event_id
     WHERE ef.event_id = ? AND e.school_id = ? ORDER BY ef.name`,
    [eventId, schoolId]
  );
  return rows;
}

export async function createEventFolder(schoolId: number, eventId: number, name: string, folderType: string, parentId?: number) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_event_folders (event_id, parent_id, name, folder_type)
     SELECT ?, ?, ?, ? FROM v2_events WHERE id = ? AND school_id = ?`,
    [eventId, parentId || null, name, folderType, eventId, schoolId]
  );
  return (result as any).insertId;
}

export async function deleteEventFolder(schoolId: number, folderId: number) {
  const [folder] = await getPool().execute<RowDataPacket[]>(
    `SELECT ef.id FROM v2_event_folders ef
     JOIN v2_events e ON e.id = ef.event_id
     WHERE ef.id = ? AND e.school_id = ?`,
    [folderId, schoolId]
  );
  if (!folder[0]) return false;
  await getPool().execute("DELETE FROM v2_event_folders WHERE id = ?", [folderId]);
  return true;
}

export async function listEventBudgets(schoolId: number, eventId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT eb.id, eb.category, eb.description, eb.amount, eb.expense_type expenseType,
            u.name createdByName, eb.created_at createdAt
     FROM v2_event_budgets eb JOIN v2_events e ON e.id = eb.event_id
     JOIN v2_users u ON u.id = eb.created_by
     WHERE eb.event_id = ? AND e.school_id = ? ORDER BY eb.expense_type, eb.category`,
    [eventId, schoolId]
  );
  return rows;
}

export async function createEventBudget(schoolId: number, eventId: number, userId: number, data: {
  category: string; description?: string; amount: number; expenseType: string;
}) {
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_event_budgets (event_id, category, description, amount, expense_type, created_by)
     SELECT ?, ?, ?, ?, ?, ? FROM v2_events WHERE id = ? AND school_id = ?`,
    [eventId, data.category, data.description || null, data.amount, data.expenseType, userId, eventId, schoolId]
  );
  return (result as any).insertId;
}

export async function deleteEventBudget(schoolId: number, budgetId: number) {
  const [budget] = await getPool().execute<RowDataPacket[]>(
    `SELECT eb.id FROM v2_event_budgets eb
     JOIN v2_events e ON e.id = eb.event_id
     WHERE eb.id = ? AND e.school_id = ?`,
    [budgetId, schoolId]
  );
  if (!budget[0]) return false;
  await getPool().execute("DELETE FROM v2_event_budgets WHERE id = ?", [budgetId]);
  return true;
}

export async function getEventReports(schoolId: number) {
  const [eventStats] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) totalEvents,
            SUM(CASE WHEN event_type = 'cultural' THEN 1 ELSE 0 END) cultural,
            SUM(CASE WHEN event_type = 'sports' THEN 1 ELSE 0 END) sports,
            SUM(CASE WHEN event_type = 'academic' THEN 1 ELSE 0 END) academic,
            SUM(CASE WHEN event_type = 'general' THEN 1 ELSE 0 END) general
     FROM v2_events WHERE school_id = ?`,
    [schoolId]
  );
  const [mediaStats] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) totalMedia,
            SUM(CASE WHEN media_type = 'photo' THEN 1 ELSE 0 END) totalPhotos,
            SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) totalVideos,
            SUM(CASE WHEN media_type = 'document' THEN 1 ELSE 0 END) totalDocuments,
            COALESCE(SUM(file_size_bytes), 0) totalStorageBytes
     FROM v2_event_media em JOIN v2_events e ON e.id = em.event_id WHERE e.school_id = ?`,
    [schoolId]
  );
  const [participantStats] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) totalParticipants
     FROM v2_event_participants ep JOIN v2_events e ON e.id = ep.event_id WHERE e.school_id = ?`,
    [schoolId]
  );
  const [budgetStats] = await getPool().execute<RowDataPacket[]>(
    `SELECT expense_type, SUM(amount) total
     FROM v2_event_budgets eb JOIN v2_events e ON e.id = eb.event_id WHERE e.school_id = ?
     GROUP BY expense_type`,
    [schoolId]
  );
  return {
    totalEvents: Number(eventStats[0]?.totalEvents || 0),
    totalMedia: Number(mediaStats[0]?.totalMedia || 0),
    totalPhotos: Number(mediaStats[0]?.totalPhotos || 0),
    totalVideos: Number(mediaStats[0]?.totalVideos || 0),
    totalDocuments: Number(mediaStats[0]?.totalDocuments || 0),
    totalStorageBytes: Number(mediaStats[0]?.totalStorageBytes || 0),
    totalParticipants: Number(participantStats[0]?.totalParticipants || 0),
    totalBudgetPlanned: Number(budgetStats.find((b: any) => b.expenseType === "planned")?.total || 0),
    totalBudgetActual: Number(budgetStats.find((b: any) => b.expenseType === "actual")?.total || 0),
    byType: [
      { type: "cultural", count: Number(eventStats[0]?.cultural || 0) },
      { type: "sports", count: Number(eventStats[0]?.sports || 0) },
      { type: "academic", count: Number(eventStats[0]?.academic || 0) },
      { type: "general", count: Number(eventStats[0]?.general || 0) },
    ],
  };
}
