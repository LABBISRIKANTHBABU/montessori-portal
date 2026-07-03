/**
 * Module 4: Document Management System
 * Upload, preview, download, replace, restore, and organize student documents.
 * All queries enforce school isolation. Raw paths never leave this module.
 */

import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { unlinkSync, createReadStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { getPool, query } from "../../database/pool.js";
import { requirePermission } from "../../security/permissions.js";
import { storeFile, resolveStoragePath, deleteFile, fileExists } from "../../storage/storageService.js";
import type { AuthRequest } from "../../types/auth.js";
import type { RowDataPacket } from "mysql2/promise";

const router = Router();

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.mimetype)) return cb(new Error("Only PDF, JPG, PNG, and WebP files are allowed."));
    cb(null, true);
  }
});

// ─── Categories ─────────────────────────────────────────────────────────

router.get("/categories", requirePermission("student.view"), async (_req, res, next) => {
  try {
    const [rows] = await query("SELECT id, code, name, sort_order FROM v2_document_categories ORDER BY sort_order");
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── List documents for a student ───────────────────────────────────────

router.get("/students/:studentId/documents", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const includeArchived = req.query.archived === "1";
    const [rows] = await query(
      `SELECT d.id, d.category_code categoryCode, dc.name categoryName, d.document_name documentName,
              d.original_filename originalFilename, d.file_size_bytes fileSize,
              d.mime_type mimeType, d.academic_year academicYear, d.is_archived isArchived,
              d.created_at createdAt, u.name uploadedByName,
              (SELECT COUNT(*) FROM v2_document_versions v WHERE v.document_id = d.id) versionCount,
              (SELECT v.version_number FROM v2_document_versions v WHERE v.document_id = d.id ORDER BY v.version_number DESC LIMIT 1) currentVersion
       FROM v2_student_documents d
       JOIN v2_document_categories dc ON dc.code = d.category_code
       JOIN v2_users u ON u.id = d.uploaded_by
       WHERE d.student_id = ? AND d.school_id = ? ${includeArchived ? "" : "AND d.is_archived = 0"}
       ORDER BY dc.sort_order, d.created_at DESC`,
      [req.params.studentId, req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Search documents across students ───────────────────────────────────

router.get("/search", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const term = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    if (!term && !category) return res.json({ data: [] });

    const conditions = ["d.school_id = ?", "d.is_archived = 0"];
    const params: any[] = [req.auth!.schoolId];

    if (term) {
      conditions.push("(d.document_name LIKE ? OR d.original_filename LIKE ? OR s.full_name LIKE ? OR s.admission_no LIKE ?)");
      const like = `%${term}%`;
      params.push(like, like, like, like);
    }
    if (category) {
      conditions.push("d.category_code = ?");
      params.push(category);
    }

    const [rows] = await query(
      `SELECT d.id, d.category_code categoryCode, dc.name categoryName, d.document_name documentName,
              d.original_filename originalFilename, d.file_size_bytes fileSize,
              d.mime_type mimeType, d.academic_year academicYear,
              d.created_at createdAt, u.name uploadedByName,
              s.id studentId, s.full_name studentName, s.admission_no admissionNo
       FROM v2_student_documents d
       JOIN v2_document_categories dc ON dc.code = d.category_code
       JOIN v2_users u ON u.id = d.uploaded_by
       JOIN v2_students s ON s.id = d.student_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY d.created_at DESC LIMIT 100`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Upload document ────────────────────────────────────────────────────

router.post("/students/:studentId/documents", requirePermission("student.document.upload"), memoryUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a file to upload." });
  const parsed = z.object({
    categoryCode: z.string().min(1),
    documentName: z.string().min(1).max(255),
    academicYear: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ message: "Provide document category and name." });
  }
  try {
    // Verify student belongs to this school
    const [studentCheck] = await query(
      "SELECT id FROM v2_students WHERE id = ? AND school_id = ? AND deleted_at IS NULL",
      [req.params.studentId, req.auth!.schoolId]
    );
    if (!studentCheck[0]) return res.status(404).json({ message: "Student not found." });

    const stored = storeFile(req.auth!.schoolId, "documents", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    }, { categoryCode: parsed.data.categoryCode, academicYear: parsed.data.academicYear });

    const [result] = await query(
      `INSERT INTO v2_student_documents (school_id, student_id, category_code, document_name, original_filename, storage_path, file_size_bytes, mime_type, academic_year, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.auth!.schoolId, req.params.studentId, parsed.data.categoryCode, parsed.data.documentName,
       stored.originalFilename, stored.storageKey, stored.sizeBytes, stored.mimeType,
       parsed.data.academicYear || null, req.auth!.userId]
    );
    const docId = (result as any).insertId;

    await query(
      `INSERT INTO v2_document_versions (document_id, version_number, storage_path, original_filename, file_size_bytes, uploaded_by)
       VALUES (?, 1, ?, ?, ?, ?)`,
      [docId, stored.storageKey, stored.originalFilename, stored.sizeBytes, req.auth!.userId]
    );

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'student_document', ?, 'document.upload', JSON_OBJECT('category', ?, 'name', ?))`,
      [req.auth!.schoolId, req.auth!.userId, docId, parsed.data.categoryCode, parsed.data.documentName]
    );

    res.status(201).json({ data: { id: docId, message: "Document uploaded." } });
  } catch (error) { next(error); }
});

// ─── Preview document (inline serve) ────────────────────────────────────

router.get("/documents/:id/preview", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT storage_path, original_filename, mime_type FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "Document not found." });

    const physicalPath = resolveStoragePath(rows[0].storage_path);
    if (!fileExists(physicalPath)) return res.status(404).json({ message: "File not found on disk." });

    res.setHeader("Content-Type", rows[0].mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${rows[0].original_filename}"`);
    res.sendFile(physicalPath);
  } catch (error) { next(error); }
});

// ─── Document thumbnail ─────────────────────────────────────────────────

router.get("/documents/:id/thumbnail", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT storage_path, original_filename, mime_type FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "Document not found." });

    const mime = rows[0].mime_type;
    if (!mime.startsWith("image/")) {
      return res.status(422).json({ message: "Thumbnails only available for images." });
    }

    const physicalPath = resolveStoragePath(rows[0].storage_path);
    if (!fileExists(physicalPath)) return res.status(404).json({ message: "File not found on disk." });

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="thumb_${rows[0].original_filename}"`);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(physicalPath);
  } catch (error) { next(error); }
});

// ─── Share document ─────────────────────────────────────────────────────

router.post("/documents/:id/share", requirePermission("student.document.upload"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    userId: z.number().int().positive(),
    permission: z.enum(["view", "edit"]).default("view"),
    expiresAt: z.string().datetime().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide userId and valid permission (view/edit)." });

  try {
    const [docCheck] = await query(
      "SELECT id, student_id FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!docCheck[0]) return res.status(404).json({ message: "Document not found." });

    if (Number(req.params.id) === parsed.data.userId) {
      return res.status(422).json({ message: "Cannot share a document with yourself." });
    }

    const [userCheck] = await query(
      "SELECT id FROM v2_users WHERE id = ? AND school_id = ?",
      [parsed.data.userId, req.auth!.schoolId]
    );
    if (!userCheck[0]) return res.status(404).json({ message: "User not found." });

    const [existing] = await query(
      "SELECT id FROM v2_document_shares WHERE document_id = ? AND shared_with_user_id = ?",
      [req.params.id, parsed.data.userId]
    );

    if (existing[0]) {
      await query(
        "UPDATE v2_document_shares SET permission = ?, expires_at = ?, shared_by_user_id = ?, updated_at = UTC_TIMESTAMP() WHERE document_id = ? AND shared_with_user_id = ?",
        [parsed.data.permission, parsed.data.expiresAt || null, req.auth!.userId, req.params.id, parsed.data.userId]
      );
    } else {
      await query(
        `INSERT INTO v2_document_shares (school_id, document_id, shared_by_user_id, shared_with_user_id, permission, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.auth!.schoolId, req.params.id, req.auth!.userId, parsed.data.userId, parsed.data.permission, parsed.data.expiresAt || null]
      );
    }

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'student_document', ?, 'document.share', JSON_OBJECT('shared_with', ?, 'permission', ?))`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id, parsed.data.userId, parsed.data.permission]
    );

    res.json({ data: { message: "Document shared successfully." } });
  } catch (error) { next(error); }
});

// ─── Get document shares ────────────────────────────────────────────────

router.get("/documents/:id/shares", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const [docCheck] = await query(
      "SELECT id FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!docCheck[0]) return res.status(404).json({ message: "Document not found." });

    const [rows] = await query(
      `SELECT ds.id, ds.permission, ds.expires_at expiresAt, ds.created_at createdAt,
              u.name sharedWithUserName, u.email sharedWithUserEmail,
              sb.name sharedByUserName
       FROM v2_document_shares ds
       JOIN v2_users u ON u.id = ds.shared_with_user_id
       JOIN v2_users sb ON sb.id = ds.shared_by_user_id
       WHERE ds.document_id = ?
       ORDER BY ds.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Remove document share ──────────────────────────────────────────────

router.delete("/documents/:id/shares/:shareId", requirePermission("student.document.upload"), async (req: AuthRequest, res, next) => {
  try {
    const [shareCheck] = await query(
      "SELECT id FROM v2_document_shares WHERE id = ? AND document_id = ?",
      [req.params.shareId, req.params.id]
    );
    if (!shareCheck[0]) return res.status(404).json({ message: "Share not found." });

    await query("DELETE FROM v2_document_shares WHERE id = ? AND document_id = ?", [req.params.shareId, req.params.id]);

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'student_document', ?, 'document.unshare', JSON_OBJECT('share_id', ?))`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id, req.params.shareId]
    );

    res.json({ data: { message: "Share removed." } });
  } catch (error) { next(error); }
});

// ─── Update document metadata ───────────────────────────────────────────

router.put("/documents/:id/metadata", requirePermission("student.document.upload"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    documentName: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    categoryCode: z.string().min(1).optional(),
    academicYear: z.string().max(20).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid metadata provided." });

  try {
    const [docCheck] = await query(
      "SELECT id, category_code FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!docCheck[0]) return res.status(404).json({ message: "Document not found." });

    const updates: string[] = [];
    const params: any[] = [];

    if (parsed.data.documentName) { updates.push("document_name = ?"); params.push(parsed.data.documentName); }
    if (parsed.data.description !== undefined) { updates.push("description = ?"); params.push(parsed.data.description); }
    if (parsed.data.tags) { updates.push("tags = ?"); params.push(JSON.stringify(parsed.data.tags)); }
    if (parsed.data.categoryCode) { updates.push("category_code = ?"); params.push(parsed.data.categoryCode); }
    if (parsed.data.academicYear !== undefined) { updates.push("academic_year = ?"); params.push(parsed.data.academicYear || null); }

    if (updates.length === 0) return res.status(422).json({ message: "No fields to update." });

    updates.push("updated_at = UTC_TIMESTAMP()");
    params.push(req.params.id, req.auth!.schoolId);

    await query(
      `UPDATE v2_student_documents SET ${updates.join(", ")} WHERE id = ? AND school_id = ?`,
      params
    );

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'student_document', ?, 'document.metadata_update', JSON_OBJECT('fields', ?))`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id, Object.keys(parsed.data).filter(k => (parsed.data as any)[k] !== undefined).join(",")]
    );

    res.json({ data: { message: "Metadata updated." } });
  } catch (error) { next(error); }
});

// ─── Bulk download documents ────────────────────────────────────────────

router.post("/bulk-download", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    documentIds: z.array(z.number().int().positive()).min(1).max(50)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide 1-50 document IDs." });

  try {
    const placeholders = parsed.data.documentIds.map(() => "?").join(",");
    const [rows] = await query(
      `SELECT id, storage_path, original_filename, mime_type, file_size_bytes
       FROM v2_student_documents
       WHERE id IN (${placeholders}) AND school_id = ?`,
      [...parsed.data.documentIds, req.auth!.schoolId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "No documents found." });

    const files = rows.map((r: any) => ({
      id: r.id,
      filename: r.original_filename,
      mimeType: r.mime_type,
      size: r.file_size_bytes,
      downloadUrl: `/api/documents/${r.id}/download`
    }));

    const totalSize = rows.reduce((sum: number, r: any) => sum + (r.file_size_bytes || 0), 0);

    res.json({
      data: {
        files,
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        message: "Use individual download URLs to retrieve files."
      }
    });
  } catch (error) { next(error); }
});

// ─── Download document ──────────────────────────────────────────────────

router.get("/documents/:id/download", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT storage_path, original_filename, mime_type FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "Document not found." });

    const physicalPath = resolveStoragePath(rows[0].storage_path);
    if (!fileExists(physicalPath)) return res.status(404).json({ message: "File not found on disk." });

    res.download(physicalPath, rows[0].original_filename);
  } catch (error) { next(error); }
});

// ─── Replace document (create new version) ──────────────────────────────

router.put("/documents/:id/replace", requirePermission("student.document.upload"), memoryUpload.single("file"), async (req: AuthRequest, res, next) => {
  if (!req.file) return res.status(422).json({ message: "Select a replacement file." });
  try {
    const [rows] = await query(
      "SELECT id, version_number, category_code, academic_year FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "Document not found." });

    const stored = storeFile(req.auth!.schoolId, "documents", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    }, { categoryCode: rows[0].category_code, academicYear: rows[0].academic_year });

    const newVersion = Number(rows[0].version_number) + 1;
    await query(
      "UPDATE v2_student_documents SET storage_path = ?, original_filename = ?, file_size_bytes = ?, mime_type = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND school_id = ?",
      [stored.storageKey, stored.originalFilename, stored.sizeBytes, stored.mimeType, req.params.id, req.auth!.schoolId]
    );
    await query(
      `INSERT INTO v2_document_versions (document_id, version_number, storage_path, original_filename, file_size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, newVersion, stored.storageKey, stored.originalFilename, stored.sizeBytes, req.auth!.userId]
    );
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'student_document', ?, 'document.replace', JSON_OBJECT('version', ?))`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id, newVersion]
    );
    res.json({ data: { id: Number(req.params.id), version: newVersion, message: "Document replaced." } });
  } catch (error) { next(error); }
});

// ─── Archive document ───────────────────────────────────────────────────

router.patch("/documents/:id/archive", requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  try {
    await query(
      "UPDATE v2_student_documents SET is_archived = 1, updated_at = UTC_TIMESTAMP() WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name)
       VALUES (?, ?, 'student_document', ?, 'document.archive')`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id]
    );
    res.json({ data: { message: "Document archived." } });
  } catch (error) { next(error); }
});

// ─── Restore (unarchive) document ───────────────────────────────────────

router.patch("/documents/:id/restore", requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT id, is_archived FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "Document not found." });
    if (!rows[0].is_archived) return res.status(422).json({ message: "Document is not archived." });

    await query(
      "UPDATE v2_student_documents SET is_archived = 0, updated_at = UTC_TIMESTAMP() WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name)
       VALUES (?, ?, 'student_document', ?, 'document.restore')`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id]
    );
    res.json({ data: { message: "Document restored." } });
  } catch (error) { next(error); }
});

// ─── Hard delete document ───────────────────────────────────────────────

router.delete("/documents/:id", requirePermission("student.update"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT id, storage_path FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "Document not found." });

    // Get all version paths for cleanup
    const [versions] = await query(
      "SELECT storage_path FROM v2_document_versions WHERE document_id = ?",
      [req.params.id]
    );

    // Delete files from disk
    deleteFile(rows[0].storage_path);
    for (const v of versions) {
      if (v.storage_path !== rows[0].storage_path) {
        deleteFile(v.storage_path);
      }
    }

    // Delete DB records (versions cascade)
    await query("DELETE FROM v2_student_documents WHERE id = ? AND school_id = ?", [req.params.id, req.auth!.schoolId]);

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name)
       VALUES (?, ?, 'student_document', ?, 'document.delete')`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id]
    );
    res.json({ data: { message: "Document permanently deleted." } });
  } catch (error) { next(error); }
});

// ─── Get document versions ──────────────────────────────────────────────

router.get("/documents/:id/versions", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const [docCheck] = await query(
      "SELECT id FROM v2_student_documents WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!docCheck[0]) return res.status(404).json({ message: "Document not found." });

    const [rows] = await query(
      `SELECT v.id, v.version_number version, v.original_filename filename, v.file_size_bytes fileSize,
              v.created_at createdAt, u.name uploadedByName
       FROM v2_document_versions v JOIN v2_users u ON u.id = v.uploaded_by
       WHERE v.document_id = ? ORDER BY v.version_number DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── List archived documents for a student ──────────────────────────────

router.get("/students/:studentId/archived", requirePermission("student.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT d.id, d.category_code categoryCode, dc.name categoryName, d.document_name documentName,
              d.original_filename originalFilename, d.file_size_bytes fileSize,
              d.mime_type mimeType, d.academic_year academicYear,
              d.created_at createdAt, d.updated_at updatedAt, u.name uploadedByName
       FROM v2_student_documents d
       JOIN v2_document_categories dc ON dc.code = d.category_code
       JOIN v2_users u ON u.id = d.uploaded_by
       WHERE d.student_id = ? AND d.school_id = ? AND d.is_archived = 1
       ORDER BY d.updated_at DESC`,
      [req.params.studentId, req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

export default router;
