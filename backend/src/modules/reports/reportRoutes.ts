/**
 * Module 9: Reports
 * Student, fee, certificate, financial, event, and document reports
 * with CSV export and date-range filtering.
 */

import { Router } from "express";
import { z } from "zod";
import { getPool, query } from "../../database/pool.js";
import { requirePermission } from "../../security/permissions.js";
import type { AuthRequest } from "../../types/auth.js";
import type { RowDataPacket } from "mysql2/promise";

const router = Router();

function toCsv(rows: any[] | undefined): string {
  if (!rows || !rows.length) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(",");
  const lines = rows.map(row =>
    cols.map(c => {
      const v = row[c];
      return `"${String(v ?? "").replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

function sendCsv(res: any, data: any[] | undefined, filename: string) {
  const csv = toCsv(data);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  res.send(csv);
}

function parseDateRange(req: any) {
  const from = req.query.from ? String(req.query.from).trim() : null;
  const to = req.query.to ? String(req.query.to).trim() : null;
  return { from, to };
}

function applyDateFilter(conditions: string[], params: any[], from: string | null, to: string | null, dateCol: string) {
  if (from) {
    conditions.push(`${dateCol} >= ?`);
    params.push(from);
  }
  if (to) {
    conditions.push(`${dateCol} <= ?`);
    params.push(to);
  }
}

// ─── Student enrollment report ───

router.get("/students/enrollment", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["s.school_id = ?", "s.deleted_at IS NULL"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "a.admission_date");
    const [rows] = await query(
      `SELECT a.class_admitted className, s.current_status status, COUNT(*) count
       FROM v2_students s JOIN v2_admissions a ON a.student_id = s.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY a.class_admitted, s.current_status ORDER BY a.class_admitted`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/students/enrollment/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["s.school_id = ?", "s.deleted_at IS NULL"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "a.admission_date");
    const [rows] = await query(
      `SELECT a.class_admitted className, s.current_status status, COUNT(*) count
       FROM v2_students s JOIN v2_admissions a ON a.student_id = s.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY a.class_admitted, s.current_status ORDER BY a.class_admitted`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "enrollment-report");
  } catch (error) { next(error); }
});

// ─── Student status report ───

router.get("/students/status", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["school_id = ?", "deleted_at IS NULL"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "updated_at");
    const [rows] = await query(
      `SELECT current_status status, COUNT(*) count FROM v2_students
       WHERE ${conditions.join(" AND ")} GROUP BY current_status`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/students/status/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["school_id = ?", "deleted_at IS NULL"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "updated_at");
    const [rows] = await query(
      `SELECT current_status status, COUNT(*) count FROM v2_students
       WHERE ${conditions.join(" AND ")} GROUP BY current_status`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "status-report");
  } catch (error) { next(error); }
});

// ─── Fee collection report ───

router.get("/fees/collection", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || new Date().getFullYear() + "-" + (new Date().getFullYear() % 100 + 1)).trim();
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["p.school_id = ?", "p.academic_year = ?"];
    const params: any[] = [req.auth!.schoolId, year];
    applyDateFilter(conditions, params, from, to, "p.payment_date");
    const [rows] = await query(
      `SELECT fc.name categoryName, COUNT(*) transactions, SUM(p.amount) totalCollected
       FROM v2_fee_payments p JOIN v2_fee_categories fc ON fc.id = p.fee_category_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY fc.name ORDER BY totalCollected DESC`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/fees/collection/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || new Date().getFullYear() + "-" + (new Date().getFullYear() % 100 + 1)).trim();
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["p.school_id = ?", "p.academic_year = ?"];
    const params: any[] = [req.auth!.schoolId, year];
    applyDateFilter(conditions, params, from, to, "p.payment_date");
    const [rows] = await query(
      `SELECT fc.name categoryName, COUNT(*) transactions, SUM(p.amount) totalCollected
       FROM v2_fee_payments p JOIN v2_fee_categories fc ON fc.id = p.fee_category_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY fc.name ORDER BY totalCollected DESC`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "fee-collection-report");
  } catch (error) { next(error); }
});

// ─── Certificate report ───

router.get("/certificates", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "created_at");
    const [rows] = await query(
      `SELECT certificate_type type, status, COUNT(*) count
       FROM v2_certificates WHERE ${conditions.join(" AND ")}
       GROUP BY certificate_type, status`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/certificates/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "created_at");
    const [rows] = await query(
      `SELECT certificate_type type, status, COUNT(*) count
       FROM v2_certificates WHERE ${conditions.join(" AND ")}
       GROUP BY certificate_type, status`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "certificate-report");
  } catch (error) { next(error); }
});

// ─── Financial summary ───

router.get("/financial/summary", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  const date = String(req.query.date || new Date().toISOString().split("T")[0]).trim();
  try {
    const [income] = await query(
      "SELECT SUM(amount) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_date = ? AND entry_type = 'income'",
      [req.auth!.schoolId, date]
    );
    const [expense] = await query(
      "SELECT SUM(amount) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_date = ? AND entry_type = 'expense'",
      [req.auth!.schoolId, date]
    );
    res.json({ data: { date, income: Number(income[0]?.total || 0), expense: Number(expense[0]?.total || 0), net: Number(income[0]?.total || 0) - Number(expense[0]?.total || 0) } });
  } catch (error) { next(error); }
});

router.get("/financial/summary/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["school_id = ?", "entry_type = ?"];
    const params: any[] = [req.auth!.schoolId, "income"];
    applyDateFilter(conditions, params, from, to, "entry_date");
    const [incomeRows] = await query(
      `SELECT entry_date date, SUM(amount) total
       FROM v2_daily_cashbook WHERE ${conditions.join(" AND ")}
       GROUP BY entry_date ORDER BY entry_date`,
      params
    );
    const conditions2 = ["school_id = ?", "entry_type = ?"];
    const params2: any[] = [req.auth!.schoolId, "expense"];
    applyDateFilter(conditions2, params2, from, to, "entry_date");
    const [expenseRows] = await query(
      `SELECT entry_date date, SUM(amount) total
       FROM v2_daily_cashbook WHERE ${conditions2.join(" AND ")}
       GROUP BY entry_date ORDER BY entry_date`,
      params2
    );
    const merged: Record<string, any> = {};
    for (const r of incomeRows as any[]) {
      merged[r.date] = { date: r.date, income: Number(r.total), expense: 0, net: Number(r.total) };
    }
    for (const r of expenseRows as any[]) {
      if (!merged[r.date]) merged[r.date] = { date: r.date, income: 0, expense: 0, net: 0 };
      merged[r.date].expense = Number(r.total);
      merged[r.date].net = merged[r.date].income - merged[r.date].expense;
    }
    sendCsv(res, Object.values(merged), "financial-summary");
  } catch (error) { next(error); }
});

// ─── Event report ───

router.get("/events/summary", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["e.school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "e.start_date");
    const [rows] = await query(
      `SELECT e.event_type type, e.status, COUNT(*) count
       FROM v2_events e WHERE ${conditions.join(" AND ")}
       GROUP BY e.event_type, e.status ORDER BY e.event_type`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/events/summary/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["e.school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "e.start_date");
    const [rows] = await query(
      `SELECT e.event_type type, e.status, COUNT(*) count
       FROM v2_events e WHERE ${conditions.join(" AND ")}
       GROUP BY e.event_type, e.status ORDER BY e.event_type`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "event-report");
  } catch (error) { next(error); }
});

// ─── Document report ───

router.get("/documents/summary", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["d.school_id = ?", "d.is_archived = 0"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "d.created_at");
    const [rows] = await query(
      `SELECT dc.name categoryName, COUNT(d.id) count
       FROM v2_document_categories dc
       LEFT JOIN v2_student_documents d ON d.category_code = dc.code AND ${conditions.join(" AND ")}
       GROUP BY dc.name ORDER BY count DESC`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/documents/summary/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["d.school_id = ?", "d.is_archived = 0"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "d.created_at");
    const [rows] = await query(
      `SELECT dc.name categoryName, COUNT(d.id) count
       FROM v2_document_categories dc
       LEFT JOIN v2_student_documents d ON d.category_code = dc.code AND ${conditions.join(" AND ")}
       GROUP BY dc.name ORDER BY count DESC`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "document-report");
  } catch (error) { next(error); }
});

// ─── Dashboard summary ───

router.get("/dashboard", requirePermission("dashboard.view"), async (req: AuthRequest, res, next) => {
  try {
    const [[students]] = await query(
      "SELECT COUNT(*) total, SUM(current_status='active') active FROM v2_students WHERE school_id = ? AND deleted_at IS NULL",
      [req.auth!.schoolId]
    );
    const [[fees]] = await query(
      "SELECT SUM(amount) collected FROM v2_fee_payments WHERE school_id = ? AND payment_date = CURDATE()",
      [req.auth!.schoolId]
    );
    const [[certs]] = await query(
      "SELECT COUNT(*) pending FROM v2_certificates WHERE school_id = ? AND status = 'draft'",
      [req.auth!.schoolId]
    );
    const [[events]] = await query(
      "SELECT COUNT(*) upcoming FROM v2_events WHERE school_id = ? AND start_date > NOW() AND status = 'published'",
      [req.auth!.schoolId]
    );
    const [[docs]] = await query(
      "SELECT COUNT(*) uploaded FROM v2_student_documents WHERE school_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
      [req.auth!.schoolId]
    );
    res.json({
      data: {
        totalStudents: Number(students?.total || 0),
        activeStudents: Number(students?.active || 0),
        todayCollected: Number(fees?.collected || 0),
        pendingCertificates: Number(certs?.pending || 0),
        upcomingEvents: Number(events?.upcoming || 0),
        documentsUploaded: Number(docs?.uploaded || 0)
      }
    });
  } catch (error) { next(error); }
});

// ─── Attendance Report ───

router.get("/attendance", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const className = req.query.className ? String(req.query.className).trim() : null;
    const conditions = ["a.school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    if (className) {
      conditions.push("ad.class_admitted = ?");
      params.push(className);
    }
    applyDateFilter(conditions, params, from, to, "a.attendance_date");
    const [rows] = await query(
      `SELECT s.full_name studentName, ad.class_admitted className, a.attendance_date date, a.status, a.remarks
       FROM v2_student_attendance a
       JOIN v2_students s ON s.id = a.student_id
       LEFT JOIN v2_admissions ad ON ad.student_id = s.id AND ad.status = 'approved'
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.attendance_date DESC, s.full_name`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/attendance/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const className = req.query.className ? String(req.query.className).trim() : null;
    const conditions = ["a.school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    if (className) {
      conditions.push("ad.class_admitted = ?");
      params.push(className);
    }
    applyDateFilter(conditions, params, from, to, "a.attendance_date");
    const [rows] = await query(
      `SELECT s.full_name studentName, ad.class_admitted className, a.attendance_date date, a.status, a.remarks
       FROM v2_student_attendance a
       JOIN v2_students s ON s.id = a.student_id
       LEFT JOIN v2_admissions ad ON ad.student_id = s.id AND ad.status = 'approved'
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.attendance_date DESC, s.full_name`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "attendance-report");
  } catch (error) { next(error); }
});

router.get("/attendance/summary", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = parseDateRange(req);
    const conditions = ["a.school_id = ?"];
    const params: any[] = [req.auth!.schoolId];
    applyDateFilter(conditions, params, from, to, "a.attendance_date");
    const [rows] = await query(
      `SELECT ad.class_admitted className, a.status, COUNT(*) count
       FROM v2_student_attendance a
       JOIN v2_students s ON s.id = a.student_id
       LEFT JOIN v2_admissions ad ON ad.student_id = s.id AND ad.status = 'approved'
       WHERE ${conditions.join(" AND ")}
       GROUP BY ad.class_admitted, a.status ORDER BY ad.class_admitted`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Staff Report ───

router.get("/staff", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const role = req.query.role ? String(req.query.role).trim() : null;
    const conditions = ["s.school_id = ?", "s.is_active = 1"];
    const params: any[] = [req.auth!.schoolId];
    if (role) {
      conditions.push("s.role = ?");
      params.push(role);
    }
    const [rows] = await query(
      `SELECT s.id, s.employee_id employeeId, s.full_name name, s.role, s.department, s.designation,
              s.phone, s.email, s.join_date joinDate, s.qualification, s.experience_years experienceYears
       FROM v2_staff s WHERE ${conditions.join(" AND ")} ORDER BY s.full_name`,
      params
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/staff/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const role = req.query.role ? String(req.query.role).trim() : null;
    const conditions = ["s.school_id = ?", "s.is_active = 1"];
    const params: any[] = [req.auth!.schoolId];
    if (role) {
      conditions.push("s.role = ?");
      params.push(role);
    }
    const [rows] = await query(
      `SELECT s.employee_id employeeId, s.full_name name, s.role, s.department, s.designation,
              s.phone, s.email, s.join_date joinDate, s.qualification, s.experience_years experienceYears
       FROM v2_staff s WHERE ${conditions.join(" AND ")} ORDER BY s.full_name`,
      params
    );
    sendCsv(res, rows as Record<string, any>[], "staff-report");
  } catch (error) { next(error); }
});

router.get("/staff/summary", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT role, COUNT(*) count FROM v2_staff WHERE school_id = ? AND is_active = 1 GROUP BY role ORDER BY count DESC`,
      [req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

// ─── Parent Report ───

router.get("/parents", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT g.id, g.full_name name, g.relation_type relationType, g.mobile phone, g.email,
              GROUP_CONCAT(DISTINCT s.full_name ORDER BY s.full_name SEPARATOR ', ') children,
              GROUP_CONCAT(DISTINCT ad.class_admitted ORDER BY ad.class_admitted SEPARATOR ', ') classes
       FROM v2_guardians g
       JOIN v2_student_guardians sg ON sg.guardian_id = g.id
       JOIN v2_students s ON s.id = sg.student_id AND s.school_id = ?
       LEFT JOIN v2_admissions ad ON ad.student_id = s.id AND ad.status = 'approved'
       WHERE s.current_status = 'active'
       GROUP BY g.id, g.full_name, g.relation_type, g.mobile, g.email
       ORDER BY g.full_name`,
      [req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.get("/parents/export", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT g.full_name name, g.relation_type relationType, g.mobile phone, g.email,
              GROUP_CONCAT(DISTINCT s.full_name ORDER BY s.full_name SEPARATOR ', ') children,
              GROUP_CONCAT(DISTINCT ad.class_admitted ORDER BY ad.class_admitted SEPARATOR ', ') classes
       FROM v2_guardians g
       JOIN v2_student_guardians sg ON sg.guardian_id = g.id
       JOIN v2_students s ON s.id = sg.student_id AND s.school_id = ?
       LEFT JOIN v2_admissions ad ON ad.student_id = s.id AND ad.status = 'approved'
       WHERE s.current_status = 'active'
       GROUP BY g.id, g.full_name, g.relation_type, g.mobile, g.email
       ORDER BY g.full_name`,
      [req.auth!.schoolId]
    );
    sendCsv(res, rows as Record<string, any>[], "parent-report");
  } catch (error) { next(error); }
});

// ─── Custom Report Builder ───

router.post("/custom", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    source: z.enum(["students", "fees", "attendance", "staff", "events"]),
    columns: z.array(z.string()).min(1),
    filters: z.array(z.object({
      field: z.string(),
      operator: z.enum(["equals", "contains", "greater_than", "less_than", "between"]),
      value: z.any(),
    })).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
    limit: z.number().int().max(1000).optional().default(100),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid report configuration.", errors: parsed.error.issues });

  try {
    const { source, columns, filters, sortBy, sortOrder, limit } = parsed.data;
    const tableMap: Record<string, string> = {
      students: "v2_students",
      fees: "v2_fee_payments",
      attendance: "v2_student_attendance",
      staff: "v2_staff",
      events: "v2_events",
    };
    const table = tableMap[source];
    if (!table) return res.status(422).json({ message: `Invalid report source: ${source}` });
    const columnMap: Record<string, Record<string, string>> = {
      students: { id: "s.id", name: "s.full_name", admissionNo: "s.admission_no", status: "s.current_status", gender: "s.gender" },
      fees: { id: "p.id", amount: "p.amount", paymentDate: "p.payment_date", paymentMode: "p.payment_mode", receiptNumber: "p.receipt_number" },
      attendance: { id: "a.id", date: "a.attendance_date", status: "a.status", remarks: "a.remarks" },
      staff: { id: "st.id", name: "st.full_name", role: "st.role", department: "st.department", phone: "st.phone" },
      events: { id: "e.id", title: "e.title", type: "e.event_type", status: "e.status", startDate: "e.start_date" },
    };
    const selectCols = columns.map(c => columnMap[source]?.[c] || c);
    let sql = `SELECT ${selectCols.join(", ")} FROM ${table}`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (source === "students" || source === "fees" || source === "attendance" || source === "events") {
      conditions.push(`${table.includes("v2_student") ? "school_id" : "school_id"} = ?`);
      params.push(req.auth!.schoolId);
    } else if (source === "staff") {
      conditions.push("school_id = ?");
      params.push(req.auth!.schoolId);
    }

    if (filters) {
      for (const f of filters) {
        const col = columnMap[source]?.[f.field] || f.field;
        if (f.operator === "equals") { conditions.push(`${col} = ?`); params.push(f.value); }
        else if (f.operator === "contains") { conditions.push(`${col} LIKE ?`); params.push(`%${f.value}%`); }
        else if (f.operator === "greater_than") { conditions.push(`${col} > ?`); params.push(f.value); }
        else if (f.operator === "less_than") { conditions.push(`${col} < ?`); params.push(f.value); }
        else if (f.operator === "between") { conditions.push(`${col} BETWEEN ? AND ?`); params.push(f.value[0], f.value[1]); }
      }
    }

    if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
    if (sortBy) {
      const sortCol = columnMap[source]?.[sortBy] || sortBy;
      sql += ` ORDER BY ${sortCol} ${sortOrder === "desc" ? "DESC" : "ASC"}`;
    }
    sql += ` LIMIT ${limit}`;

    const [rows] = await query(sql, params);
    res.json({ data: { source, columns, count: (rows as any[]).length, rows } });
  } catch (error) { next(error); }
});

// ─── Saved Reports CRUD ───

router.get("/saved", requirePermission("report.view"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      "SELECT id, report_name name, report_type type, config_json config, is_shared shared, created_at createdAt FROM v2_saved_reports WHERE school_id = ? ORDER BY created_at DESC",
      [req.auth!.schoolId]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
});

router.post("/saved", requirePermission("report.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    name: z.string().min(1).max(200),
    type: z.string().min(1).max(100),
    config: z.any(),
    shared: z.boolean().optional().default(false),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide report name, type, and config." });
  try {
    const { name, type, config, shared } = parsed.data;
    const [result] = await query(
      "INSERT INTO v2_saved_reports (school_id, report_name, report_type, config_json, created_by, is_shared) VALUES (?, ?, ?, ?, ?, ?)",
      [req.auth!.schoolId, name, type, JSON.stringify(config), req.auth!.userId, shared ? 1 : 0]
    );
    res.status(201).json({ data: { id: (result as any).insertId, message: "Report saved." } });
  } catch (error) { next(error); }
});

router.put("/saved/:id", requirePermission("report.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    name: z.string().min(1).max(200).optional(),
    config: z.any().optional(),
    shared: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid update data." });
  try {
    const { name, config, shared } = parsed.data;
    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push("report_name = ?"); params.push(name); }
    if (config !== undefined) { updates.push("config_json = ?"); params.push(JSON.stringify(config)); }
    if (shared !== undefined) { updates.push("is_shared = ?"); params.push(shared ? 1 : 0); }
    if (!updates.length) return res.status(422).json({ message: "Nothing to update." });
    params.push(req.auth!.schoolId, req.params.id);
    await query(`UPDATE v2_saved_reports SET ${updates.join(", ")} WHERE school_id = ? AND id = ?`, params);
    res.json({ data: { message: "Report updated." } });
  } catch (error) { next(error); }
});

router.delete("/saved/:id", requirePermission("report.manage"), async (req: AuthRequest, res, next) => {
  try {
    await query("DELETE FROM v2_saved_reports WHERE school_id = ? AND id = ?", [req.auth!.schoolId, req.params.id]);
    res.json({ data: { message: "Report deleted." } });
  } catch (error) { next(error); }
});

export default router;
