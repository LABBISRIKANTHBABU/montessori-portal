/**
 * Module 6: Accounts & Fees
 * Fee categories, collections, receipts, daily accounts, suppliers, vouchers,
 * concessions, cash flow reports, exports, and audit trail.
 */

import { Router } from "express";
import { z } from "zod";
import { query } from "../../database/pool.js";
import { requirePermission } from "../../security/permissions.js";
import type { AuthRequest } from "../../types/auth.js";
import {
  listFeeCategories, createFeeCategory, listFeeStructures, createFeeStructure,
  listFeePayments, recordFeePayment, getStudentFeeSummary,
  listCashbook, addCashbookEntry, getAccountsDashboard, getBankBook,
  listSuppliers, createSupplier, listSupplierTransactions, addSupplierTransaction,
  listVouchers, createVoucher, getDailyCollection, getFeeDefaulters,
  getMonthlyCollection, getExpenseReport,
  listConcessions, createConcession, approveConcession, rejectConcession,
  getCashFlowReport, getWeeklyReport, getAnnualReport, getSupplierOutstanding,
  getAuditTrail, getSchoolById,
} from "../../repository.js";
import { generateReceiptHtml, generateVoucherHtml, generateReceiptPdf, generateVoucherPdf, generateCsv } from "./accountService.js";

const router = Router();

// ─── Accounts Dashboard ─────────────────────────────────────────────────

router.get("/dashboard", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getAccountsDashboard(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Fee Categories ──────────────────────────────────────────────────────

router.get("/fee-categories", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await listFeeCategories(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/fee-categories", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ name: z.string().min(1).max(100), description: z.string().max(255).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide a category name." });
  try {
    const id = await createFeeCategory(req.auth!.schoolId, parsed.data.name, parsed.data.description);
    res.status(201).json({ data: { id, message: "Category created." } });
  } catch (error) { next(error); }
});

// ─── Fee Structures ──────────────────────────────────────────────────────

router.get("/fee-structures", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const year = String(req.query.year || "").trim() || undefined;
    const cls = String(req.query.class || "").trim() || undefined;
    const data = await listFeeStructures(req.auth!.schoolId, year, cls);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/fee-structures", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    academicYear: z.string().min(4), className: z.string().min(1),
    feeCategoryId: z.number().int(), amount: z.number().positive(),
    dueDate: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide all required fields." });
  try {
    const id = await createFeeStructure(req.auth!.schoolId, parsed.data);
    res.status(201).json({ data: { id, message: "Fee structure created." } });
  } catch (error) { next(error); }
});

// ─── Fee Payments ────────────────────────────────────────────────────────

router.get("/fee-payments", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const studentId = Number(req.query.studentId || 0) || undefined;
    const year = String(req.query.year || "").trim() || undefined;
    const data = await listFeePayments(req.auth!.schoolId, studentId, year);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/fee-payments", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    studentId: z.number().int(), feeCategoryId: z.number().int(),
    academicYear: z.string().min(4), amount: z.number().positive(),
    paymentMode: z.enum(["cash", "bank_transfer", "upi", "cheque", "card", "other"]),
    paymentDate: z.string(), referenceNumber: z.string().max(100).optional(),
    notes: z.string().max(500).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide all required fields." });
  try {
    const result = await recordFeePayment(req.auth!.schoolId, req.auth!.userId, parsed.data);
    res.status(201).json({ data: { ...result, message: "Payment recorded." } });
  } catch (error) { next(error); }
});

// Fee summary for a student
router.get("/students/:studentId/fees", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || new Date().getFullYear() + "-" + (new Date().getFullYear() % 100 + 1)).trim();
  try {
    const data = await getStudentFeeSummary(req.auth!.schoolId, Number(req.params.studentId), year);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Fee Receipt ────────────────────────────────────────────────────────

router.get("/fee-payments/:id/receipt", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const payments = await listFeePayments(req.auth!.schoolId, undefined, undefined);
    const payment = payments.find((p: any) => p.id === Number(req.params.id));
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    const school = await getSchoolById(req.auth!.schoolId);
    const html = generateReceiptHtml({
      receiptNumber: payment.receiptNumber || `REC-00000`,
      studentName: payment.studentName || "Student",
      admissionNo: (payment as any).admissionNo || "—",
      className: (payment as any).className || "—",
      academicYear: (payment as any).academicYear || "2026–27",
      categoryName: payment.categoryName || "Fee",
      amount: payment.amount,
      paymentMode: payment.paymentMode,
      paymentDate: payment.paymentDate,
      referenceNumber: payment.referenceNumber || undefined,
      notes: payment.notes || undefined,
      schoolName: school?.name || "School",
      schoolCity: school?.city || "",
    });
    res.setHeader("Content-Type", "text/html").send(html);
  } catch (error) { next(error); }
});

router.get("/fee-payments/:id/receipt/preview", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const payments = await listFeePayments(req.auth!.schoolId, undefined, undefined);
    const payment = payments.find((p: any) => p.id === Number(req.params.id));
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    const school = await getSchoolById(req.auth!.schoolId);
    const html = generateReceiptHtml({
      receiptNumber: payment.receiptNumber || `REC-00000`,
      studentName: payment.studentName || "Student",
      admissionNo: (payment as any).admissionNo || "—",
      className: (payment as any).className || "—",
      academicYear: (payment as any).academicYear || "2026–27",
      categoryName: payment.categoryName || "Fee",
      amount: payment.amount,
      paymentMode: payment.paymentMode,
      paymentDate: payment.paymentDate,
      referenceNumber: payment.referenceNumber || undefined,
      notes: payment.notes || undefined,
      schoolName: school?.name || "School",
      schoolCity: school?.city || "",
    });
    res.setHeader("Content-Type", "text/html").send(html);
  } catch (error) { next(error); }
});

// ─── Daily Cashbook ──────────────────────────────────────────────────────

router.get("/cashbook", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const date = String(req.query.date || new Date().toISOString().split("T")[0]).trim();
  try {
    const data = await listCashbook(req.auth!.schoolId, date);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/cashbook", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    entryType: z.enum(["income", "expense"]), category: z.string().min(1),
    description: z.string().min(1).max(500), amount: z.number().positive(),
    paymentMode: z.enum(["cash", "bank_transfer", "upi", "cheque", "other"]),
    referenceNumber: z.string().max(100).optional(), entryDate: z.string()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide all required fields." });
  try {
    const id = await addCashbookEntry(req.auth!.schoolId, req.auth!.userId, parsed.data);
    res.status(201).json({ data: { id, message: "Entry recorded." } });
  } catch (error) { next(error); }
});

// ─── Bank Book ───────────────────────────────────────────────────────────

router.get("/bank-book", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const month = String(req.query.month || "").trim() || undefined;
  try {
    const data = await getBankBook(req.auth!.schoolId, month);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Suppliers ───────────────────────────────────────────────────────────

router.get("/suppliers", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await listSuppliers(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/suppliers", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    name: z.string().min(1).max(200), contactPerson: z.string().max(150).optional(),
    phone: z.string().max(20).optional(), email: z.string().max(190).optional(),
    gstNumber: z.string().max(20).optional(), bankAccountNumber: z.string().max(30).optional(),
    bankIfsc: z.string().max(20).optional(), address: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide supplier name." });
  try {
    const id = await createSupplier(req.auth!.schoolId, parsed.data);
    res.status(201).json({ data: { id, message: "Supplier added." } });
  } catch (error) { next(error); }
});

router.get("/suppliers/:id/transactions", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await listSupplierTransactions(req.auth!.schoolId, Number(req.params.id));
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/suppliers/:id/transactions", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    transactionType: z.enum(["purchase", "payment", "credit", "debit"]),
    amount: z.number().positive(), description: z.string().max(500).optional(),
    referenceNumber: z.string().max(100).optional(), transactionDate: z.string()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide all required fields." });
  try {
    const id = await addSupplierTransaction(req.auth!.schoolId, Number(req.params.id), req.auth!.userId, parsed.data);
    res.status(201).json({ data: { id, message: "Transaction recorded." } });
  } catch (error) { next(error); }
});

router.get("/suppliers/outstanding", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getSupplierOutstanding(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/suppliers/:id/export", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const transactions = await listSupplierTransactions(req.auth!.schoolId, Number(req.params.id));
    const csv = generateCsv(
      ["Date", "Type", "Amount", "Description", "Reference"],
      (transactions as any[]).map(t => [t.transactionDate, t.type, t.amount, t.description || "", t.referenceNumber || ""])
    );
    res.setHeader("Content-Type", "text/csv").setHeader("Content-Disposition", `attachment; filename="supplier_${req.params.id}_ledger.csv"`).send(csv);
  } catch (error) { next(error); }
});

// ─── Vouchers ────────────────────────────────────────────────────────────

router.get("/vouchers", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const type = String(req.query.type || "").trim() || undefined;
  try {
    const data = await listVouchers(req.auth!.schoolId, type);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/vouchers", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    voucherType: z.enum(["payment", "receipt", "journal", "expense"]),
    voucherDate: z.string(), payeeName: z.string().max(200).optional(),
    amount: z.number().positive(), description: z.string().max(500).optional(),
    paymentMode: z.enum(["cash", "bank_transfer", "upi", "cheque", "other"]).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide all required fields." });
  try {
    const result = await createVoucher(req.auth!.schoolId, req.auth!.userId, parsed.data);
    res.status(201).json({ data: { ...result, message: "Voucher created." } });
  } catch (error) { next(error); }
});

router.get("/vouchers/export", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const type = String(req.query.type || "").trim() || undefined;
    const vouchers = await listVouchers(req.auth!.schoolId, type);
    const csv = generateCsv(
      ["Voucher No.", "Type", "Date", "Payee", "Amount", "Mode", "Description", "Status"],
      (vouchers as any[]).map(v => [v.number, v.type, v.date, v.payeeName || "", v.amount, v.paymentMode || "", v.description || "", v.status])
    );
    res.setHeader("Content-Type", "text/csv").setHeader("Content-Disposition", 'attachment; filename="vouchers.csv"').send(csv);
  } catch (error) { next(error); }
});

router.get("/vouchers/:id/preview", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const vouchers = await listVouchers(req.auth!.schoolId);
    const voucher = vouchers.find((v: any) => v.id === Number(req.params.id));
    if (!voucher) return res.status(404).json({ message: "Voucher not found." });
    const school = await getSchoolById(req.auth!.schoolId);
    const html = generateVoucherHtml({
      voucherNumber: voucher.number || "—",
      voucherType: voucher.type,
      voucherDate: voucher.date,
      payeeName: voucher.payeeName || undefined,
      amount: voucher.amount,
      description: voucher.description || undefined,
      paymentMode: voucher.paymentMode || undefined,
      status: voucher.status || "approved",
      createdByName: voucher.createdByName || "System",
      schoolName: school?.name || "School",
      schoolCity: school?.city || "",
    });
    res.setHeader("Content-Type", "text/html").send(html);
  } catch (error) { next(error); }
});

// ─── Fee Concessions ─────────────────────────────────────────────────────

router.get("/concessions", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const studentId = Number(req.query.studentId || 0) || undefined;
  const year = String(req.query.year || "").trim() || undefined;
  try {
    const data = await listConcessions(req.auth!.schoolId, studentId, year);
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/concessions", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    studentId: z.number().int(), feeCategoryId: z.number().int(),
    academicYear: z.string().min(4), amount: z.number().positive(),
    reason: z.string().min(1).max(500),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide all required fields." });
  try {
    const id = await createConcession(req.auth!.schoolId, req.auth!.userId, parsed.data);
    res.status(201).json({ data: { id, message: "Concession request submitted for approval." } });
  } catch (error) { next(error); }
});

router.patch("/concessions/:id/approve", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  try {
    await approveConcession(req.auth!.schoolId, req.auth!.userId, Number(req.params.id));
    res.json({ data: { message: "Concession approved." } });
  } catch (error) { next(error); }
});

router.patch("/concessions/:id/reject", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  try {
    await rejectConcession(req.auth!.schoolId, req.auth!.userId, Number(req.params.id));
    res.json({ data: { message: "Concession rejected." } });
  } catch (error) { next(error); }
});

// ─── Financial Reports ───────────────────────────────────────────────────

router.get("/reports/daily-collection", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const date = String(req.query.date || new Date().toISOString().split("T")[0]).trim();
  try {
    const data = await getDailyCollection(req.auth!.schoolId, date);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/fee-defaulters", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || new Date().getFullYear() + "-" + (new Date().getFullYear() % 100 + 1)).trim();
  try {
    const data = await getFeeDefaulters(req.auth!.schoolId, year);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/fee-defaulters/export", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || "2026–27").trim();
  try {
    const data = await getFeeDefaulters(req.auth!.schoolId, year);
    const csv = generateCsv(
      ["Student", "Admission No.", "Class", "Total Fee", "Paid", "Pending"],
      (data as any[]).map(d => [d.studentName, d.admissionNo, d.className, d.totalFee, d.paid, d.pending])
    );
    res.setHeader("Content-Type", "text/csv").setHeader("Content-Disposition", 'attachment; filename="fee_defaulters.csv"').send(csv);
  } catch (error) { next(error); }
});

router.get("/reports/monthly-collection", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7)).trim();
  try {
    const data = await getMonthlyCollection(req.auth!.schoolId, month);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/expense", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7)).trim();
  try {
    const data = await getExpenseReport(req.auth!.schoolId, month);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/cash-flow", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const startDate = String(req.query.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]).trim();
  const endDate = String(req.query.endDate || new Date().toISOString().split("T")[0]).trim();
  try {
    const data = await getCashFlowReport(req.auth!.schoolId, startDate, endDate);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/weekly", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getWeeklyReport(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/annual", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || "2026").trim();
  try {
    const data = await getAnnualReport(req.auth!.schoolId, year);
    res.json({ data });
  } catch (error) { next(error); }
});

router.get("/reports/cashbook/export", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const date = String(req.query.date || new Date().toISOString().split("T")[0]).trim();
  try {
    const entries = await listCashbook(req.auth!.schoolId, date);
    const csv = generateCsv(
      ["Date", "Type", "Category", "Description", "Amount", "Mode", "Reference", "Recorded By"],
      (entries as any[]).map(e => [e.createdAt, e.entryType, e.category, e.description, e.amount, e.paymentMode, e.referenceNumber || "", e.recordedByName || ""])
    );
    res.setHeader("Content-Type", "text/csv").setHeader("Content-Disposition", `attachment; filename="cashbook_${date}.csv"`).send(csv);
  } catch (error) { next(error); }
});

// ─── Receipt PDF ────────────────────────────────────────────────────────

router.get("/fees/receipt/:id/pdf", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const payments = await listFeePayments(req.auth!.schoolId, undefined, undefined);
    const payment = payments.find((p: any) => p.id === Number(req.params.id));
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    const school = await getSchoolById(req.auth!.schoolId);
    const doc = generateReceiptPdf({
      receiptNumber: payment.receiptNumber || `REC-00000`,
      studentName: payment.studentName || "Student",
      admissionNo: (payment as any).admissionNo || "—",
      className: (payment as any).className || "—",
      academicYear: (payment as any).academicYear || "2026–27",
      categoryName: payment.categoryName || "Fee",
      amount: payment.amount,
      paymentMode: payment.paymentMode,
      paymentDate: payment.paymentDate,
      referenceNumber: payment.referenceNumber || undefined,
      notes: payment.notes || undefined,
      schoolName: school?.name || "School",
      schoolCity: school?.city || "",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt_${payment.receiptNumber || req.params.id}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) { next(error); }
});

// ─── Voucher PDF ────────────────────────────────────────────────────────

router.get("/vouchers/:id/pdf", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  try {
    const vouchers = await listVouchers(req.auth!.schoolId);
    const voucher = vouchers.find((v: any) => v.id === Number(req.params.id));
    if (!voucher) return res.status(404).json({ message: "Voucher not found." });
    const school = await getSchoolById(req.auth!.schoolId);
    const doc = generateVoucherPdf({
      voucherNumber: voucher.number || "—",
      voucherType: voucher.type,
      voucherDate: voucher.date,
      payeeName: voucher.payeeName || undefined,
      amount: voucher.amount,
      description: voucher.description || undefined,
      paymentMode: voucher.paymentMode || undefined,
      status: voucher.status || "approved",
      createdByName: voucher.createdByName || "System",
      schoolName: school?.name || "School",
      schoolCity: school?.city || "",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="voucher_${voucher.number || req.params.id}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (error) { next(error); }
});

// ─── Balance Sheet ──────────────────────────────────────────────────────

router.get("/reports/balance-sheet", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const asOfDate = String(req.query.asOfDate || new Date().toISOString().split("T")[0]).trim();
  try {
    const [feeIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_fee_payments WHERE school_id = ? AND payment_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [cashExpense] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND entry_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [cashIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'income' AND entry_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [supplierPayments] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_supplier_transactions WHERE school_id = ? AND transaction_type = 'payment' AND transaction_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const totalFeeIncome = Number((feeIncome as any[])[0]?.total || 0);
    const totalCashIncome = Number((cashIncome as any[])[0]?.total || 0);
    const totalCashExpense = Number((cashExpense as any[])[0]?.total || 0);
    const totalSupplierPayments = Number((supplierPayments as any[])[0]?.total || 0);
    const totalIncome = totalFeeIncome + totalCashIncome;
    const totalExpenses = totalCashExpense + totalSupplierPayments;
    const netSurplus = totalIncome - totalExpenses;

    res.json({
      data: {
        asOfDate,
        assets: {
          cashAndBank: totalIncome - totalExpenses,
          feeReceivable: 0,
          total: totalIncome - totalExpenses,
        },
        liabilities: {
          supplierPayable: totalSupplierPayments,
          otherLiabilities: 0,
          total: totalSupplierPayments,
        },
        equity: {
          accumulatedSurplus: netSurplus,
          total: netSurplus,
        },
        summary: { totalIncome, totalExpenses, netSurplus },
      },
    });
  } catch (error) { next(error); }
});

// ─── Profit & Loss ──────────────────────────────────────────────────────

router.get("/reports/profit-loss", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const startDate = String(req.query.startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]).trim();
  const endDate = String(req.query.endDate || new Date().toISOString().split("T")[0]).trim();
  try {
    const [feeIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_fee_payments WHERE school_id = ? AND payment_date BETWEEN ? AND ?",
      [req.auth!.schoolId, startDate, endDate]
    );
    const [cashIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'income' AND entry_date BETWEEN ? AND ?",
      [req.auth!.schoolId, startDate, endDate]
    );
    const [cashExpense] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND entry_date BETWEEN ? AND ?",
      [req.auth!.schoolId, startDate, endDate]
    );
    const [supplierPayments] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_supplier_transactions WHERE school_id = ? AND transaction_type = 'payment' AND transaction_date BETWEEN ? AND ?",
      [req.auth!.schoolId, startDate, endDate]
    );
    const [expenseByCategory] = await query(
      "SELECT category, SUM(amount) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND entry_date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC",
      [req.auth!.schoolId, startDate, endDate]
    );

    const totalFeeIncome = Number((feeIncome as any[])[0]?.total || 0);
    const totalCashIncome = Number((cashIncome as any[])[0]?.total || 0);
    const totalCashExpense = Number((cashExpense as any[])[0]?.total || 0);
    const totalSupplierPayments = Number((supplierPayments as any[])[0]?.total || 0);
    const totalIncome = totalFeeIncome + totalCashIncome;
    const totalExpenses = totalCashExpense + totalSupplierPayments;
    const netProfit = totalIncome - totalExpenses;

    res.json({
      data: {
        period: { startDate, endDate },
        income: {
          feeCollection: totalFeeIncome,
          otherIncome: totalCashIncome,
          total: totalIncome,
        },
        expenses: {
          operatingExpenses: totalCashExpense,
          supplierPayments: totalSupplierPayments,
          total: totalExpenses,
          breakdown: expenseByCategory,
        },
        netProfit,
      },
    });
  } catch (error) { next(error); }
});

// ─── Trial Balance ──────────────────────────────────────────────────────

router.get("/reports/trial-balances", requirePermission("account.view"), async (req: AuthRequest, res, next) => {
  const asOfDate = String(req.query.asOfDate || new Date().toISOString().split("T")[0]).trim();
  try {
    const [feeIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_fee_payments WHERE school_id = ? AND payment_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [cashIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'income' AND entry_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [cashExpense] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND entry_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [supplierPurchases] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_supplier_transactions WHERE school_id = ? AND transaction_type = 'purchase' AND transaction_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [supplierPayments] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_supplier_transactions WHERE school_id = ? AND transaction_type = 'payment' AND transaction_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [voucherPayments] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_vouchers WHERE school_id = ? AND voucher_type IN ('payment','expense') AND voucher_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );
    const [voucherReceipts] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_vouchers WHERE school_id = ? AND voucher_type = 'receipt' AND voucher_date <= ?",
      [req.auth!.schoolId, asOfDate]
    );

    const totalFeeIncome = Number((feeIncome as any[])[0]?.total || 0);
    const totalCashIncome = Number((cashIncome as any[])[0]?.total || 0);
    const totalCashExpense = Number((cashExpense as any[])[0]?.total || 0);
    const totalSupplierPurchases = Number((supplierPurchases as any[])[0]?.total || 0);
    const totalSupplierPayments = Number((supplierPayments as any[])[0]?.total || 0);
    const totalVoucherPayments = Number((voucherPayments as any[])[0]?.total || 0);
    const totalVoucherReceipts = Number((voucherReceipts as any[])[0]?.total || 0);

    const accounts = [
      { account: "Fee Income", type: "credit", balance: totalFeeIncome },
      { account: "Cash Income", type: "credit", balance: totalCashIncome },
      { account: "Voucher Receipts", type: "credit", balance: totalVoucherReceipts },
      { account: "Cash Expenses", type: "debit", balance: totalCashExpense },
      { account: "Supplier Purchases", type: "debit", balance: totalSupplierPurchases },
      { account: "Supplier Payments", type: "debit", balance: totalSupplierPayments },
      { account: "Voucher Payments", type: "debit", balance: totalVoucherPayments },
    ];

    const totalDebits = accounts.filter(a => a.type === "debit").reduce((sum, a) => sum + a.balance, 0);
    const totalCredits = accounts.filter(a => a.type === "credit").reduce((sum, a) => sum + a.balance, 0);

    res.json({
      data: {
        asOfDate,
        accounts,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    });
  } catch (error) { next(error); }
});

// ─── Fiscal Year Close ──────────────────────────────────────────────────

router.post("/fiscal-year/close", requirePermission("account.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    fiscalYear: z.string().min(4),
    closingDate: z.string(),
    carryForward: z.boolean().optional().default(true),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide fiscal year and closing date." });
  try {
    const { fiscalYear, closingDate, carryForward } = parsed.data;
    const [yearIncome] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_fee_payments WHERE school_id = ? AND academic_year = ?",
      [req.auth!.schoolId, fiscalYear]
    );
    const [yearExpense] = await query(
      "SELECT COALESCE(SUM(amount), 0) total FROM v2_daily_cashbook WHERE school_id = ? AND entry_type = 'expense' AND entry_date <= ?",
      [req.auth!.schoolId, closingDate]
    );
    const totalIncome = Number((yearIncome as any[])[0]?.total || 0);
    const totalExpenses = Number((yearExpense as any[])[0]?.total || 0);
    const netSurplus = totalIncome - totalExpenses;

    // Record closing entry in cashbook
    if (carryForward && netSurplus !== 0) {
      await query(
        `INSERT INTO v2_daily_cashbook (school_id, entry_date, entry_type, category, description, amount, payment_mode, recorded_by)
         VALUES (?, ?, 'income', 'Fiscal Year Close', ?, ?, 'bank_transfer', ?)`,
        [req.auth!.schoolId, closingDate, `Carry forward from ${fiscalYear}`, Math.abs(netSurplus), req.auth!.userId]
      );
    }

    res.json({
      data: {
        message: `Fiscal year ${fiscalYear} closed successfully.`,
        closingDate,
        totalIncome,
        totalExpenses,
        netSurplus,
        carryForwardApplied: carryForward && netSurplus !== 0,
      },
    });
  } catch (error) { next(error); }
});

// ─── Audit Trail ─────────────────────────────────────────────────────────

router.get("/audit", requirePermission("account.audit"), async (req: AuthRequest, res, next) => {
  const entityType = String(req.query.entityType || "").trim() || undefined;
  const limit = Number(req.query.limit || 50);
  try {
    const data = await getAuditTrail(req.auth!.schoolId, entityType, limit);
    res.json({ data });
  } catch (error) { next(error); }
});

export default router;
