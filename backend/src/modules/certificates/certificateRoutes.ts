/**
 * Module 5: Certificate Engine
 * Generate, preview, download, and verify certificates with QR codes and PDF.
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "../../database/pool.js";
import { requirePermission } from "../../security/permissions.js";
import { getCertificateData, generateCertificateHtml, generateCertificatePdf } from "./certificateService.js";
import type { AuthRequest } from "../../types/auth.js";
import type { RowDataPacket } from "mysql2/promise";

const router = Router();

const CERT_TYPES = ["transfer", "study", "bonafide", "conduct", "fee", "participation", "achievement"] as const;

// ─── List all certificates for a school (admin) ─────────────────────────

router.get("/", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  const type = String(req.query.type || "").trim();
  const status = String(req.query.status || "").trim();
  try {
    const conditions = ["c.school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    if (type) { conditions.push("c.certificate_type = ?"); params.push(type); }
    if (status) { conditions.push("c.status = ?"); params.push(status); }
    const [rows] = await query(
      `SELECT c.id, c.certificate_type type, c.certificate_number number, c.issued_date issuedDate,
              c.status, c.academic_year academicYear, c.qr_code_data qrCode,
              s.full_name studentName, s.admission_no admissionNo
       FROM v2_certificates c JOIN v2_students s ON s.id = c.student_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.issued_date DESC LIMIT 200`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── List certificates for a student ─────────────────────────────────────

router.get("/students/:studentId/certificates", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT c.id, c.certificate_type type, c.certificate_number number, c.issued_date issuedDate,
              c.status, c.academic_year academicYear, c.qr_code_data qrCode, c.created_at createdAt,
              u.name issuedByName
       FROM v2_certificates c JOIN v2_users u ON u.id = c.issued_by
       WHERE c.student_id = ? AND c.school_id = ?
       ORDER BY c.issued_date DESC`,
      [req.params.studentId, req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Generate certificate ───────────────────────────────────────────────

router.post("/students/:studentId/certificates", requirePermission("certificate.generate"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    certificateType: z.enum(CERT_TYPES),
    academicYear: z.string().max(20).optional(),
    reason: z.string().max(500).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Select a valid certificate type." });

  try {
    const [students] = await query(
      `SELECT s.id, s.full_name, s.admission_no, s.student_uid, s.current_status,
              a.class_admitted, a.section_name, a.board_code, a.admission_date
       FROM v2_students s LEFT JOIN v2_admissions a ON a.student_id = s.id
       WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL`,
      [req.params.studentId, req.auth!.schoolId]
    );
    if (!students[0]) return res.status(404).json({ message: "Student not found." });
    const student = students[0];

    if (parsed.data.certificateType === "transfer" && student.current_status === "active") {
      return res.status(422).json({ message: "Student must be Withdrawn, Alumni, or Suspended to issue a Transfer Certificate." });
    }

    const [guardians] = await query(
      `SELECT g.full_name, g.relation_type FROM v2_guardians g
       JOIN v2_student_guardians sg ON sg.guardian_id = g.id
       WHERE sg.student_id = ? ORDER BY sg.is_primary DESC`,
      [req.params.studentId]
    );

    const [countResult] = await query(
      "SELECT COUNT(*) cnt FROM v2_certificates WHERE school_id = ? AND certificate_type = ?",
      [req.auth!.schoolId, parsed.data.certificateType]
    );
    const seq = Number(countResult[0]?.cnt || 0) + 1;
    const prefix = parsed.data.certificateType === "transfer" ? "TC" :
                   parsed.data.certificateType === "study" ? "STU" :
                   parsed.data.certificateType === "bonafide" ? "BON" :
                   parsed.data.certificateType === "conduct" ? "CON" :
                   parsed.data.certificateType === "fee" ? "FEE" :
                   parsed.data.certificateType === "participation" ? "PAR" : "ACH";
    const certNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
    const qrCodeData = `${req.protocol}://${req.get("host")}/api/certificates/verify/${certNumber}`;

    const [result] = await query(
      `INSERT INTO v2_certificates (school_id, student_id, certificate_type, certificate_number, issued_date, academic_year, qr_code_data, issued_by, reason)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [req.auth!.schoolId, req.params.studentId, parsed.data.certificateType, certNumber,
       parsed.data.academicYear || null, qrCodeData, req.auth!.userId, parsed.data.reason || null]
    );

    if (parsed.data.certificateType === "transfer" && student.current_status !== "withdrawn") {
      await query("UPDATE v2_students SET current_status = 'withdrawn' WHERE id = ?", [req.params.studentId]);
      await query(
        "INSERT INTO v2_student_status_history (student_id, old_status, new_status, reason, changed_by) VALUES (?, ?, 'withdrawn', ?, ?)",
        [req.params.studentId, student.current_status, `TC issued: ${certNumber}`, req.auth!.userId]
      );
    }

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'certificate', ?, 'certificate.generate', JSON_OBJECT('type', ?, 'number', ?))`,
      [req.auth!.schoolId, req.auth!.userId, (result as any).insertId, parsed.data.certificateType, certNumber]
    );

    res.status(201).json({
      data: {
        id: (result as any).insertId, certificateNumber: certNumber,
        type: parsed.data.certificateType, issuedDate: new Date().toISOString().split("T")[0],
        studentName: student.full_name, className: student.class_admitted,
        sectionName: student.section_name, boardCode: student.board_code,
        fatherName: guardians.find((g: any) => g.relation_type === "father")?.full_name || "",
        motherName: guardians.find((g: any) => g.relation_type === "mother")?.full_name || "",
        qrCodeData, status: "issued"
      }
    });
  } catch (error) { next(error); }
});

// ─── Bulk generate certificates ─────────────────────────────────────────

router.post("/bulk", requirePermission("certificate.generate"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    studentIds: z.array(z.number().int().positive()).min(1).max(100),
    certificateType: z.enum(CERT_TYPES),
    academicYear: z.string().max(20).optional(),
    reason: z.string().max(500).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide studentIds array (1-100) and certificateType." });

  try {
    const results: any[] = [];
    const errors: any[] = [];

    for (const studentId of parsed.data.studentIds) {
      try {
        const [students] = await query(
          `SELECT s.id, s.full_name, s.admission_no, s.student_uid, s.current_status,
                  a.class_admitted, a.section_name, a.board_code
           FROM v2_students s LEFT JOIN v2_admissions a ON a.student_id = s.id
           WHERE s.id = ? AND s.school_id = ? AND s.deleted_at IS NULL`,
          [studentId, req.auth!.schoolId]
        );
        if (!students[0]) { errors.push({ studentId, error: "Student not found" }); continue; }
        const student = students[0];

        if (parsed.data.certificateType === "transfer" && student.current_status === "active") {
          errors.push({ studentId, studentName: student.full_name, error: "Active student cannot receive TC" });
          continue;
        }

        const [countResult] = await query(
          "SELECT COUNT(*) cnt FROM v2_certificates WHERE school_id = ? AND certificate_type = ?",
          [req.auth!.schoolId, parsed.data.certificateType]
        );
        const seq = Number(countResult[0]?.cnt || 0) + results.length + 1;
        const prefix = parsed.data.certificateType === "transfer" ? "TC" :
                       parsed.data.certificateType === "study" ? "STU" :
                       parsed.data.certificateType === "bonafide" ? "BON" :
                       parsed.data.certificateType === "conduct" ? "CON" :
                       parsed.data.certificateType === "fee" ? "FEE" :
                       parsed.data.certificateType === "participation" ? "PAR" : "ACH";
        const certNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
        const qrCodeData = `${req.protocol}://${req.get("host")}/api/certificates/verify/${certNumber}`;

        const [result] = await query(
          `INSERT INTO v2_certificates (school_id, student_id, certificate_type, certificate_number, issued_date, academic_year, qr_code_data, issued_by, reason)
           VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
          [req.auth!.schoolId, studentId, parsed.data.certificateType, certNumber,
           parsed.data.academicYear || null, qrCodeData, req.auth!.userId, parsed.data.reason || null]
        );

        if (parsed.data.certificateType === "transfer" && student.current_status !== "withdrawn") {
          await query("UPDATE v2_students SET current_status = 'withdrawn' WHERE id = ?", [studentId]);
        }

        results.push({
          studentId, studentName: student.full_name,
          certificateId: (result as any).insertId, certificateNumber: certNumber
        });
      } catch (err: any) {
        errors.push({ studentId, error: err.message });
      }
    }

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'certificate', 0, 'certificate.bulk_generate', JSON_OBJECT('type', ?, 'count', ?, 'errors', ?))`,
      [req.auth!.schoolId, req.auth!.userId, parsed.data.certificateType, results.length, errors.length]
    );

    res.status(201).json({
      data: {
        generated: results,
        failed: errors,
        summary: { total: parsed.data.studentIds.length, successful: results.length, failed: errors.length }
      }
    });
  } catch (error) { next(error); }
});

// ─── Bulk download certificates ─────────────────────────────────────────

router.post("/bulk-download", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    certificateIds: z.array(z.number().int().positive()).min(1).max(50)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide 1-50 certificate IDs." });

  try {
    const placeholders = parsed.data.certificateIds.map(() => "?").join(",");
    const [rows] = await query(
      `SELECT c.id, c.certificate_type, c.certificate_number, c.issued_date,
              s.full_name student_name
       FROM v2_certificates c
       JOIN v2_students s ON s.id = c.student_id
       WHERE c.id IN (${placeholders}) AND c.school_id = ?`,
      [...parsed.data.certificateIds, req.auth!.schoolId]
    );

    if (rows.length === 0) return res.status(404).json({ message: "No certificates found." });

    const certificates = rows.map((r: any) => ({
      id: r.id,
      type: r.certificate_type,
      number: r.certificate_number,
      studentName: r.student_name,
      issuedDate: r.issued_date,
      downloadUrl: `/api/certificates/${r.id}/download`
    }));

    res.json({
      data: {
        certificates,
        totalCertificates: certificates.length,
        message: "Use individual download URLs to retrieve PDFs."
      }
    });
  } catch (error) { next(error); }
});

// ─── Cancel certificate (alias for revoke) ──────────────────────────────

router.patch("/:id/cancel", requirePermission("certificate.generate"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    reason: z.string().max(500).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid input." });

  try {
    const [existing] = await query(
      "SELECT id, status, certificate_number FROM v2_certificates WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!existing[0]) return res.status(404).json({ message: "Certificate not found." });
    if (existing[0].status === "cancelled") return res.status(422).json({ message: "Certificate is already cancelled." });

    await query(
      "UPDATE v2_certificates SET status = 'cancelled', cancelled_reason = ?, cancelled_at = UTC_TIMESTAMP(), cancelled_by = ? WHERE id = ? AND school_id = ?",
      [parsed.data.reason || null, req.auth!.userId, req.params.id, req.auth!.schoolId]
    );

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'certificate', ?, 'certificate.cancel', JSON_OBJECT('number', ?, 'reason', ?))`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id, existing[0].certificate_number, parsed.data.reason || null]
    );

    res.json({ data: { message: "Certificate cancelled.", certificateNumber: existing[0].certificate_number } });
  } catch (error) { next(error); }
});

// ─── Regenerate certificate ─────────────────────────────────────────────

router.post("/:id/regenerate", requirePermission("certificate.generate"), async (req: AuthRequest, res, next) => {
  try {
    const [existing] = await query(
      `SELECT c.*, s.full_name, s.admission_no, s.student_uid, s.current_status,
              a.class_admitted, a.section_name, a.board_code
       FROM v2_certificates c
       JOIN v2_students s ON s.id = c.student_id
       LEFT JOIN v2_admissions a ON a.student_id = s.id
       WHERE c.id = ? AND c.school_id = ?`,
      [req.params.id, req.auth!.schoolId]
    );
    if (!existing[0]) return res.status(404).json({ message: "Certificate not found." });

    const oldCert = existing[0];
    if (oldCert.status === "cancelled") {
      return res.status(422).json({ message: "Cannot regenerate a cancelled certificate." });
    }

    const [countResult] = await query(
      "SELECT COUNT(*) cnt FROM v2_certificates WHERE school_id = ? AND certificate_type = ?",
      [req.auth!.schoolId, oldCert.certificate_type]
    );
    const seq = Number(countResult[0]?.cnt || 0) + 1;
    const prefix = oldCert.certificate_type === "transfer" ? "TC" :
                   oldCert.certificate_type === "study" ? "STU" :
                   oldCert.certificate_type === "bonafide" ? "BON" :
                   oldCert.certificate_type === "conduct" ? "CON" :
                   oldCert.certificate_type === "fee" ? "FEE" :
                   oldCert.certificate_type === "participation" ? "PAR" : "ACH";
    const newCertNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
    const qrCodeData = `${req.protocol}://${req.get("host")}/api/certificates/verify/${newCertNumber}`;

    await query(
      "UPDATE v2_certificates SET status = 'superseded' WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );

    const [result] = await query(
      `INSERT INTO v2_certificates (school_id, student_id, certificate_type, certificate_number, issued_date, academic_year, qr_code_data, issued_by, reason, superseded_by)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
      [req.auth!.schoolId, oldCert.student_id, oldCert.certificate_type, newCertNumber,
       oldCert.academic_year, qrCodeData, req.auth!.userId, oldCert.reason, null]
    );

    await query(
      `UPDATE v2_certificates SET superseded_by = ? WHERE id = ?`,
      [(result as any).insertId, req.params.id]
    );

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'certificate', ?, 'certificate.regenerate', JSON_OBJECT('old_number', ?, 'new_number', ?))`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id, oldCert.certificate_number, newCertNumber]
    );

    res.status(201).json({
      data: {
        id: (result as any).insertId,
        certificateNumber: newCertNumber,
        oldCertificateNumber: oldCert.certificate_number,
        message: "Certificate regenerated. Previous certificate marked as superseded."
      }
    });
  } catch (error) { next(error); }
});

// ─── Preview certificate (HTML) ─────────────────────────────────────────

router.get("/:id/preview", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getCertificateData(req.auth!.schoolId, Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Certificate not found." });
    const html = generateCertificateHtml(data);
    res.type("html").send(html);
  } catch (error) { next(error); }
});

// ─── Download certificate (PDF) ─────────────────────────────────────────

router.get("/:id/download", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getCertificateData(req.auth!.schoolId, Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Certificate not found." });

    const pdfBuffer = await generateCertificatePdf(data);
    const filename = `${data.type}_certificate_${data.certificateNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});

// ─── Get certificate versions/history ───────────────────────────────────

router.get("/:id/history", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  try {
    const [certCheck] = await query(
      "SELECT id FROM v2_certificates WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!certCheck[0]) return res.status(404).json({ message: "Certificate not found." });

    const [rows] = await query(
      `SELECT a.action_name action, a.metadata_json metadata, a.created_at createdAt, u.name userName
       FROM v2_audit_events a LEFT JOIN v2_users u ON u.id = a.user_id
       WHERE a.entity_type = 'certificate' AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Verify certificate (public) ────────────────────────────────────────

router.get("/verify/:certificateNumber", async (req, res, next) => {
  try {
    const [rows] = await query(
      `SELECT c.certificate_type, c.certificate_number, c.issued_date, c.status,
              c.academic_year academicYear, c.qr_code_data qrCode,
              s.full_name studentName, s.admission_no admissionNo,
              a.class_admitted className, a.section_name sectionName,
              sc.name schoolName, sc.city schoolCity
       FROM v2_certificates c
       JOIN v2_students s ON s.id = c.student_id
       LEFT JOIN v2_admissions a ON a.student_id = s.id
       JOIN v2_schools sc ON sc.id = c.school_id
       WHERE c.certificate_number = ?`,
      [req.params.certificateNumber]
    );
    if (!rows[0]) return res.status(404).json({ valid: false, message: "Certificate not found." });

    // Serve HTML verification page for browser requests
    const accept = req.headers.accept || "";
    if (accept.includes("text/html")) {
      const cert = rows[0];
      const statusColor = cert.status === "issued" ? "#059669" : cert.status === "revoked" ? "#dc2626" : "#d97706";
      const issueDate = cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify Certificate — ${cert.certificate_number}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3ee;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.08);max-width:480px;width:100%;overflow:hidden}
.header{background:#173f35;color:#fff;padding:28px;text-align:center}
.header h1{font-size:18px;margin-bottom:4px}.header p{opacity:.7;font-size:13px}
.status-bar{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;font-weight:700;font-size:15px}
.status-dot{width:10px;height:10px;border-radius:50%;background:${statusColor}}
.details{padding:0 28px 28px}
.detail-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
.detail-row strong{color:#19352e}.detail-row span{color:#6d7c77}
.footer{text-align:center;padding:16px;background:#f9fafb;font-size:11px;color:#9ca3af}
</style></head><body>
<div class="card">
<div class="header"><h1>${cert.schoolName}</h1><p>${cert.schoolCity || ""}</p></div>
<div class="status-bar"><span class="status-dot"></span>Certificate ${cert.status === "issued" ? "Verified ✓" : cert.status === "revoked" ? "Revoked ✗" : "Pending"}</div>
<div class="details">
<div class="detail-row"><strong>Certificate No</strong><span>${cert.certificate_number}</span></div>
<div class="detail-row"><strong>Type</strong><span>${cert.certificate_type} Certificate</span></div>
<div class="detail-row"><strong>Student</strong><span>${cert.studentName}</span></div>
<div class="detail-row"><strong>Admission No</strong><span>${cert.admissionNo}</span></div>
<div class="detail-row"><strong>Class</strong><span>${cert.className}${cert.sectionName ? ` · ${cert.sectionName}` : ""}</span></div>
${cert.academicYear ? `<div class="detail-row"><strong>Academic Year</strong><span>${cert.academicYear}</span></div>` : ""}
<div class="detail-row"><strong>Date of Issue</strong><span>${issueDate}</span></div>
</div>
<div class="footer">Montessori School Management · Automated Verification</div>
</div></body></html>`;
      res.type("html").send(html);
    } else {
      res.json({ valid: true, data: rows[0] });
    }
  } catch (error) { next(error); }
});

// ─── Revoke certificate ─────────────────────────────────────────────────

router.patch("/:id/revoke", requirePermission("certificate.generate"), async (req: AuthRequest, res, next) => {
  try {
    const [existing] = await query(
      "SELECT id, status FROM v2_certificates WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    if (!existing[0]) return res.status(404).json({ message: "Certificate not found." });
    if (existing[0].status === "revoked") return res.status(422).json({ message: "Certificate is already revoked." });

    await query(
      "UPDATE v2_certificates SET status = 'revoked' WHERE id = ? AND school_id = ?",
      [req.params.id, req.auth!.schoolId]
    );
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name)
       VALUES (?, ?, 'certificate', ?, 'certificate.revoke')`,
      [req.auth!.schoolId, req.auth!.userId, req.params.id]
    );
    res.json({ data: { message: "Certificate revoked." } });
  } catch (error) { next(error); }
});

// ─── Get certificate templates ──────────────────────────────────────────

router.get("/templates", requirePermission("certificate.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT id, certificate_type type, template_name name, header_text headerText, footer_text footerText, is_active isActive FROM v2_certificate_templates WHERE school_id = ?",
      [req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

export default router;
