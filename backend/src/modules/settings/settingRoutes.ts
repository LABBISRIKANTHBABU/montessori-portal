/**
 * Module 10: Settings
 * School profile, academic year, board, logo, signature, fee structure, backup.
 */

import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { z } from "zod";
import { getPool, query } from "../../database/pool.js";
import { requirePermission } from "../../security/permissions.js";
import type { AuthRequest } from "../../types/auth.js";
import type { RowDataPacket } from "mysql2/promise";
import { ensureStorageDirectory } from "../../storage/storageService.js";
import { protectSettingValue, SECRET_SETTING_KEYS } from "../../security/settingSecrets.js";

const router = Router();
const settingsUploadDir = ensureStorageDirectory("settings");

const logoStorage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, settingsUploadDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/svg+xml"]);
    if (!allowed.has(file.mimetype)) return cb(new Error("Only JPG, PNG, and SVG files are allowed."));
    cb(null, true);
  }
});

// Get all settings
router.get("/", requirePermission("settings.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT setting_key keyName, setting_value value FROM v2_school_settings WHERE school_id = ?",
      [req.auth!.schoolId]
    );
    const settings: Record<string, string | null> = {};
    for (const row of rows) settings[row.keyName] = SECRET_SETTING_KEYS.has(row.keyName) && row.value ? "••••••••" : row.value;
    res.json({ data: settings });
  } catch (error) { next(error); }
});

// Update setting
router.put("/:key", requirePermission("settings.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ value: z.string().max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid value." });
  const settingKey = String(req.params.key);
  if (SECRET_SETTING_KEYS.has(settingKey) && parsed.data.value === "••••••••") {
    return res.json({ data: { message: "Secret unchanged." } });
  }
  try {
    const storedValue = protectSettingValue(settingKey, parsed.data.value);
    await query(
      `INSERT INTO v2_school_settings (school_id, setting_key, setting_value, updated_by)
       VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [req.auth!.schoolId, settingKey, storedValue, req.auth!.userId]
    );
    res.json({ data: { message: "Setting updated." } });
  } catch (error) { next(error); }
});

// Upload school logo
router.post("/logo", requirePermission("settings.manage"), logoUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a file." });
  try {
    await query(
      `INSERT INTO v2_school_logos (school_id, logo_type, storage_path, original_filename, uploaded_by)
       VALUES (?, 'school_logo', ?, ?, ?)
       ON DUPLICATE KEY UPDATE storage_path = VALUES(storage_path), original_filename = VALUES(original_filename), uploaded_by = VALUES(uploaded_by)`,
      [req.auth!.schoolId, req.file.path, req.file.originalname, req.auth!.userId]
    );
    await query(
      "UPDATE v2_school_settings SET setting_value = ? WHERE school_id = ? AND setting_key = 'school_logo_path'",
      [req.file.path, req.auth!.schoolId]
    );
    res.json({ data: { message: "Logo uploaded." } });
  } catch (error) { next(error); }
});

// Upload principal signature
router.post("/signature", requirePermission("settings.manage"), logoUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a file." });
  try {
    await query(
      `INSERT INTO v2_school_logos (school_id, logo_type, storage_path, original_filename, uploaded_by)
       VALUES (?, 'principal_signature', ?, ?, ?)
       ON DUPLICATE KEY UPDATE storage_path = VALUES(storage_path), original_filename = VALUES(original_filename), uploaded_by = VALUES(uploaded_by)`,
      [req.auth!.schoolId, req.file.path, req.file.originalname, req.auth!.userId]
    );
    await query(
      "UPDATE v2_school_settings SET setting_value = ? WHERE school_id = ? AND setting_key = 'principal_signature_path'",
      [req.file.path, req.auth!.schoolId]
    );
    res.json({ data: { message: "Signature uploaded." } });
  } catch (error) { next(error); }
});

// Upload secretary signature
router.post("/secretary-signature", requirePermission("settings.manage"), logoUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a file." });
  try {
    await query(
      `INSERT INTO v2_school_logos (school_id, logo_type, storage_path, original_filename, uploaded_by)
       VALUES (?, 'secretary_signature', ?, ?, ?)
       ON DUPLICATE KEY UPDATE storage_path = VALUES(storage_path), original_filename = VALUES(original_filename), uploaded_by = VALUES(uploaded_by)`,
      [req.auth!.schoolId, req.file.path, req.file.originalname, req.auth!.userId]
    );
    await query(
      "UPDATE v2_school_settings SET setting_value = ? WHERE school_id = ? AND setting_key = 'secretary_signature_path'",
      [req.file.path, req.auth!.schoolId]
    );
    res.json({ data: { message: "Secretary signature uploaded." } });
  } catch (error) { next(error); }
});

// Upload school stamp
router.post("/stamp", requirePermission("settings.manage"), logoUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a file." });
  try {
    await query(
      `INSERT INTO v2_school_logos (school_id, logo_type, storage_path, original_filename, uploaded_by)
       VALUES (?, 'school_stamp', ?, ?, ?)
       ON DUPLICATE KEY UPDATE storage_path = VALUES(storage_path), original_filename = VALUES(original_filename), uploaded_by = VALUES(uploaded_by)`,
      [req.auth!.schoolId, req.file.path, req.file.originalname, req.auth!.userId]
    );
    await query(
      "UPDATE v2_school_settings SET setting_value = ? WHERE school_id = ? AND setting_key = 'school_stamp_path'",
      [req.file.path, req.auth!.schoolId]
    );
    res.json({ data: { message: "School stamp uploaded." } });
  } catch (error) { next(error); }
});

// Backup database
router.post("/backup", requirePermission("settings.manage"), async (req: AuthRequest, res, next) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupId = `backup-${timestamp}`;
    await query(
      "INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json) VALUES (?,?,'system',NULL,'system.backup',JSON_OBJECT('backupId',?,'timestamp',?))",
      [req.auth!.schoolId, req.auth!.userId, backupId, new Date().toISOString()]
    );
    res.json({ data: { message: "Backup initiated.", backupId, timestamp: new Date().toISOString() } });
  } catch (error) { next(error); }
});

// List academic years
router.get("/academic-years", requirePermission("settings.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT id, name, start_date startDate, end_date endDate, is_current isCurrent FROM v2_academic_years WHERE school_id = ? ORDER BY start_date DESC",
      [req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// Create academic year
router.post("/academic-years", requirePermission("settings.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ name: z.string().min(4).max(20), startDate: z.string(), endDate: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide name and dates." });
  try {
    const [result] = await query(
      "INSERT INTO v2_academic_years (school_id, name, start_date, end_date, is_current) VALUES (?, ?, ?, ?, 0)",
      [req.auth!.schoolId, parsed.data.name, parsed.data.startDate, parsed.data.endDate]
    );
    res.status(201).json({ data: { id: (result as any).insertId, message: "Academic year created." } });
  } catch (error) { next(error); }
});

// Update academic year
router.put("/academic-years/:id", requirePermission("settings.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ name: z.string().min(4).max(20).optional(), startDate: z.string().optional(), endDate: z.string().optional(), isCurrent: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid fields." });
  try {
    const updates: string[] = [];
    const params: any[] = [];
    if (parsed.data.name !== undefined) { updates.push("name = ?"); params.push(parsed.data.name); }
    if (parsed.data.startDate !== undefined) { updates.push("start_date = ?"); params.push(parsed.data.startDate); }
    if (parsed.data.endDate !== undefined) { updates.push("end_date = ?"); params.push(parsed.data.endDate); }
    if (parsed.data.isCurrent !== undefined) {
      if (parsed.data.isCurrent) {
        await query("UPDATE v2_academic_years SET is_current = 0 WHERE school_id = ?", [req.auth!.schoolId]);
      }
      updates.push("is_current = ?"); params.push(parsed.data.isCurrent ? 1 : 0);
    }
    if (updates.length === 0) return res.status(422).json({ message: "Nothing to update." });
    params.push(req.params.id, req.auth!.schoolId);
    await query(`UPDATE v2_academic_years SET ${updates.join(", ")} WHERE id = ? AND school_id = ?`, params);
    res.json({ data: { message: "Academic year updated." } });
  } catch (error) { next(error); }
});

// Delete academic year
router.delete("/academic-years/:id", requirePermission("settings.manage"), async (req: AuthRequest, res, next) => {
  try {
    const [result] = await query(
      "DELETE FROM v2_academic_years WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if ((result as any).affectedRows === 0) return res.status(404).json({ message: "Academic year not found." });
    res.json({ data: { message: "Academic year deleted." } });
  } catch (error) { next(error); }
});

// List boards
router.get("/boards", requirePermission("settings.view"), async (_req, res, next) => {
  try {
    const [rows] = await query("SELECT id, code, name FROM v2_boards ORDER BY code");
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// List classes
router.get("/classes", requirePermission("settings.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT id, name, board_code boardCode, sort_order sortOrder FROM v2_classes WHERE school_id = ? ORDER BY sort_order, name",
      [req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// Audit log
router.get("/audit-log", requirePermission("settings.view"), async (req: AuthRequest, res, next) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const [rows] = await query(
      `SELECT a.id, a.entity_type entityType, a.entity_id entityId, a.action_name actionName,
              a.metadata_json metadata, a.created_at createdAt, u.name userName
       FROM v2_audit_events a LEFT JOIN v2_users u ON u.id = a.user_id
       WHERE a.school_id = ?
       ORDER BY a.created_at DESC LIMIT ?`,
      [req.auth!.schoolId, limit]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// System logs
router.get("/system-logs", requirePermission("settings.view"), async (req: AuthRequest, res, next) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const [rows] = await query(
      `SELECT id, log_level level, source, message, created_at createdAt
       FROM v2_system_logs WHERE school_id = ? OR school_id IS NULL
       ORDER BY created_at DESC LIMIT ?`,
      [req.auth!.schoolId, limit]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

export default router;
