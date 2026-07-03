/**
 * Centralized Data Access Layer
 *
 * All data access goes through this module. DEMO_MODE switching happens HERE,
 * never in controllers or routes. The rest of the application calls these
 * functions without knowing whether they hit MySQL or in-memory mocks.
 */

import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getConfig } from "./config/env.js";
import { getPool, query } from "./database/pool.js";
import { createProductionStudent, getProductionAcademicSetup, getProductionDashboard, getProductionStudent, listProductionStudents, updateProductionStudent, changeProductionStudentStatus, restoreProductionStudent, exportProductionStudents, checkDuplicateAdmission, bulkPromoteProductionStudents, bulkAssignProductionStudents, getProductionStudentTimeline, getProductionStudentMedical, upsertProductionStudentMedical, getProductionStudentNotes, createProductionStudentNote, deleteProductionStudentNote } from "./modules/students/studentRepository.js";
import { listBatches, getBatch, stageBatch, approveBatch, existingAdmissionNumbers } from "./modules/imports/importService.js";
import { rolePermissions } from "./security/permissions.js";
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

export type StudentRow = {
  id: number; schoolId: number; studentUid: string; admissionNo: string;
  fullName: string; className: string; sectionName: string; gender: string; status: string;
};

// ─── Mock Data (demo mode only) ──────────────────────────────────────────

const MOCK_SCHOOLS: School[] = [
  { id: 1, code: "MEMHSVNK", name: "Montessori EM High School", city: "Vidya Nagar, Kurnool" },
  { id: 2, code: "MHSA", name: "Montessori High School", city: "Alampur" },
  { id: 3, code: "MSSSACK", name: "Montessori Senior Secondary School", city: "A-Camp, Kurnool" },
  { id: 4, code: "MIRSNHK", name: "Montessori Indus Residential School", city: "Kallur" },
  { id: 5, code: "MEMS", name: "Montessori EM School", city: "Nandyal" },
  { id: 6, code: "MHSV", name: "Montessori High School Vijayawada", city: "Vijayawada" },
  { id: 7, code: "MHSG", name: "Montessori High School Guntur", city: "Guntur" },
  { id: 8, code: "MSRS", name: "Montessori Sarada Residential School", city: "Tirupati" },
  { id: 9, code: "MSES", name: "Montessori Sri Excellence School", city: "Hyderabad" },
];

const MOCK_SCHOOL_MAP: Record<number, School> = Object.fromEntries(MOCK_SCHOOLS.map(s => [s.id, s]));

const MOCK_ADMIN = {
  email: "admin@montessori.edu",
  password: "Montessori@2026",
  name: "Admin User",
  roleCode: "school_admin",
  roleDisplay: "School Admin",
  permissions: rolePermissions["school_admin"],
};

const MOCK_SUPER_ADMIN = {
  email: "superadmin@montessori.edu",
  password: "Montessori@2026",
  name: "Super Admin",
  roleCode: "group_super_admin",
  roleDisplay: "Group Super Admin",
  permissions: rolePermissions["group_super_admin"],
};

const mockStudents: StudentRow[] = [];
const mockBatches: any[] = [];

// ─── Helper ──────────────────────────────────────────────────────────────

const isDemo = () => getConfig().DEMO_MODE;

const ROLE_NAMES: Record<string, string> = {
  group_super_admin: "Group Super Admin", school_admin: "School Admin", principal: "Principal",
  office_staff: "Office Staff", teacher: "Teacher", accountant: "Accountant", auditor: "Auditor",
};

// ─── Schools ─────────────────────────────────────────────────────────────

export async function listSchools(): Promise<School[]> {
  if (isDemo()) return MOCK_SCHOOLS;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, legacy_code code, name, city FROM v2_schools WHERE status = 'active'"
  );
  return rows as School[];
}

export async function getSchoolById(schoolId: number): Promise<School | null> {
  if (isDemo()) return MOCK_SCHOOL_MAP[schoolId] || null;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, legacy_code code, name, city FROM v2_schools WHERE id = ? AND status = 'active' LIMIT 1",
    [schoolId]
  );
  return (rows[0] as School) || null;
}

// ─── Authentication ──────────────────────────────────────────────────────

export async function authenticateUser(schoolId: number, email: string, password: string, ipAddress?: string, userAgent?: string): Promise<{
  token: string; mustChangePassword: boolean;
  user: { name: string; role: string }; school: School;
} | null> {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(getConfig().JWT_SECRET);

  if (isDemo()) {
    const target = MOCK_SCHOOL_MAP[schoolId];
    if (!target) return null;
    const creds = email === MOCK_SUPER_ADMIN.email ? MOCK_SUPER_ADMIN
                : email === MOCK_ADMIN.email ? MOCK_ADMIN
                : null;
    if (!creds || password !== creds.password) return null;
    const school = creds === MOCK_SUPER_ADMIN ? { id: 0, code: "GLOBAL", name: "Platform Administration", city: "All Campuses" } : target;
    const jwt = await new SignJWT({ schoolId: school.id, role: creds.roleCode, permissions: creds.permissions })
      .setProtectedHeader({ alg: "HS256" }).setSubject(String(schoolId === 0 ? 0 : 1))
      .setIssuedAt().setExpirationTime("15m").sign(secret);
    return { token: jwt, mustChangePassword: false, user: { name: creds.name, role: creds.roleDisplay }, school };
  }

  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT u.id, u.name user_name, u.password_hash, u.force_password_reset, usr.role_code,
            s.id school_id, s.legacy_code code, s.name school_name, COALESCE(s.city, '') city
     FROM v2_users u
     JOIN v2_user_school_roles usr ON usr.user_id = u.id
     JOIN v2_schools s ON s.id = usr.school_id
     WHERE LOWER(u.email) = LOWER(?) AND u.is_active = 1 AND s.id = ? LIMIT 1`,
    [email, schoolId]
  );
  const account = rows[0] as AuthAccount | undefined;
  if (!account || !(await bcrypt.compare(password, String(account.passwordHash)))) return null;

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
  // Audit log for login with IP
  await getPool().execute(
    `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
     VALUES (?, ?, 'user', ?, 'auth.login', JSON_OBJECT('ip_address', ?, 'user_agent', ?))`,
    [schoolId, account.userId, account.userId, ipAddress || null, userAgent || null]
  );

  const jwt = await new SignJWT({ schoolId, role: account.roleCode, permissions, sid: sessionId, mustChangePassword: account.forcePasswordReset })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(account.userId))
    .setIssuedAt().setExpirationTime("15m").sign(secret);

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

  if (isDemo()) {
    const jwt = await new SignJWT({ schoolId: 1, role: "school_admin", permissions: MOCK_ADMIN.permissions })
      .setProtectedHeader({ alg: "HS256" }).setSubject("1")
      .setIssuedAt().setExpirationTime("15m").sign(secret);
    return { token: jwt, mustChangePassword: false };
  }

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
    .setIssuedAt().setExpirationTime("15m").sign(secret);

  return { token: jwt, mustChangePassword: Boolean(rows[0].force_password_reset) };
}

export async function validateSession(sessionId: string, userId: number, schoolId: number): Promise<boolean> {
  if (isDemo()) return true;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id FROM v2_sessions WHERE id = ? AND user_id = ? AND school_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [sessionId, userId, schoolId]
  );
  return Boolean(rows[0]);
}

export async function revokeSession(sessionId: string, userId: number): Promise<void> {
  if (isDemo()) return;
  await getPool().execute(
    "UPDATE v2_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ?",
    [sessionId, userId]
  );
}

export async function changePassword(userId: number, newPasswordHash: string): Promise<void> {
  if (isDemo()) return;
  await getPool().execute(
    "UPDATE v2_users SET password_hash = ?, force_password_reset = 0, password_changed_at = UTC_TIMESTAMP() WHERE id = ?",
    [newPasswordHash, userId]
  );
  // Audit logged by caller
}

export async function getCurrentPasswordHash(userId: number): Promise<string | null> {
  if (isDemo()) return null;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT password_hash FROM v2_users WHERE id = ? AND is_active = 1", [userId]
  );
  return rows[0] ? String(rows[0].password_hash) : null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────

export async function getDashboard(schoolId: number) {
  if (isDemo()) {
    const own = mockStudents.filter(s => s.schoolId === schoolId);
    return {
      totals: { students: 1842, active: 1783, schools: 1, pendingCertificates: 4 },
      enrollmentByClass: [
        { label: "Pre-K", value: 186 }, { label: "K1", value: 230 }, { label: "K2", value: 216 },
        { label: "Gr 1", value: 278 }, { label: "Gr 2", value: 254 }, { label: "Gr 3", value: 294 },
        { label: "Gr 4", value: 269 }, { label: "Gr 5", value: 242 },
      ],
      recent: [
        { title: "Student record updated", meta: own[0]?.fullName || "Student", time: "8 min" },
        { title: "Transfer certificate requested", meta: "Request requires approval", time: "34 min" },
        { title: "Bulk import validated", meta: "42 records ready to review", time: "1 hr" },
        { title: "New admission created", meta: own[1]?.fullName || "Student", time: "2 hrs" },
      ],
    };
  }
  return getProductionDashboard(schoolId);
}

// ─── Students ────────────────────────────────────────────────────────────

export async function listStudents(schoolId: number, search: string, status: string, limit: number, offset: number) {
  if (isDemo()) {
    const filtered = mockStudents.filter(
      s => s.schoolId === schoolId
        && (!search || `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(search))
        && (!status || s.status === status)
    );
    return { data: filtered.slice(offset, offset + limit), total: filtered.length };
  }
  const result = await listProductionStudents(schoolId, search, status, limit, offset);
  return { data: result.data, total: result.total };
}

export async function getStudent(schoolId: number, studentId: number) {
  if (isDemo()) {
    const student = mockStudents.find(s => s.id === studentId && s.schoolId === schoolId);
    if (!student) return null;
    return {
      id: student.id, full_name: student.fullName, student_uid: student.studentUid,
      admission_no: student.admissionNo, classAdmitted: student.className,
      sectionName: student.sectionName, status: student.status,
      date_of_birth: "2015-05-12", gender: student.gender,
      nationality: "Indian", religion: "Hindu",
      residenceAddress: "123 Montessori Way, Model Town",
      student_email: "contact@example.com",
      guardians: [
        { id: 1, relationType: "Father", fullName: "Rajesh Kumar", mobile: "+91 9876543210", occupation: "Software Engineer" },
        { id: 2, relationType: "Mother", fullName: "Anita Sharma", mobile: "+91 8765432109", occupation: "Teacher" },
      ],
      history: [{ actionName: "Student Admitted", createdAt: "2026-06-01 10:00:00" }],
      identifiers: [{ type: "Aadhaar", value: "XXXX-XXXX-1234" }, { type: "PEN", value: "PEN-9876" }],
    };
  }
  return getProductionStudent(schoolId, studentId);
}

export async function createStudent(input: any, context: { schoolId: number; userId: number }, photoPath?: string) {
  if (isDemo()) {
    if (mockStudents.some(s => s.schoolId === context.schoolId && s.admissionNo.toLowerCase() === input.admissionNo.toLowerCase())) {
      throw Object.assign(new Error("That admission number already exists in this school."), { statusCode: 409 });
    }
    const id = Math.max(...mockStudents.map(s => s.id), 0) + 1;
    const student: StudentRow = {
      id, schoolId: context.schoolId,
      studentUid: `MON-${new Date().getFullYear()}-${String(id).padStart(5, "0")}`,
      admissionNo: input.admissionNo, fullName: input.fullName,
      className: input.classAdmitted, sectionName: input.sectionName || "—",
      gender: input.gender || "other", status: input.currentStatus || "active",
    };
    mockStudents.unshift(student);
    return student;
  }
  return createProductionStudent(input, context, photoPath);
}

export async function updateStudent(schoolId: number, studentId: number, userId: number, input: any) {
  if (isDemo()) {
    const student = mockStudents.find(s => s.id === studentId && s.schoolId === schoolId);
    if (!student) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
    student.fullName = input.fullName;
    student.className = input.classAdmitted;
    student.sectionName = input.sectionName || "—";
    return student;
  }
  return updateProductionStudent(schoolId, studentId, userId, input);
}

export async function changeStudentStatus(schoolId: number, studentId: number, userId: number, status: string, reason?: string) {
  if (isDemo()) {
    const student = mockStudents.find(s => s.id === studentId && s.schoolId === schoolId);
    if (!student) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
    student.status = status;
    return { id: student.id, status };
  }
  return changeProductionStudentStatus(schoolId, studentId, userId, status, reason);
}

export async function restoreStudent(schoolId: number, studentId: number) {
  if (isDemo()) {
    const student = mockStudents.find(s => s.id === studentId && s.schoolId === schoolId);
    if (!student) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
    student.status = "active";
    return { id: student.id, status: "active", message: "Student restored." };
  }
  return restoreProductionStudent(schoolId, studentId);
}

export async function exportStudents(schoolId: number, search: string, status?: string) {
  if (isDemo()) {
    return mockStudents
      .filter(s => s.schoolId === schoolId && (!search || `${s.fullName} ${s.admissionNo}`.toLowerCase().includes(search)) && (!status || s.status === status))
      .map(s => ({ admissionNo: s.admissionNo, fullName: s.fullName, gender: s.gender, status: s.status, className: s.className, sectionName: s.sectionName }));
  }
  return exportProductionStudents(schoolId, search, status);
}

export async function checkDuplicate(schoolId: number, admissionNo: string, excludeStudentId?: number) {
  if (isDemo()) {
    const existing = mockStudents.find(s => s.schoolId === schoolId && s.admissionNo.toLowerCase() === admissionNo.toLowerCase() && (!excludeStudentId || s.id !== excludeStudentId));
    return existing ? { id: existing.id, fullName: existing.fullName, admissionNo: existing.admissionNo } : null;
  }
  return checkDuplicateAdmission(schoolId, admissionNo, excludeStudentId);
}

export async function bulkPromoteStudents(schoolId: number, studentIds: number[], targetClass: string, targetSection: string | undefined, userId: number) {
  if (isDemo()) return { promoted: studentIds.length, studentIds };
  return bulkPromoteProductionStudents(schoolId, studentIds, targetClass, targetSection, userId);
}

export async function bulkAssignStudents(schoolId: number, studentIds: number[], assignType: "class" | "section", value: string, userId: number) {
  if (isDemo()) return { assigned: studentIds.length, studentIds };
  return bulkAssignProductionStudents(schoolId, studentIds, assignType, value, userId);
}

export async function getStudentTimeline(schoolId: number, studentId: number) {
  if (isDemo()) {
    return [{ id: 1, actionName: "Student admitted", metadataJson: "{}", createdAt: new Date().toISOString(), actorName: "System" }];
  }
  return getProductionStudentTimeline(schoolId, studentId);
}

export async function getStudentMedical(schoolId: number, studentId: number) {
  if (isDemo()) return null;
  return getProductionStudentMedical(schoolId, studentId);
}

export async function upsertStudentMedical(schoolId: number, studentId: number, data: any) {
  if (isDemo()) return { ...data, studentId, schoolId };
  return upsertProductionStudentMedical(schoolId, studentId, data);
}

export async function getStudentNotes(schoolId: number, studentId: number, noteType?: string) {
  if (isDemo()) return [];
  return getProductionStudentNotes(schoolId, studentId, noteType);
}

export async function createStudentNote(schoolId: number, studentId: number, userId: number, data: { noteType: string; title: string; content: string }) {
  if (isDemo()) return { id: 1, ...data, createdBy: userId, createdAt: new Date().toISOString() };
  return createProductionStudentNote(schoolId, studentId, userId, data);
}

export async function deleteStudentNote(schoolId: number, noteId: number) {
  if (isDemo()) return;
  return deleteProductionStudentNote(schoolId, noteId);
}

// ─── Academic Setup ──────────────────────────────────────────────────────

export async function getAcademicSetup(schoolId: number) {
  if (isDemo()) {
    return {
      academicYears: ["2026–27", "2025–26", "2024–25"],
      boards: ["CBSE", "STATE", "ICSE"],
      classes: ["Pre-K", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"],
    };
  }
  return getProductionAcademicSetup(schoolId);
}

// ─── Imports ─────────────────────────────────────────────────────────────

export async function listImportBatches(schoolId: number) {
  if (isDemo()) {
    return mockBatches.filter(b => b.school_id === schoolId).map((b: any) => ({ ...b, rows: undefined }));
  }
  return listBatches(schoolId);
}

export async function getImportBatch(schoolId: number, batchId: string) {
  if (isDemo()) {
    return mockBatches.find(b => b.id === batchId && b.school_id === schoolId) || null;
  }
  return getBatch(schoolId, batchId);
}

export async function createImportBatch(schoolId: number, payload: { context: { schoolId: number; userId: number }; sourceType: "excel" | "csv" | "legacy"; filename: string; rows: any[] }) {
  if (isDemo()) {
    const valid = payload.rows.filter((r: any) => r.status === "valid").length;
    const error = payload.rows.filter((r: any) => r.status === "error").length;
    const duplicate = payload.rows.filter((r: any) => r.status === "duplicate").length;
    const batch = {
      id: String(Date.now()), school_id: schoolId,
      sourceType: payload.sourceType, filename: payload.filename, status: "ready",
      total_rows: payload.rows.length, valid_rows: valid, error_rows: error, duplicate_rows: duplicate,
      createdAt: new Date().toISOString(),
      rows: payload.rows.map((r: any) => ({ id: Math.random().toString(), sourceRowNumber: r.rowNumber, status: r.status, errors: r.errors, normalized: r.normalized }))
    };
    mockBatches.push(batch);
    return batch;
  }
  const { stageBatch } = await import("./modules/imports/importService.js");
  return stageBatch(payload.context, payload.sourceType, payload.filename, payload.rows);
}

export async function approveImport(schoolId: number, userId: number, batchId: string) {
  if (isDemo()) {
    const batch = mockBatches.find(b => b.id === batchId && b.school_id === schoolId);
    if (!batch) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
    batch.status = "completed";
    return batch;
  }
  return approveBatch({ schoolId, userId }, batchId);
}

export async function rejectImport(schoolId: number, userId: number, batchId: string) {
  if (isDemo()) {
    const batch = mockBatches.find(b => b.id === batchId && b.school_id === schoolId);
    if (!batch) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
    batch.status = "rejected";
    return batch;
  }
  const { rejectBatch } = await import("./modules/imports/importService.js");
  return rejectBatch({ schoolId, userId }, batchId);
}

export async function rollbackImport(schoolId: number, userId: number, batchId: string) {
  if (isDemo()) {
    const batch = mockBatches.find(b => b.id === batchId && b.school_id === schoolId);
    if (!batch) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
    batch.status = "rolled_back";
    return batch;
  }
  const { rollbackBatch } = await import("./modules/imports/importService.js");
  return rollbackBatch({ schoolId, userId }, batchId);
}

export async function cancelImport(schoolId: number, userId: number, batchId: string) {
  if (isDemo()) {
    const batch = mockBatches.find(b => b.id === batchId && b.school_id === schoolId);
    if (!batch) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
    batch.status = "cancelled";
    return batch;
  }
  const { cancelBatch } = await import("./modules/imports/importService.js");
  return cancelBatch({ schoolId, userId }, batchId);
}

export async function getImportHistory(schoolId: number) {
  if (isDemo()) {
    return mockBatches.filter(b => b.school_id === schoolId).map((b: any) => ({
      id: b.id, sourceType: b.sourceType, filename: b.filename, status: b.status,
      totalRows: b.total_rows, validRows: b.valid_rows, errorRows: b.error_rows,
      duplicateRows: b.duplicate_rows, importedRows: b.imported_rows,
      createdAt: b.createdAt, completedAt: null, cancelledAt: null
    }));
  }
  const { getImportHistory: getHistory } = await import("./modules/imports/importService.js");
  return getHistory(schoolId);
}

export async function getImportProgress(schoolId: number, batchId: string) {
  if (isDemo()) {
    const batch = mockBatches.find(b => b.id === batchId && b.school_id === schoolId);
    if (!batch) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
    return { id: batch.id, status: batch.status, totalRows: batch.total_rows, processedRows: 0, importedRows: batch.imported_rows, errorRows: batch.error_rows, lastProcessedRow: 0, percentage: 0 };
  }
  const { getImportProgress: getProgress } = await import("./modules/imports/importService.js");
  return getProgress(schoolId, batchId);
}

export async function resumeImport(schoolId: number, userId: number, batchId: string) {
  if (isDemo()) {
    const batch = mockBatches.find(b => b.id === batchId && b.school_id === schoolId);
    if (!batch) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
    batch.status = "completed";
    return batch;
  }
  const { approveBatch } = await import("./modules/imports/importService.js");
  return approveBatch({ schoolId, userId }, batchId);
}

export async function getExistingAdmissionNumbers(schoolId: number): Promise<Set<string>> {
  if (isDemo()) return new Set(mockStudents.filter(s => s.schoolId === schoolId).map(s => s.admissionNo));
  return existingAdmissionNumbers(schoolId);
}

export async function getImportErrors(batchId: string) {
  if (isDemo()) return [];
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT source_row_number, errors_json, raw_json FROM v2_import_rows WHERE batch_id = ? AND row_status IN ('error', 'duplicate') ORDER BY source_row_number",
    [batchId]
  );
  return rows;
}

// ─── Accounts & Fees (mock data) ────────────────────────────────────────

const MOCK_FEE_CATEGORIES = [
  { id: 1, name: "Tuition Fee", description: "Monthly tuition fee", active: true },
  { id: 2, name: "Transport Fee", description: "Bus transport charges", active: true },
  { id: 3, name: "Library Fee", description: "Annual library fee", active: true },
  { id: 4, name: "Lab Fee", description: "Science lab charges", active: true },
  { id: 5, name: "Exam Fee", description: "Examination fee", active: true },
  { id: 6, name: "Development Fee", description: "School development fund", active: true },
];

const MOCK_FEE_STRUCTURES: { id: number; year: string; className: string; categoryName: string; amount: number; dueDate?: string }[] = [
  { id: 1, year: "2026–27", className: "V", categoryName: "Tuition Fee", amount: 8500, dueDate: "2026-04-15" },
  { id: 2, year: "2026–27", className: "V", categoryName: "Transport Fee", amount: 2500, dueDate: "2026-04-15" },
  { id: 3, year: "2026–27", className: "V", categoryName: "Library Fee", amount: 1200, dueDate: "2026-04-15" },
  { id: 4, year: "2026–27", className: "IV", categoryName: "Tuition Fee", amount: 7800, dueDate: "2026-04-15" },
  { id: 5, year: "2026–27", className: "IV", categoryName: "Transport Fee", amount: 2500, dueDate: "2026-04-15" },
  { id: 6, year: "2026–27", className: "VI", categoryName: "Tuition Fee", amount: 9200, dueDate: "2026-04-15" },
  { id: 7, year: "2026–27", className: "VI", categoryName: "Lab Fee", amount: 1800, dueDate: "2026-04-15" },
];

let mockFeePaymentSeq = 100;
const MOCK_FEE_PAYMENTS: any[] = [];

const MOCK_CASHBOOK: any[] = [
  { id: 1, entryType: "income", category: "Fee Collection", description: "Tuition fee from Class V students", amount: 42500, paymentMode: "cash", referenceNumber: null, recordedByName: "Office Staff", createdAt: "2026-07-01T09:30:00Z" },
  { id: 2, entryType: "income", category: "Fee Collection", description: "Transport fee collection", amount: 15000, paymentMode: "upi", referenceNumber: "UPI-20260701-001", recordedByName: "Office Staff", createdAt: "2026-07-01T10:15:00Z" },
  { id: 3, entryType: "expense", category: "Utilities", description: "Electricity bill payment", amount: 8500, paymentMode: "bank_transfer", referenceNumber: "NEFT-001", recordedByName: "Accountant", createdAt: "2026-07-01T11:00:00Z" },
  { id: 4, entryType: "expense", category: "Maintenance", description: "Plumbing repairs - main building", amount: 3200, paymentMode: "cash", referenceNumber: null, recordedByName: "Office Staff", createdAt: "2026-07-01T14:30:00Z" },
  { id: 5, entryType: "income", category: "Fee Collection", description: "Exam fee from Class VI", amount: 9600, paymentMode: "cash", referenceNumber: null, recordedByName: "Office Staff", createdAt: "2026-07-02T09:00:00Z" },
  { id: 6, entryType: "expense", category: "Supplies", description: "Office stationery purchase", amount: 2800, paymentMode: "upi", referenceNumber: "UPI-20260702-003", recordedByName: "Office Staff", createdAt: "2026-07-02T11:45:00Z" },
  { id: 7, entryType: "income", category: "Other Income", description: "Rent from school ground for private event", amount: 5000, paymentMode: "bank_transfer", referenceNumber: "NEFT-002", recordedByName: "Accountant", createdAt: "2026-07-03T08:30:00Z" },
  { id: 8, entryType: "expense", category: "Salaries", description: "Part-time staff wages", amount: 12000, paymentMode: "cash", referenceNumber: null, recordedByName: "Accountant", createdAt: "2026-07-03T10:00:00Z" },
];
let mockCashbookSeq = MOCK_CASHBOOK.length;

const MOCK_SUPPLIERS = [
  { id: 1, name: "Vidya Books & Stationers", contactPerson: "Ramesh Gupta", phone: "+91 9845123456", email: "ramesh@vidyabooks.in", gstNumber: "29AABCV1234A1Z5", active: true },
  { id: 2, name: "Kurnool Transport Services", contactPerson: "Suresh Reddy", phone: "+91 9876543210", email: "suresh@kts.in", gstNumber: "29AACCK5678B1Z2", active: true },
  { id: 3, name: "Bharat Stationery Mart", contactPerson: "Anil Kumar", phone: "+91 8765432109", email: "anil@bharatmart.in", gstNumber: "29BBBBC9012C1Z8", active: true },
  { id: 4, name: "Greenfield Labs Pvt Ltd", contactPerson: "Priya Nair", phone: "+91 7654321098", email: "priya@greenfieldlabs.in", gstNumber: "29CCCOD3456D1Z1", active: true },
];

const MOCK_SUPPLIER_TRANSACTIONS: Record<number, any[]> = {
  1: [
    { id: 1, type: "purchase", amount: 15000, description: "Notebooks and pens bulk order", referenceNumber: "PO-001", transactionDate: "2026-06-15", createdAt: "2026-06-15T10:00:00Z" },
    { id: 2, type: "payment", amount: 15000, description: "Payment for PO-001", referenceNumber: "PV-2026-00001", transactionDate: "2026-06-20", createdAt: "2026-06-20T14:00:00Z" },
    { id: 3, type: "purchase", amount: 8500, description: "Art supplies for annual day", referenceNumber: "PO-002", transactionDate: "2026-07-01", createdAt: "2026-07-01T09:00:00Z" },
  ],
  2: [
    { id: 4, type: "purchase", amount: 45000, description: "Monthly bus maintenance", referenceNumber: "PO-003", transactionDate: "2026-06-01", createdAt: "2026-06-01T11:00:00Z" },
    { id: 5, type: "payment", amount: 45000, description: "Payment for June bus services", referenceNumber: "PV-2026-00002", transactionDate: "2026-06-05", createdAt: "2026-06-05T10:30:00Z" },
  ],
  3: [
    { id: 6, type: "purchase", amount: 12000, description: "Printer cartridges and paper", referenceNumber: "PO-004", transactionDate: "2026-07-02", createdAt: "2026-07-02T15:00:00Z" },
  ],
  4: [
    { id: 7, type: "purchase", amount: 35000, description: "Chemicals and glassware for science lab", referenceNumber: "PO-005", transactionDate: "2026-06-20", createdAt: "2026-06-20T09:30:00Z" },
    { id: 8, type: "payment", amount: 35000, description: "Full payment for lab supplies", referenceNumber: "PV-2026-00003", transactionDate: "2026-06-25", createdAt: "2026-06-25T11:00:00Z" },
  ],
};
let mockSupplierTxSeq = 8;

let mockVoucherSeq = 3;
const MOCK_VOUCHERS = [
  { id: 1, type: "payment", number: "PV-2026-00001", date: "2026-06-20", payeeName: "Vidya Books & Stationers", amount: 15000, description: "Payment for stationery order PO-001", paymentMode: "bank_transfer", status: "approved", createdByName: "Accountant", createdAt: "2026-06-20T14:00:00Z" },
  { id: 2, type: "payment", number: "PV-2026-00002", date: "2026-06-05", payeeName: "Kurnool Transport Services", amount: 45000, description: "June bus services payment", paymentMode: "bank_transfer", status: "approved", createdByName: "Accountant", createdAt: "2026-06-05T10:30:00Z" },
  { id: 3, type: "receipt", number: "RV-2026-00001", date: "2026-07-01", payeeName: "School Ground Rent", amount: 5000, description: "Rent from school ground for private event", paymentMode: "bank_transfer", status: "approved", createdByName: "Accountant", createdAt: "2026-07-01T08:30:00Z" },
];

// ─── Events (mock data) ─────────────────────────────────────────────────

const MOCK_EVENTS: { id: number; title: string; description: string; type: string; startDate: string; endDate?: string; location: string; status: string; createdByName: string; participantCount: number; mediaCount: number }[] = [
  { id: 1, title: "Annual Day Celebration", description: "School annual day with cultural performances by students of all classes.", type: "cultural", startDate: "2026-12-15T09:00:00Z", endDate: "2026-12-15T17:00:00Z", location: "School Auditorium", status: "published", createdByName: "Principal", participantCount: 0, mediaCount: 0 },
  { id: 2, title: "Inter-School Cricket Tournament", description: "Cricket tournament with 8 participating schools from the district.", type: "sports", startDate: "2026-11-20T08:00:00Z", endDate: "2026-11-22T17:00:00Z", location: "School Playground", status: "published", createdByName: "Sports Teacher", participantCount: 0, mediaCount: 0 },
  { id: 3, title: "Science Exhibition", description: "Student science projects exhibition for parents and judges.", type: "academic", startDate: "2026-10-05T10:00:00Z", endDate: "2026-10-05T16:00:00Z", location: "Science Block", status: "completed", createdByName: "Science Teacher", participantCount: 0, mediaCount: 0 },
  { id: 4, title: "Teachers' Day Celebration", description: "Special assembly and cultural program organized by students for teachers.", type: "cultural", startDate: "2026-09-05T09:00:00Z", endDate: "2026-09-05T13:00:00Z", location: "Main Hall", status: "completed", createdByName: "Student Council", participantCount: 0, mediaCount: 0 },
  { id: 5, title: "Independence Day Flag Hoisting", description: "Flag hoisting ceremony followed by patriotic performances.", type: "general", startDate: "2026-08-15T07:30:00Z", endDate: "2026-08-15T10:00:00Z", location: "School Ground", status: "draft", createdByName: "Principal", participantCount: 0, mediaCount: 0 },
  { id: 6, title: "Mathematics Olympiad Training", description: "Special training camp for selected students for the state-level Olympiad.", type: "academic", startDate: "2026-07-10T14:00:00Z", endDate: "2026-07-12T16:00:00Z", location: "Room 204", status: "ongoing", createdByName: "Math Teacher", participantCount: 0, mediaCount: 0 },
];

const MOCK_EVENT_PARTICIPANTS: Record<number, any[]> = {
  1: [
    { id: 1, studentId: 101, studentName: "Arjun Sharma", admissionNo: "MEM-2024-001", role: "Performer", attendance: "present", certificateIssued: false },
    { id: 2, studentId: 102, studentName: "Priya Patel", admissionNo: "MEM-2024-002", role: "Dancer", attendance: "present", certificateIssued: false },
    { id: 3, studentId: 103, studentName: "Ravi Kumar", admissionNo: "MEM-2024-003", role: "Singer", attendance: "absent", certificateIssued: false },
  ],
  3: [
    { id: 4, studentId: 201, studentName: "Sneha Reddy", admissionNo: "MEM-2024-010", role: "Presenter", attendance: "present", certificateIssued: true },
    { id: 5, studentId: 202, studentName: "Vikram Singh", admissionNo: "MEM-2024-011", role: "Presenter", attendance: "present", certificateIssued: true },
  ],
};

const MOCK_EVENT_MEDIA: Record<number, any[]> = {
  3: [
    { id: 1, mediaType: "photo", filename: "science_expo_entrance.jpg", fileSize: 2450000, mimeType: "image/jpeg", caption: "Exhibition entrance", createdAt: "2026-10-05T10:15:00Z" },
    { id: 2, mediaType: "photo", filename: "robot_project.jpg", fileSize: 1800000, mimeType: "image/jpeg", caption: "Robotics project display", createdAt: "2026-10-05T11:00:00Z" },
    { id: 3, mediaType: "video", filename: "judge_feedback.mp4", fileSize: 45000000, mimeType: "video/mp4", caption: "Judge feedback session", createdAt: "2026-10-05T15:30:00Z" },
  ],
  4: [
    { id: 4, mediaType: "photo", filename: "teachers_day_group.jpg", fileSize: 3200000, mimeType: "image/jpeg", caption: "Group photo", createdAt: "2026-09-05T12:00:00Z" },
    { id: 5, mediaType: "photo", filename: "student_performance.jpg", fileSize: 2100000, mimeType: "image/jpeg", caption: "Student cultural performance", createdAt: "2026-09-05T11:30:00Z" },
  ],
};
let mockEventMediaSeq = 5;
let mockEventParticipantSeq = 5;

const MOCK_EVENT_FOLDERS: Record<number, any[]> = {
  1: [
    { id: 1, name: "Photos", folderType: "photos", parentId: null },
    { id: 2, name: "Videos", folderType: "videos", parentId: null },
    { id: 3, name: "Invitations", folderType: "invitations", parentId: null },
    { id: 4, name: "Reports", folderType: "reports", parentId: null },
    { id: 5, name: "Chief Guest", folderType: "other", parentId: null },
    { id: 6, name: "Certificates", folderType: "certificates", parentId: null },
    { id: 7, name: "Budget", folderType: "budget", parentId: null },
  ],
};
let mockEventFolderSeq = 7;

const MOCK_EVENT_BUDGETS: Record<number, any[]> = {
  1: [
    { id: 1, category: "Venue", description: "Auditorium rental", amount: 25000, expenseType: "planned", createdByName: "Principal", createdAt: "2026-06-01T10:00:00Z" },
    { id: 2, category: "Decoration", description: "Stage and hall decoration", amount: 15000, expenseType: "planned", createdByName: "Principal", createdAt: "2026-06-01T10:05:00Z" },
    { id: 3, category: "Sound System", description: "Audio equipment rental", amount: 8000, expenseType: "actual", createdByName: "Accountant", createdAt: "2026-12-14T09:00:00Z" },
    { id: 4, category: "Food", description: "Refreshments for guests", amount: 12000, expenseType: "actual", createdByName: "Accountant", createdAt: "2026-12-15T12:00:00Z" },
  ],
};
let mockEventBudgetSeq = 4;

// ─── Accounts Repository Functions ──────────────────────────────────────

export async function listFeeCategories(schoolId: number) {
  if (isDemo()) return MOCK_FEE_CATEGORIES;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, description, is_active active FROM v2_fee_categories WHERE school_id = ? ORDER BY name",
    [schoolId]
  );
  return rows;
}

export async function createFeeCategory(schoolId: number, name: string, description?: string) {
  if (isDemo()) {
    const id = Math.max(...MOCK_FEE_CATEGORIES.map(c => c.id), 0) + 1;
    MOCK_FEE_CATEGORIES.push({ id, name, description: description || "", active: true });
    return id;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    "INSERT INTO v2_fee_categories (school_id, name, description) VALUES (?, ?, ?)",
    [schoolId, name, description || null]
  );
  return (result as any).insertId;
}

export async function listFeeStructures(schoolId: number, year?: string, className?: string) {
  if (isDemo()) {
    return MOCK_FEE_STRUCTURES.filter(s =>
      (!year || s.year === year) && (!className || s.className === className)
    );
  }
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
  if (isDemo()) {
    const id = Math.max(...MOCK_FEE_STRUCTURES.map(s => s.id), 0) + 1;
    const cat = MOCK_FEE_CATEGORIES.find(c => c.id === data.feeCategoryId);
    MOCK_FEE_STRUCTURES.push({ id, year: data.academicYear, className: data.className, categoryName: cat?.name || "Fee", amount: data.amount, dueDate: data.dueDate || undefined });
    return id;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    "INSERT INTO v2_fee_structures (school_id, academic_year, class_name, fee_category_id, amount, due_date) VALUES (?, ?, ?, ?, ?, ?)",
    [schoolId, data.academicYear, data.className, data.feeCategoryId, data.amount, data.dueDate || null]
  );
  return (result as any).insertId;
}

export async function listFeePayments(schoolId: number, studentId?: number, year?: string) {
  if (isDemo()) {
    return MOCK_FEE_PAYMENTS.filter(p =>
      (!studentId || p.studentId === studentId) && (!year || p.academicYear === year)
    );
  }
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
  if (isDemo()) {
    mockFeePaymentSeq++;
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(mockFeePaymentSeq).padStart(5, "0")}`;
    const cat = MOCK_FEE_CATEGORIES.find(c => c.id === data.feeCategoryId);
    MOCK_FEE_PAYMENTS.unshift({
      id: mockFeePaymentSeq, studentId: data.studentId, studentName: `Student #${data.studentId}`,
      categoryName: cat?.name || "Fee", amount: data.amount, paymentMode: data.paymentMode,
      paymentDate: data.paymentDate, receiptNumber, referenceNumber: data.referenceNumber || null,
      notes: data.notes || null, recordedByName: "Admin User", createdAt: new Date().toISOString(), academicYear: data.academicYear,
    });
    return { id: mockFeePaymentSeq, receiptNumber };
  }
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
  if (isDemo()) {
    return {
      summary: [
        { categoryName: "Tuition Fee", total: 8500, paid: 4250, concession: 0, pending: 4250 },
        { categoryName: "Transport Fee", total: 2500, paid: 2500, concession: 0, pending: 0 },
        { categoryName: "Library Fee", total: 1200, paid: 0, concession: 0, pending: 1200 },
      ],
      totalPending: 5450, academicYear: year,
    };
  }
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
  if (isDemo()) {
    return MOCK_CASHBOOK.filter(e => e.createdAt.startsWith(date));
  }
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
  if (isDemo()) {
    mockCashbookSeq++;
    MOCK_CASHBOOK.push({
      id: mockCashbookSeq, entryType: data.entryType, category: data.category,
      description: data.description, amount: data.amount, paymentMode: data.paymentMode,
      referenceNumber: data.referenceNumber || null, recordedByName: "Admin User",
      createdAt: new Date().toISOString(),
    });
    return mockCashbookSeq;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_daily_cashbook (school_id, entry_date, entry_type, category, description, amount, payment_mode, reference_number, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.entryDate, data.entryType, data.category, data.description,
     data.amount, data.paymentMode, data.referenceNumber || null, userId]
  );
  return (result as any).insertId;
}

export async function getAccountsDashboard(schoolId: number) {
  if (isDemo()) {
  const today = new Date().toISOString().split("T")[0] || "";
    const todayEntries = MOCK_CASHBOOK.filter(e => e.createdAt.startsWith(today));
    const todayIncome = todayEntries.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
    const todayExpenses = todayEntries.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0);
    const totalIncome = MOCK_CASHBOOK.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
    const totalExpenses = MOCK_CASHBOOK.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0);
    const pendingFees = MOCK_FEE_PAYMENTS.length === 0 ? 54500 : 0;
    const totalStudents = 245;
    const collectedStudents = 189;
    const defaultersCount = 56;
    const outstandingSuppliers = MOCK_SUPPLIER_TRANSACTIONS[3]
      ? MOCK_SUPPLIER_TRANSACTIONS[3].filter((t: any) => t.type === "purchase").reduce((s: number, t: any) => s + t.amount, 0) -
        MOCK_SUPPLIER_TRANSACTIONS[3].filter((t: any) => t.type === "payment").reduce((s: number, t: any) => s + t.amount, 0)
      : 0;
    return {
      todayCollection: todayIncome, todayExpenses,
      openingBalance: 50000, closingBalance: 50000 + totalIncome - totalExpenses,
      pendingFees, totalStudents, collectedStudents, defaultersCount,
      totalIncome, totalExpenses, cashFlow: totalIncome - totalExpenses,
      outstandingSuppliers,
    };
  }
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
  if (isDemo()) {
    return MOCK_CASHBOOK.filter(e => e.paymentMode === "bank_transfer").map(e => ({
      id: e.id, date: e.createdAt, type: e.entryType, category: e.category,
      description: e.description, amount: e.amount, referenceNumber: e.referenceNumber,
      recordedByName: e.recordedByName,
    }));
  }
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
  if (isDemo()) return MOCK_SUPPLIERS;
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
  if (isDemo()) {
    const id = Math.max(...MOCK_SUPPLIERS.map(s => s.id), 0) + 1;
    MOCK_SUPPLIERS.push({ id, name: data.name, contactPerson: data.contactPerson || "", phone: data.phone || "", email: data.email || "", gstNumber: data.gstNumber || "", active: true });
    return id;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_suppliers (school_id, name, contact_person, phone, email, gst_number, bank_account_number, bank_ifsc, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.name, data.contactPerson || null, data.phone || null, data.email || null,
     data.gstNumber || null, data.bankAccountNumber || null, data.bankIfsc || null, data.address || null]
  );
  return (result as any).insertId;
}

export async function listSupplierTransactions(schoolId: number, supplierId: number) {
  if (isDemo()) return MOCK_SUPPLIER_TRANSACTIONS[supplierId] || [];
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
  if (isDemo()) {
    mockSupplierTxSeq++;
    const tx = { id: mockSupplierTxSeq, type: data.transactionType, amount: data.amount, description: data.description || "", referenceNumber: data.referenceNumber || "", transactionDate: data.transactionDate, createdAt: new Date().toISOString() };
    if (!MOCK_SUPPLIER_TRANSACTIONS[supplierId]) MOCK_SUPPLIER_TRANSACTIONS[supplierId] = [];
    MOCK_SUPPLIER_TRANSACTIONS[supplierId].push(tx);
    return mockSupplierTxSeq;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_supplier_transactions (school_id, supplier_id, transaction_type, amount, description, reference_number, transaction_date, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, supplierId, data.transactionType, data.amount, data.description || null,
     data.referenceNumber || null, data.transactionDate, userId]
  );
  return (result as any).insertId;
}

export async function listVouchers(schoolId: number, type?: string) {
  if (isDemo()) {
    return MOCK_VOUCHERS.filter(v => !type || v.type === type);
  }
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
  if (isDemo()) {
    mockVoucherSeq++;
    const prefix = data.voucherType === "payment" ? "PV" : data.voucherType === "receipt" ? "RV" : data.voucherType === "journal" ? "JV" : "EV";
    const voucherNumber = `${prefix}-${new Date().getFullYear()}-${String(mockVoucherSeq).padStart(5, "0")}`;
    MOCK_VOUCHERS.unshift({
      id: mockVoucherSeq, type: data.voucherType, number: voucherNumber, date: data.voucherDate,
      payeeName: data.payeeName || "", amount: data.amount, description: data.description || "",
      paymentMode: data.paymentMode || "cash", status: "approved", createdByName: "Admin User", createdAt: new Date().toISOString(),
    });
    return { id: mockVoucherSeq, voucherNumber };
  }
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
  if (isDemo()) {
    const dayPayments = MOCK_FEE_PAYMENTS.filter(p => p.paymentDate === date);
    const total = dayPayments.reduce((s, p) => s + p.amount, 0);
    return { date, categories: [{ categoryName: "Tuition Fee", transactionCount: dayPayments.length, totalCollected: total }], totalCollected: total };
  }
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
  if (isDemo()) {
    return [
      { id: 301, studentName: "Amit Verma", admissionNo: "MEM-2024-031", className: "V", totalFee: 12200, paid: 5000, pending: 7200 },
      { id: 302, studentName: "Deepika Nair", admissionNo: "MEM-2024-042", className: "IV", totalFee: 10300, paid: 3000, pending: 7300 },
      { id: 303, studentName: "Karthik Menon", admissionNo: "MEM-2024-055", className: "VI", totalFee: 11000, paid: 2000, pending: 9000 },
      { id: 304, studentName: "Lakshmi Devi", admissionNo: "MEM-2024-068", className: "V", totalFee: 12200, paid: 8000, pending: 4200 },
      { id: 305, studentName: "Mohammed Ali", admissionNo: "MEM-2024-072", className: "III", totalFee: 9800, paid: 4000, pending: 5800 },
    ];
  }
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
  if (isDemo()) {
    return { month, total: 185000, byCategory: [{ name: "Tuition Fee", amount: 127500 }, { name: "Transport Fee", amount: 37500 }, { name: "Lab Fee", amount: 20000 }], byMode: [{ mode: "cash", amount: 95000 }, { mode: "upi", amount: 55000 }, { mode: "bank_transfer", amount: 35000 }] };
  }
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
  if (isDemo()) {
    return { month, total: 26500, byCategory: [{ name: "Utilities", amount: 8500 }, { name: "Maintenance", amount: 3200 }, { name: "Supplies", amount: 2800 }, { name: "Salaries", amount: 12000 }], byMode: [{ mode: "cash", amount: 15200 }, { mode: "bank_transfer", amount: 8500 }, { mode: "upi", amount: 2800 }] };
  }
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

let mockConcessionSeq = 1000;
const MOCK_CONCESSIONS: any[] = [
  { id: 1001, studentId: 301, studentName: "Amit Verma", admissionNo: "MEM-2024-031", className: "V",
    categoryName: "Tuition Fee", amount: 2000, reason: "Sibling discount — two children enrolled",
    status: "approved", academicYear: "2026–27", approvedByName: "Principal", createdAt: "2026-06-15T10:00:00Z" },
  { id: 1002, studentId: 302, studentName: "Deepika Nair", admissionNo: "MEM-2024-042", className: "IV",
    categoryName: "Transport Fee", amount: 1000, reason: "Financial hardship — single parent",
    status: "pending", academicYear: "2026–27", approvedByName: null, createdAt: "2026-06-20T14:00:00Z" },
];

export async function listConcessions(schoolId: number, studentId?: number, year?: string) {
  if (isDemo()) {
    return MOCK_CONCESSIONS.filter(c => (!studentId || c.studentId === studentId) && (!year || c.academicYear === year));
  }
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
  if (isDemo()) {
    mockConcessionSeq++;
    const student = MOCK_CONCESSIONS[0] || {};
    MOCK_CONCESSIONS.unshift({
      id: mockConcessionSeq, studentId: data.studentId, studentName: `Student #${data.studentId}`,
      admissionNo: `MEM-2024-${String(data.studentId).padStart(3, "0")}`, className: "V",
      categoryName: "Fee", amount: data.amount, reason: data.reason,
      status: "pending", academicYear: data.academicYear, approvedByName: null, createdAt: new Date().toISOString(),
    });
    return mockConcessionSeq;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_fee_concessions (school_id, student_id, fee_category_id, academic_year, amount, reason, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [schoolId, data.studentId, data.feeCategoryId, data.academicYear, data.amount, data.reason, userId]
  );
  return (result as any).insertId;
}

export async function approveConcession(schoolId: number, userId: number, concessionId: number) {
  if (isDemo()) {
    const c = MOCK_CONCESSIONS.find(x => x.id === concessionId);
    if (c) { c.status = "approved"; c.approvedByName = "Admin User"; }
    return true;
  }
  await getPool().execute(
    "UPDATE v2_fee_concessions SET status = 'approved', approved_by = ? WHERE id = ? AND school_id = ?",
    [userId, concessionId, schoolId]
  );
  return true;
}

export async function rejectConcession(schoolId: number, userId: number, concessionId: number) {
  if (isDemo()) {
    const c = MOCK_CONCESSIONS.find(x => x.id === concessionId);
    if (c) { c.status = "rejected"; c.approvedByName = "Admin User"; }
    return true;
  }
  await getPool().execute(
    "UPDATE v2_fee_concessions SET status = 'rejected', approved_by = ? WHERE id = ? AND school_id = ?",
    [userId, concessionId, schoolId]
  );
  return true;
}

// ─── Cash Flow & Financial Reports ──────────────────────────────────────

export async function getCashFlowReport(schoolId: number, startDate: string, endDate: string) {
  if (isDemo()) {
    const income = MOCK_CASHBOOK.filter(e => e.entryType === "income").reduce((s, e) => s + e.amount, 0);
    const expenses = MOCK_CASHBOOK.filter(e => e.entryType === "expense").reduce((s, e) => s + e.amount, 0);
    return {
      startDate, endDate, totalIncome: income, totalExpenses: expenses,
      netCashFlow: income - expenses,
      incomeByCategory: [{ category: "Fee Collection", amount: 67100 }, { category: "Other Income", amount: 5000 }],
      expensesByCategory: [{ category: "Utilities", amount: 8500 }, { category: "Maintenance", amount: 3200 }, { category: "Supplies", amount: 2800 }, { category: "Salaries", amount: 12000 }],
    };
  }
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
  if (isDemo()) {
    return MOCK_SUPPLIERS.map(s => {
      const txs = MOCK_SUPPLIER_TRANSACTIONS[s.id] || [];
      const purchases = txs.filter((t: any) => t.type === "purchase").reduce((sum: number, t: any) => sum + t.amount, 0);
      const payments = txs.filter((t: any) => t.type === "payment").reduce((sum: number, t: any) => sum + t.amount, 0);
      return { supplierId: s.id, name: s.name, purchases, payments, outstanding: purchases - payments };
    }).filter((s: any) => s.outstanding > 0);
  }
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
  if (isDemo()) {
    return true;
  }
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
  if (isDemo()) {
    return [
      { id: 1, entityType: "fee_payment", entityId: 100, action: "fee.collect", userName: "Office Staff", metadata: '{"receipt":"REC-2026-00100","amount":8500}', createdAt: "2026-07-01T09:30:00Z" },
      { id: 2, entityType: "cashbook", entityId: 1, action: "cashbook.add", userName: "Accountant", metadata: '{"category":"Utilities","amount":8500}', createdAt: "2026-07-01T11:00:00Z" },
      { id: 3, entityType: "voucher", entityId: 3, action: "voucher.create", userName: "Accountant", metadata: '{"number":"RV-2026-00001","amount":5000}', createdAt: "2026-07-01T08:30:00Z" },
    ];
  }
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
  if (isDemo()) {
    const q = query.toLowerCase();
    const results: { type: string; id: number; title: string; subtitle: string; module: string }[] = [];
    for (const s of mockStudents) {
      if (s.schoolId === schoolId && (s.fullName.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q))) {
        results.push({ type: "student", id: s.id, title: s.fullName, subtitle: `${s.admissionNo} · ${s.className}`, module: "students" });
      }
    }
    for (const e of MOCK_EVENTS) {
      if (e.title.toLowerCase().includes(q)) {
        results.push({ type: "event", id: e.id, title: e.title, subtitle: `${e.type} · ${e.startDate.split("T")[0]}`, module: "events" });
      }
    }
    for (const s of MOCK_SUPPLIERS) {
      if (s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q)) {
        results.push({ type: "supplier", id: s.id, title: s.name, subtitle: s.contactPerson, module: "fees" });
      }
    }
    return results.slice(0, 20);
  }
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
  if (isDemo()) {
    return {
      unreadCount: 3,
      notifications: [
        { id: 1, title: "New admission created", message: "A new student was admitted to Class V", type: "info", read: false, createdAt: new Date(Date.now() - 3600000).toISOString(), module: "students", entityId: null },
        { id: 2, title: "Certificate pending approval", message: "Transfer certificate request requires approval", type: "warning", read: false, createdAt: new Date(Date.now() - 7200000).toISOString(), module: "certificates", entityId: null },
        { id: 3, title: "Fee payment received", message: "₹8,500 tuition fee collected from Class V", type: "success", read: false, createdAt: new Date(Date.now() - 10800000).toISOString(), module: "fees", entityId: null },
      ],
    };
  }
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
  if (isDemo()) return true;
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
  if (isDemo()) return;
  await getPool().execute(
    `INSERT INTO v2_notifications (school_id, user_id, title, message, notification_type, module_name, entity_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, data.userId, data.title, data.message, data.type, data.module || null, data.entityId || null]
  );
}

// ─── Dashboard Extended (role-based) ────────────────────────────────────

export async function getDashboardExtended(schoolId: number, role: string) {
  if (isDemo()) {
    const base = {
      totalStudents: 1842, activeStudents: 1783,
      pendingCertificates: 4, unpaidFees: 23,
      draftEvents: 2, feesCollectedToday: 42500,
      recentActivity: [
        { id: 1, action: "Student admitted", detail: "Arjun Sharma — Class V", time: "8 min ago", module: "students" },
        { id: 2, action: "Certificate requested", detail: "Transfer Certificate for Priya Patel", time: "34 min ago", module: "certificates" },
        { id: 3, action: "Fee collected", detail: "₹8,500 from Ravi Kumar", time: "1 hr ago", module: "fees" },
        { id: 4, action: "Event created", detail: "Science Exhibition — Oct 5", time: "2 hrs ago", module: "events" },
        { id: 5, action: "Document uploaded", detail: "Admission form for Class III batch", time: "3 hrs ago", module: "documents" },
      ],
      pendingTasks: [
        { id: 1, task: "Approve 4 pending certificates", module: "certificates", count: 4 },
        { id: 2, task: "23 students with unpaid fees", module: "fees", count: 23 },
        { id: 3, task: "2 draft events to publish", module: "events", count: 2 },
      ],
    };
    return base;
  }
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
  if (isDemo()) {
    return MOCK_EVENTS.filter(e => (!type || e.type === type) && (!status || e.status === status));
  }
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
  if (isDemo()) {
    const ev = MOCK_EVENTS.find(e => e.id === eventId);
    if (!ev) return null;
    return {
      ...ev,
      participants: MOCK_EVENT_PARTICIPANTS[eventId] || [],
      media: MOCK_EVENT_MEDIA[eventId] || [],
    };
  }
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
  if (isDemo()) {
    const id = Math.max(...MOCK_EVENTS.map(e => e.id), 0) + 1;
    MOCK_EVENTS.unshift({
      id, title: data.title, description: data.description || "", type: data.eventType,
      startDate: data.startDate, endDate: data.endDate || undefined, location: data.location || "",
      status: "published", createdByName: "Admin User", participantCount: 0, mediaCount: 0,
    });
    return id;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_events (school_id, title, description, event_type, start_date, end_date, location, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
    [schoolId, data.title, data.description || null, data.eventType, data.startDate, data.endDate || null, data.location || null, userId]
  );
  return (result as any).insertId;
}

export async function updateEventStatus(schoolId: number, eventId: number, status: string) {
  if (isDemo()) {
    const ev = MOCK_EVENTS.find(e => e.id === eventId);
    if (ev) ev.status = status;
    return;
  }
  await getPool().execute<RowDataPacket[]>(
    "UPDATE v2_events SET status = ? WHERE id = ? AND school_id = ?",
    [status, eventId, schoolId]
  );
}

export async function addEventParticipants(schoolId: number, eventId: number, studentIds: number[], role?: string) {
  if (isDemo()) {
    if (!MOCK_EVENT_PARTICIPANTS[eventId]) MOCK_EVENT_PARTICIPANTS[eventId] = [];
    for (const sid of studentIds) {
      if (!MOCK_EVENT_PARTICIPANTS[eventId].some(p => p.studentId === sid)) {
        mockEventParticipantSeq++;
        MOCK_EVENT_PARTICIPANTS[eventId].push({
          id: mockEventParticipantSeq, studentId: sid, studentName: `Student #${sid}`,
          admissionNo: `MEM-${sid}`, role: role || null, attendance: null, certificateIssued: false,
        });
      }
    }
    return;
  }
  for (const studentId of studentIds) {
    await getPool().execute<RowDataPacket[]>(
      "INSERT IGNORE INTO v2_event_participants (event_id, student_id, role) SELECT ?, ?, ? FROM v2_events WHERE id = ? AND school_id = ?",
      [eventId, studentId, role || null, eventId, schoolId]
    );
  }
}

export async function removeEventParticipant(schoolId: number, eventId: number, studentId: number) {
  if (isDemo()) {
    const participants = MOCK_EVENT_PARTICIPANTS[eventId] || [];
    const idx = participants.findIndex((p: any) => p.studentId === studentId);
    if (idx >= 0) participants.splice(idx, 1);
    return true;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `DELETE ep FROM v2_event_participants ep
     JOIN v2_events e ON e.id = ep.event_id
     WHERE ep.event_id = ? AND ep.student_id = ? AND e.school_id = ?`,
    [eventId, studentId, schoolId]
  );
  return (result as any).affectedRows > 0;
}

export async function updateEventAttendance(schoolId: number, eventId: number, records: { participantId: number; attendance: string }[]) {
  if (isDemo()) {
    const participants = MOCK_EVENT_PARTICIPANTS[eventId] || [];
    for (const r of records) {
      const p = participants.find(x => x.id === r.participantId);
      if (p) p.attendance = r.attendance;
    }
    return;
  }
  for (const record of records) {
    await getPool().execute<RowDataPacket[]>(
      `UPDATE v2_event_participants SET attendance = ? WHERE id = ? AND event_id = ?
       AND event_id IN (SELECT id FROM v2_events WHERE id = ? AND school_id = ?)`,
      [record.attendance, record.participantId, eventId, eventId, schoolId]
    );
  }
}

export async function uploadEventMedia(schoolId: number, eventId: number, userId: number, files: Express.Multer.File[], mediaType: string, caption?: string) {
  if (isDemo()) {
    if (!MOCK_EVENT_MEDIA[eventId]) MOCK_EVENT_MEDIA[eventId] = [];
    for (const file of files) {
      mockEventMediaSeq++;
      MOCK_EVENT_MEDIA[eventId].push({
        id: mockEventMediaSeq, mediaType, filename: file.originalname,
        fileSize: file.size, mimeType: file.mimetype, caption: caption || null,
        createdAt: new Date().toISOString(),
      });
    }
    return files.length;
  }
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
  if (isDemo()) {
    const now = new Date();
    const upcoming = MOCK_EVENTS.filter(e => new Date(e.startDate) > now && e.status !== "cancelled").length;
    const completed = MOCK_EVENTS.filter(e => e.status === "completed").length;
    const drafts = MOCK_EVENTS.filter(e => e.status === "draft").length;
    const totalMedia = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.length, 0);
    const totalPhotos = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.filter(m => m.mediaType === "photo").length, 0);
    const totalVideos = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.filter(m => m.mediaType === "video").length, 0);
    const totalStorageBytes = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.reduce((ss, m) => ss + (m.fileSize || 0), 0), 0);
    const recentUploads = Object.values(MOCK_EVENT_MEDIA).flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
    return { upcoming, completed, drafts, total: MOCK_EVENTS.length, totalMedia, totalPhotos, totalVideos, totalStorageBytes, recentUploads };
  }
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
  if (isDemo()) {
    const years = ["2026–27", "2025–26", "2024–25"];
    return years.map(y => ({
      year: y,
      events: MOCK_EVENTS.filter(e => e.status === "completed").map(e => ({
        ...e, mediaCount: (MOCK_EVENT_MEDIA[e.id] || []).length,
        participantCount: (MOCK_EVENT_PARTICIPANTS[e.id] || []).length,
      })),
    }));
  }
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
  if (isDemo()) {
    const idx = MOCK_EVENTS.findIndex(e => e.id === eventId);
    if (idx >= 0) MOCK_EVENTS.splice(idx, 1);
    delete MOCK_EVENT_PARTICIPANTS[eventId];
    delete MOCK_EVENT_MEDIA[eventId];
    delete MOCK_EVENT_FOLDERS[eventId];
    delete MOCK_EVENT_BUDGETS[eventId];
    return;
  }
  await getPool().execute<RowDataPacket[]>(
    "DELETE FROM v2_events WHERE id = ? AND school_id = ?", [eventId, schoolId]
  );
}

export async function updateEvent(schoolId: number, eventId: number, data: {
  title?: string; description?: string; eventType?: string;
  startDate?: string; endDate?: string; location?: string; academicYear?: string; budget?: number;
}) {
  if (isDemo()) {
    const ev = MOCK_EVENTS.find(e => e.id === eventId);
    if (ev) {
      if (data.title) ev.title = data.title;
      if (data.description !== undefined) ev.description = data.description;
      if (data.eventType) ev.type = data.eventType;
      if (data.startDate) ev.startDate = data.startDate;
      if (data.endDate !== undefined) ev.endDate = data.endDate;
      if (data.location !== undefined) ev.location = data.location;
    }
    return;
  }
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
  if (isDemo()) {
    for (const arr of Object.values(MOCK_EVENT_MEDIA)) {
      const m = arr.find(x => x.id === mediaId);
      if (m) return m;
    }
    return null;
  }
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
  if (isDemo()) {
    for (const eventId of Object.keys(MOCK_EVENT_MEDIA)) {
      const arr = MOCK_EVENT_MEDIA[Number(eventId)];
      if (!arr) continue;
      const idx = arr.findIndex(m => m.id === mediaId);
      if (idx >= 0) { arr.splice(idx, 1); return true; }
    }
    return false;
  }
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
  if (isDemo()) {
    return MOCK_EVENT_FOLDERS[eventId] || [];
  }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT ef.id, ef.name, ef.folder_type folderType, ef.parent_id parentId
     FROM v2_event_folders ef JOIN v2_events e ON e.id = ef.event_id
     WHERE ef.event_id = ? AND e.school_id = ? ORDER BY ef.name`,
    [eventId, schoolId]
  );
  return rows;
}

export async function createEventFolder(schoolId: number, eventId: number, name: string, folderType: string, parentId?: number) {
  if (isDemo()) {
    if (!MOCK_EVENT_FOLDERS[eventId]) MOCK_EVENT_FOLDERS[eventId] = [];
    mockEventFolderSeq++;
    MOCK_EVENT_FOLDERS[eventId].push({ id: mockEventFolderSeq, name, folderType, parentId: parentId || null });
    return mockEventFolderSeq;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_event_folders (event_id, parent_id, name, folder_type)
     SELECT ?, ?, ?, ? FROM v2_events WHERE id = ? AND school_id = ?`,
    [eventId, parentId || null, name, folderType, eventId, schoolId]
  );
  return (result as any).insertId;
}

export async function deleteEventFolder(schoolId: number, folderId: number) {
  if (isDemo()) {
    for (const eventId of Object.keys(MOCK_EVENT_FOLDERS)) {
      const arr = MOCK_EVENT_FOLDERS[Number(eventId)];
      if (!arr) continue;
      const idx = arr.findIndex(f => f.id === folderId);
      if (idx >= 0) { arr.splice(idx, 1); return true; }
    }
    return false;
  }
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
  if (isDemo()) {
    return MOCK_EVENT_BUDGETS[eventId] || [];
  }
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
  if (isDemo()) {
    if (!MOCK_EVENT_BUDGETS[eventId]) MOCK_EVENT_BUDGETS[eventId] = [];
    mockEventBudgetSeq++;
    MOCK_EVENT_BUDGETS[eventId].push({
      id: mockEventBudgetSeq, category: data.category, description: data.description || "",
      amount: data.amount, expenseType: data.expenseType, createdByName: "Admin", createdAt: new Date().toISOString(),
    });
    return mockEventBudgetSeq;
  }
  const [result] = await getPool().execute<RowDataPacket[]>(
    `INSERT INTO v2_event_budgets (event_id, category, description, amount, expense_type, created_by)
     SELECT ?, ?, ?, ?, ?, ? FROM v2_events WHERE id = ? AND school_id = ?`,
    [eventId, data.category, data.description || null, data.amount, data.expenseType, userId, eventId, schoolId]
  );
  return (result as any).insertId;
}

export async function deleteEventBudget(schoolId: number, budgetId: number) {
  if (isDemo()) {
    for (const eventId of Object.keys(MOCK_EVENT_BUDGETS)) {
      const arr = MOCK_EVENT_BUDGETS[Number(eventId)];
      if (!arr) continue;
      const idx = arr.findIndex(b => b.id === budgetId);
      if (idx >= 0) { arr.splice(idx, 1); return true; }
    }
    return false;
  }
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
  if (isDemo()) {
    const totalMedia = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.length, 0);
    const totalPhotos = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.filter(m => m.mediaType === "photo").length, 0);
    const totalVideos = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.filter(m => m.mediaType === "video").length, 0);
    const totalDocuments = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.filter(m => m.mediaType === "document").length, 0);
    const totalStorageBytes = Object.values(MOCK_EVENT_MEDIA).reduce((s, arr) => s + arr.reduce((ss, m) => ss + (m.fileSize || 0), 0), 0);
    const totalParticipants = MOCK_EVENTS.reduce((s, e) => s + (MOCK_EVENT_PARTICIPANTS[e.id]?.length || 0), 0);
    const totalBudgetPlanned = Object.values(MOCK_EVENT_BUDGETS).reduce((s, arr) => s + arr.filter(b => b.expenseType === "planned").reduce((ss, b) => ss + b.amount, 0), 0);
    const totalBudgetActual = Object.values(MOCK_EVENT_BUDGETS).reduce((s, arr) => s + arr.filter(b => b.expenseType === "actual").reduce((ss, b) => ss + b.amount, 0), 0);
    return {
      totalEvents: MOCK_EVENTS.length, totalMedia, totalPhotos, totalVideos, totalDocuments,
      totalStorageBytes, totalParticipants, totalBudgetPlanned, totalBudgetActual,
      byType: EVENT_TYPES.map(t => ({ type: t, count: MOCK_EVENTS.filter(e => e.type === t).length })),
    };
  }
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

const EVENT_TYPES = ["cultural", "sports", "academic", "general", "holiday", "other"];
