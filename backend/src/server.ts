import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer, { MulterError } from "multer";
import { z } from "zod";
import { unlinkSync } from "node:fs";
import path, { extname } from "node:path";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { getConfig } from "./config/env.js";
import { closePool, databaseHealth } from "./database/pool.js";
import { requirePermission, requireRole, rolePermissions } from "./security/permissions.js";
import { verifyAccessToken } from "./security/accessToken.js";
import { resolveSchoolScope } from "./security/schoolScope.js";
import type { AuthRequest } from "./types/auth.js";
import type { RowDataPacket } from "mysql2/promise";
import { parseStudentWorkbook, validateRows } from "./modules/imports/importService.js";
import * as repo from "./repository.js";
import documentRoutes from "./modules/documents/documentRoutes.js";
import certificateRoutes from "./modules/certificates/certificateRoutes.js";
import accountRoutes from "./modules/accounts/accountRoutes.js";
import eventRoutes from "./modules/events/eventRoutes.js";
import reportRoutes from "./modules/reports/reportRoutes.js";
import userRoutes from "./modules/users/userRoutes.js";
import settingRoutes from "./modules/settings/settingRoutes.js";
import { ensureStorageDirectory } from "./storage/storageService.js";

const app = express();
const config = getConfig();
const port = config.PORT;
app.set("trust proxy", config.NODE_ENV === "production" ? 1 : false);

// ─── Brute Force Protection ──────────────────────────────────────────────

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkBruteForce(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 min window
    return true;
  }
  if (record.count >= 5) return false; // 5 attempts max
  record.count++;
  return true;
}

const studentUploadDirectory = ensureStorageDirectory("students");
const studentPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: studentUploadDirectory,
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!accepted.has(file.mimetype)) return callback(new Error("Student photo must be a JPG, PNG or WebP image."));
    callback(null, true);
  }
});
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => {
  const ok = /\.(xlsx|csv)$/i.test(file.originalname);
  if (!ok) return callback(new Error("Upload an .xlsx or .csv file."));
  callback(null, true);
}});

app.use(helmet());
const allowedOrigins = config.FRONTEND_ORIGIN.split(",").map(origin => origin.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Request logging (slow requests only)
app.use((_req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[SLOW] ${_req.method} ${_req.originalUrl} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Rate limiting for all API routes
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-8" });
app.use("/api", apiLimiter);
// Stricter limit for auth endpoints
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8" }));

// ─── Health ──────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ─── Auth Middleware ──────────────────────────────────────────────────────

async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return res.status(401).json({ message: "Authentication required" });
  try {
    const payload = await verifyAccessToken(bearer);
    const homeSchoolId = Number(payload.schoolId);
    const effectiveSchoolId = await resolveSchoolScope({
      role: String(payload.role),
      homeSchoolId,
      requestedSchoolId: req.header("x-school-id"),
      schoolExists: async schoolId => Boolean(await repo.getSchoolById(schoolId)),
    });
    req.auth = {
      userId: Number(payload.sub), schoolId: effectiveSchoolId, homeSchoolId, role: String(payload.role),
      permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) : (rolePermissions[String(payload.role)] || []),
      sessionId: undefined
    };
    next();
  } catch (error) {
    const typedError = error as Error & { statusCode?: number; code?: string };
    const statusCode = Number(typedError.statusCode);
    if (statusCode >= 400 && statusCode < 500) return res.status(statusCode).json({ message: (error as Error).message });
    if (String(typedError.code || "").startsWith("ERR_J")) {
      return res.status(401).json({ message: "Invalid or expired authentication token." });
    }
    next(error);
  }
}

// ─── Health ──────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  try { res.json({ status: "ok", mode: "database", database: await databaseHealth() }); }
  catch { res.status(503).json({ status: "degraded", mode: "database", database: { ok: false } }); }
});

// ─── Auth Routes ─────────────────────────────────────────────────────────

const loginSchema = z.object({ schoolId: z.number().int().nonnegative(), email: z.email(), password: z.string().min(1) });

app.post("/api/auth/login", async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Enter a valid school, email and password." });
  const { schoolId, email, password } = parsed.data;
  const bruteForceKey = `${schoolId}:${email.toLowerCase()}`;
  if (!checkBruteForce(bruteForceKey)) {
    return res.status(429).json({ message: "Too many login attempts. Please try again in 15 minutes." });
  }
  try {
    if (schoolId !== 0 && !(await repo.getSchoolById(schoolId))) {
      return res.status(404).json({ message: "School not found." });
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const result = await repo.authenticateUser(schoolId, email, password, ip, userAgent);
    if (!result) return res.status(401).json({ message: "Incorrect email or password." });
    loginAttempts.delete(bruteForceKey);
    return res.json(result);
  } catch (error) { return next(error); }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("monte_refresh", { path: "/api/auth" });
  res.clearCookie("csrf_token", { path: "/" });
  res.json({ message: "Signed out." });
});

// ─── Schools ─────────────────────────────────────────────────────────────

app.get("/api/schools", async (_req, res, next) => {
  try { res.json({ data: await repo.listSchools() }); }
  catch (error) { next(error); }
});

// ─── Dashboard ───────────────────────────────────────────────────────────

app.get("/api/dashboard", authenticate, requirePermission("dashboard.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getDashboard(req.auth!.schoolId) }); }
  catch (error) { next(error); }
});

app.get("/api/dashboard/extended", authenticate, requirePermission("dashboard.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getDashboardExtended(req.auth!.schoolId, req.auth!.role) }); }
  catch (error) { next(error); }
});

app.get("/api/admin/overview", authenticate, requireRole("group_super_admin"), async (_req, res, next) => {
  try { res.json({ data: await repo.getGroupOverview() }); }
  catch (error) { next(error); }
});

app.get("/api/access-model", authenticate, async (req: AuthRequest, res) => {
  res.json({
    data: {
      role: req.auth!.role,
      scope: req.auth!.role === "group_super_admin" ? "all_schools" : "assigned_school",
      homeSchoolId: req.auth!.homeSchoolId,
      activeSchoolId: req.auth!.schoolId,
      permissions: req.auth!.permissions,
    },
  });
});

// ─── Global Search ───────────────────────────────────────────────────────

app.get("/api/search", authenticate, async (req: AuthRequest, res, next) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) return res.json({ data: [] });
  try { res.json({ data: await repo.globalSearch(req.auth!.schoolId, q) }); }
  catch (error) { next(error); }
});

// ─── Notifications ───────────────────────────────────────────────────────

app.get("/api/notifications", authenticate, async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getNotifications(req.auth!.schoolId, req.auth!.userId) }); }
  catch (error) { next(error); }
});

app.patch("/api/notifications/read", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : undefined;
    await repo.markNotificationsRead(req.auth!.schoolId, req.auth!.userId, ids);
    res.json({ message: "Notifications marked as read." });
  } catch (error) { next(error); }
});

// ─── Students ────────────────────────────────────────────────────────────

app.get("/api/students", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  try {
    const result = await repo.listStudents(req.auth!.schoolId, search, status, limit, offset);
    res.json({ data: result.data, total: result.total, page, limit });
  } catch (error) { next(error); }
});

app.get("/api/students/:id", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const student = await repo.getStudent(req.auth!.schoolId, Number(req.params.id));
    if (!student) return res.status(404).json({ message: "Student not found." });
    res.json({ data: student });
  } catch (error) { next(error); }
});

const optionalText = (maximum = 255) => z.preprocess(value => value === "" ? undefined : value, z.string().trim().max(maximum).optional());
const optionalDate = z.preprocess(value => value === "" ? undefined : value, z.iso.date().optional());
const optionalEmail = z.preprocess(value => value === "" ? undefined : value, z.email().max(190).optional());
const optionalAadhaar = z.preprocess(value => value === "" ? undefined : value, z.string().regex(/^\d{12}$/, "Aadhaar must contain exactly 12 digits.").optional());
const optionalMobile = z.preprocess(value => value === "" ? undefined : value, z.string().regex(/^[0-9+()\s-]{7,20}$/, "Enter a valid mobile number.").optional());

const studentSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  admissionNo: z.string().trim().min(1).max(60),
  academicYear: z.string().trim().min(4).max(20),
  board: z.enum(["CBSE", "STATE", "ICSE"]),
  dateOfAdmission: z.iso.date(),
  classAdmitted: z.string().trim().min(1).max(50),
  sectionName: optionalText(50),
  idNo: optionalText(20),
  previousSchoolClass: optionalText(255),
  previousTcNo: optionalText(50),
  dateOfBirth: z.iso.date(),
  gender: z.preprocess(value => value === "" ? undefined : value, z.enum(["male", "female", "other"]).optional()),
  nationality: optionalText(100),
  motherTongue: optionalText(100),
  religion: optionalText(100),
  caste: optionalText(250),
  subCaste: optionalText(100),
  studentAadhaarNo: optionalAadhaar,
  penNo: optionalText(50),
  apaarId: optionalText(50),
  fatherName: optionalText(200),
  fatherAadhaarNo: optionalAadhaar,
  fatherMobileNumber: optionalMobile,
  fatherEmail: optionalEmail,
  fatherQualification: optionalText(150),
  fatherOccupation: optionalText(150),
  motherName: optionalText(200),
  motherAadhaarNo: optionalAadhaar,
  motherMobileNumber: optionalMobile,
  motherEmail: optionalEmail,
  motherQualification: optionalText(150),
  motherOccupation: optionalText(150),
  motherBankAccountNo: optionalText(30),
  bankIfscCode: z.preprocess(value => value === "" ? undefined : value, z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code.").optional()),
  studentEmail: optionalEmail,
  residenceAddress: z.string().trim().min(5).max(500),
  currentStatus: z.preprocess(value => value === "" ? undefined : value, z.enum(["active", "alumni", "withdrawn", "transferred", "inactive"]).optional()),
  classLeaving: optionalText(50),
  dateOfLeaving: optionalDate,
  leavingTcNo: optionalText(50),
  tcTakenDate: optionalDate,
  confirmed: z.literal("on")
});

app.post("/api/students", authenticate, requirePermission("student.create"), studentPhotoUpload.single("photo"), async (req: AuthRequest, res, next) => {
  const discardUploadedPhoto = () => {
    if (!req.file?.path) return;
    try { unlinkSync(req.file.path); } catch { /* Cleanup failure is logged by storage monitoring in production. */ }
  };
  const parsed = studentSchema.safeParse(req.body);
  if (!parsed.success) {
    discardUploadedPhoto();
    const issue = parsed.error.issues[0];
    return res.status(422).json({ message: issue ? `${issue.path.join(".") || "Student record"}: ${issue.message}` : "Please complete all required student fields." });
  }
  try {
    const photoPath = req.file ? `uploads/students/${req.file.filename}` : undefined;
    const student = await repo.createStudent(parsed.data, req.auth!, photoPath);
    return res.status(201).json({ data: student });
  } catch (error) {
    discardUploadedPhoto();
    if (error instanceof Error && (error as any).statusCode) return res.status((error as any).statusCode).json({ message: error.message });
    return next(error);
  }
});

app.put("/api/students/:id", authenticate, requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    fullName: z.string().min(2).max(200),
    studentEmail: z.union([z.literal(""), z.email()]).optional(),
    residenceAddress: z.string().min(5).max(500),
    classAdmitted: z.string().min(1).max(50),
    sectionName: z.string().max(50).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Enter valid student details." });
  try { res.json({ data: await repo.updateStudent(req.auth!.schoolId, Number(req.params.id), req.auth!.userId, parsed.data) }); }
  catch (error) { next(error); }
});

app.patch("/api/students/:id/status", authenticate, requirePermission("student.status.change"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    status: z.enum(["active", "alumni", "withdrawn", "suspended", "deleted", "inactive"]),
    reason: z.string().max(255).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Select a valid status." });
  try { res.json({ data: await repo.changeStudentStatus(req.auth!.schoolId, Number(req.params.id), req.auth!.userId, parsed.data.status, parsed.data.reason) }); }
  catch (error) { next(error); }
});

app.post("/api/students/:id/restore", authenticate, requirePermission("student.status.change"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.restoreStudent(req.auth!.schoolId, Number(req.params.id)) }); }
  catch (error) { next(error); }
});

app.get("/api/students/export", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();
  const format = String(req.query.format || "csv").trim();
  try {
    const rows = await repo.exportStudents(req.auth!.schoolId, search, status || undefined);
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Students");
      sheet.columns = [
        { header: "Admission No", key: "admissionNo", width: 15 },
        { header: "Name", key: "fullName", width: 30 },
        { header: "Gender", key: "gender", width: 10 },
        { header: "Class", key: "className", width: 12 },
        { header: "Section", key: "sectionName", width: 10 },
        { header: "Status", key: "status", width: 12 },
        { header: "Date of Birth", key: "dateOfBirth", width: 15 },
        { header: "Board", key: "board", width: 10 },
        { header: "Admission Date", key: "dateOfAdmission", width: 15 },
        { header: "Email", key: "studentEmail", width: 25 },
        { header: "Phone", key: "phone", width: 15 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      for (const row of rows) sheet.addRow(row);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="students-export.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } else {
      const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["Admission No", "Name", "Gender", "Class", "Section", "Status", "Date of Birth", "Board", "Admission Date", "Email", "Phone"];
      const keys: (keyof any)[] = ["admissionNo", "fullName", "gender", "className", "sectionName", "status", "dateOfBirth", "board", "dateOfAdmission", "studentEmail", "phone"];
      const csv = [headers.map(quote).join(","), ...rows.map((r: any) => keys.map(k => quote(r[k])).join(","))].join("\r\n");
      res.type("text/csv").attachment("students-export.csv").send(csv);
    }
  } catch (error) { next(error); }
});

app.get("/api/students/:id/timeline", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getStudentTimeline(req.auth!.schoolId, Number(req.params.id)) }); }
  catch (error) { next(error); }
});

app.get("/api/students/:id/medical", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getStudentMedical(req.auth!.schoolId, Number(req.params.id)) }); }
  catch (error) { next(error); }
});

app.put("/api/students/:id/medical", authenticate, requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.upsertStudentMedical(req.auth!.schoolId, Number(req.params.id), req.body) }); }
  catch (error) { next(error); }
});

app.get("/api/students/:id/notes", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  const noteType = String(req.query.noteType || "").trim() || undefined;
  try { res.json({ data: await repo.getStudentNotes(req.auth!.schoolId, Number(req.params.id), noteType) }); }
  catch (error) { next(error); }
});

app.post("/api/students/:id/notes", authenticate, requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    noteType: z.enum(["academic", "medical", "behaviour", "counselling", "general"]),
    title: z.string().min(1).max(200),
    content: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide note type, title and content." });
  try { res.status(201).json({ data: await repo.createStudentNote(req.auth!.schoolId, Number(req.params.id), req.auth!.userId, parsed.data) }); }
  catch (error) { next(error); }
});

app.delete("/api/students/notes/:noteId", authenticate, requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  try { await repo.deleteStudentNote(req.auth!.schoolId, Number(req.params.noteId)); res.json({ message: "Note deleted." }); }
  catch (error) { next(error); }
});

app.post("/api/students/bulk/promote", authenticate, requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    studentIds: z.array(z.number().int().positive()).min(1),
    targetClass: z.string().min(1).max(50),
    targetSection: z.string().max(50).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide student IDs and target class." });
  try { res.json({ data: await repo.bulkPromoteStudents(req.auth!.schoolId, parsed.data.studentIds, parsed.data.targetClass, parsed.data.targetSection, req.auth!.userId) }); }
  catch (error) { next(error); }
});

app.post("/api/students/bulk/assign", authenticate, requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    studentIds: z.array(z.number().int().positive()).min(1),
    assignType: z.enum(["class", "section"]),
    value: z.string().min(1).max(50),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide student IDs, assign type and value." });
  try { res.json({ data: await repo.bulkAssignStudents(req.auth!.schoolId, parsed.data.studentIds, parsed.data.assignType, parsed.data.value, req.auth!.userId) }); }
  catch (error) { next(error); }
});

app.get("/api/students/check-duplicate", authenticate, requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  const admissionNo = String(req.query.admissionNo || "").trim();
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  if (!admissionNo) return res.status(422).json({ message: "Admission number is required." });
  try {
    const existing = await repo.checkDuplicate(req.auth!.schoolId, admissionNo, excludeId);
    res.json({ duplicate: !!existing, existing: existing || null });
  } catch (error) { next(error); }
});

// ─── Academic Setup ──────────────────────────────────────────────────────

app.get("/api/academic/setup", authenticate, requirePermission("academic.manage"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getAcademicSetup(req.auth!.schoolId) }); }
  catch (error) { next(error); }
});

// ─── Imports ─────────────────────────────────────────────────────────────

app.get("/api/imports/template.xlsx", async (_req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Student Admission Master");
    sheet.columns = [
      "ID No", "Admission No", "Name of the Pupil", "Student Aadhaar No", "PEN No", "AAPAR ID",
      "Father Name", "Father Qualification", "Father Occupation", "Father Aadhaar No", "Father Mobile Number", "Father Mail ID",
      "Mother Name", "Mother Qualification", "Mother Occupation", "Mother Aadhar No.", "Mother Mobile No", "Mother Mail ID",
      "Mother Bank Account No", "Bank IFSC Code", "Residence Address", "Previous School & Class", "TC Number", "Date of Admission",
      "Date of Birth", "Nationality", "Religion", "Caste", "Sub Caste", "Mother Tongue",
      "Class Admitted", "Class Leaving", "Date of Leaving", "Leaving TC No.", "TC Taken Date", "Photo of Student"
    ].map(header => ({ header, key: header, width: 20 }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="bulk-student-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
});

app.get("/api/imports", authenticate, requirePermission("import.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.listImportBatches(req.auth!.schoolId) }); }
  catch (error) { next(error); }
});

app.get("/api/imports/:id", authenticate, requirePermission("import.view"), async (req: AuthRequest, res, next) => {
  try {
    const batch = await repo.getImportBatch(req.auth!.schoolId, String(req.params.id));
    if (!batch) return res.status(404).json({ message: "Import batch not found." });
    res.json({ data: batch });
  } catch (error) { next(error); }
});

app.post("/api/imports/upload", authenticate, requirePermission("import.upload"), importUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a spreadsheet to upload." });
  try {
    const parsed = await parseStudentWorkbook(req.file.buffer, req.file.originalname);
    const existing = await repo.getExistingAdmissionNumbers(req.auth!.schoolId);
    const rows = validateRows(parsed, existing);
    const sourceType: "excel" | "csv" = req.file.originalname.toLowerCase().endsWith(".csv") ? "csv" : "excel";
    const batch = await repo.createImportBatch(req.auth!.schoolId, {
      context: req.auth! as { schoolId: number; userId: number },
      sourceType,
      filename: req.file.originalname,
      rows
    });
    res.status(201).json({ data: batch });
  } catch (error) { next(error); }
});

app.post("/api/imports/legacy/stage", authenticate, requirePermission("import.legacy.stage"), async (req: AuthRequest, res, next) => {
  try {
    const { getPool } = await import("./database/pool.js");
    const { existingAdmissionNumbers, stageBatch, validateRows: vr } = await import("./modules/imports/importService.js");
    const [source] = await getPool().execute<RowDataPacket[]>(
      `SELECT d.id, d.IDNo idNo, d.AdmissionNo admissionNo, d.NameOfThePupil fullName, d.StudentAadhaarNo studentAadhaarNo,
              d.PENNo penNo, d.AAPARID apaarId, d.FatherName fatherName, d.FatherAadhaarNo fatherAadhaarNo,
              d.FatherMobileNumber fatherMobileNumber, d.MailID studentEmail, d.MotherName motherName,
              d.MotherAadharNo motherAadhaarNo, d.MotherMobileNo motherMobileNumber, d.MotherBankAccountNo motherBankAccountNo,
              d.BankIFSCCode bankIfscCode, d.ResidenceAddress residenceAddress, d.FatherQualification fatherQualification,
              d.FatherOccupation fatherOccupation, d.FatherMailID fatherEmail, d.MotherQualification motherQualification,
              d.MotherOccupation motherOccupation, d.MotherMailID motherEmail, d.PreviousSchoolClass previousSchoolClass,
              d.TCNumber previousTcNo, d.DateOfAdmission dateOfAdmission, d.DateOfBirth dateOfBirth,
              d.Nationality nationality, d.Religion religion, d.Caste caste, d.SubCaste subCaste,
              d.MotherTongue motherTongue, d.ClassAdmitted classAdmitted, d.ClassLeaving classLeaving,
              d.DateOfLeaving dateOfLeaving, d.LeavingTCNo leavingTcNo, d.TCTakenDate tcTakenDate,
              d.AcademicYear academicYear, d.Board board
       FROM student_details d JOIN v2_schools s ON s.legacy_code = d.SchoolName WHERE s.id = ? ORDER BY d.id LIMIT 20000`,
      [req.auth!.schoolId]
    );
    const parsed = source.map((raw, index) => ({ rowNumber: index + 1, raw }));
    const rows = vr(parsed, await existingAdmissionNumbers(req.auth!.schoolId));
    res.status(201).json({ data: await stageBatch(req.auth! as { schoolId: number; userId: number }, "legacy", "legacy_student_details", rows) });
  } catch (error) { next(error); }
});

app.post("/api/imports/:id/approve", authenticate, requirePermission("import.approve"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.approveImport(req.auth!.schoolId, req.auth!.userId, String(req.params.id)) }); }
  catch (error) { next(error); }
});

app.post("/api/imports/:id/reject", authenticate, requirePermission("import.approve"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.rejectImport(req.auth!.schoolId, req.auth!.userId, String(req.params.id)) }); }
  catch (error) { next(error); }
});

app.post("/api/imports/:id/rollback", authenticate, requirePermission("import.approve"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.rollbackImport(req.auth!.schoolId, req.auth!.userId, String(req.params.id)) }); }
  catch (error) { next(error); }
});

app.get("/api/imports/history", authenticate, requirePermission("import.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getImportHistory(req.auth!.schoolId) }); }
  catch (error) { next(error); }
});

app.post("/api/imports/:id/cancel", authenticate, requirePermission("import.approve"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.cancelImport(req.auth!.schoolId, req.auth!.userId, String(req.params.id)) }); }
  catch (error) { next(error); }
});

app.get("/api/imports/:id/progress", authenticate, requirePermission("import.view"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.getImportProgress(req.auth!.schoolId, String(req.params.id)) }); }
  catch (error) { next(error); }
});

app.post("/api/imports/:id/resume", authenticate, requirePermission("import.approve"), async (req: AuthRequest, res, next) => {
  try { res.json({ data: await repo.resumeImport(req.auth!.schoolId, req.auth!.userId, String(req.params.id)) }); }
  catch (error) { next(error); }
});

app.get("/api/imports/:id/errors.csv", authenticate, requirePermission("import.view"), async (req: AuthRequest, res, next) => {
  try {
    const rows = await repo.getImportErrors(String(req.params.id));
    const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["Row,Status,Errors,Original Data", ...rows.map((r: any) =>
      [r.source_row_number, "Rejected", JSON.stringify(r.errors_json), JSON.stringify(r.raw_json)].map(quote).join(",")
    )].join("\r\n");
    res.type("text/csv").attachment(`import-${req.params.id}-errors.csv`).send(csv);
  } catch (error) { next(error); }
});

app.get("/api/imports/:id/errors.html", authenticate, requirePermission("import.view"), async (req: AuthRequest, res, next) => {
  try {
    const { getErrorReportHtml } = await import("./modules/imports/importService.js");
    const html = await getErrorReportHtml(req.auth!.schoolId, String(req.params.id));
    res.type("html").send(html);
  } catch (error) { next(error); }
});

// ─── Module 4: Document Management ───────────────────────────────────────

app.use("/api/documents", authenticate, documentRoutes);

// ─── Module 5: Certificate Engine ────────────────────────────────────────

app.use("/api/certificates", authenticate, certificateRoutes);

// ─── Module 6: Accounts & Fees ───────────────────────────────────────────

app.use("/api/accounts", authenticate, accountRoutes);

// ─── Module 7: Events ────────────────────────────────────────────────────

app.use("/api/events", authenticate, eventRoutes);

// ─── Module 8: Reports ───────────────────────────────────────────────────

app.use("/api/reports", authenticate, reportRoutes);

// ─── Module 9: User Management ───────────────────────────────────────────

app.use("/api/users", authenticate, userRoutes);

// ─── Module 10: Settings ─────────────────────────────────────────────────

app.use("/api/settings", authenticate, settingRoutes);

// ─── Frontend static files (Hostinger deployment) ────────────────────────

if (config.NODE_ENV === "production") {
  const frontendDist = path.join(process.cwd(), "frontend/dist");
  app.use(express.static(frontendDist));
  app.get("/*splat", (req, res, next) => {
    if (!req.path.startsWith("/api/")) {
      res.sendFile(path.join(frontendDist, "index.html"));
    } else {
      next();
    }
  });
}

// ─── 404 & Error Handler ────────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.error(`[ERROR] ${timestamp} ${_req.method} ${_req.originalUrl}:`, error);

  // Multer-specific errors
  if (error instanceof MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "File must be smaller than 5 MB." : "File upload failed.";
    return res.status(422).json({ message, code: error.code });
  }

  const databaseCodes = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR", "ER_NO_SUCH_TABLE", "PROTOCOL_CONNECTION_LOST"]);
  if (databaseCodes.has(String((error as Error & { code?: string }).code))) {
    return res.status(503).json({ message: "Database unavailable.", code: "DATABASE_UNAVAILABLE" });
  }

  // Known application errors with status codes
  const statusCode = Number((error as Error & { statusCode?: number }).statusCode) || 500;
  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ message: error.message });
  }

  // Production: never expose internal error details
  if (config.NODE_ENV === "production") {
    return res.status(500).json({ message: "An unexpected server error occurred.", code: "INTERNAL_ERROR" });
  }

  // Development: include error details
  res.status(500).json({ message: error.message, code: "INTERNAL_ERROR", stack: error.stack });
});

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, () => console.log(`Montessori API listening on port ${port}`));
  const shutdown = () => {
    server.close(() => { void closePool().finally(() => process.exit(0)); });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
export default app;
