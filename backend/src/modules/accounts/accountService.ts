/**
 * Accounts Service Layer
 * Receipt PDFs, voucher PDFs, CSV/Excel exports, audit logging.
 */

import PDFDocument from "pdfkit";

// ─── Receipt Generation ─────────────────────────────────────────────────

export interface ReceiptData {
  receiptNumber: string;
  studentName: string;
  admissionNo: string;
  className: string;
  academicYear: string;
  categoryName: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  schoolName: string;
  schoolCity: string;
}

export function generateReceiptHtml(data: ReceiptData): string {
  const modeLabel = data.paymentMode === "bank_transfer" ? "Bank Transfer" : data.paymentMode === "upi" ? "UPI" : data.paymentMode.charAt(0).toUpperCase() + data.paymentMode.slice(1);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${data.receiptNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f5f5; padding: 20px; }
  .receipt { max-width: 700px; margin: 0 auto; background: #fff; border: 2px solid #19352e; border-radius: 12px; overflow: hidden; }
  .header { background: #19352e; color: #fff; padding: 28px 32px; text-align: center; }
  .header h1 { font-size: 15px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px; }
  .header .school { font-size: 22px; font-weight: 700; }
  .header .city { font-size: 12px; opacity: 0.8; margin-top: 4px; }
  .receipt-title { text-align: center; padding: 16px; font-size: 18px; font-weight: 700; color: #19352e; border-bottom: 2px solid #e8eee9; background: #f0f7f2; }
  .receipt-number { font-size: 13px; color: #6d7c77; margin-top: 4px; }
  .body { padding: 28px 32px; }
  .row { display: flex; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
  .row:last-child { border-bottom: none; }
  .label { width: 180px; font-size: 12px; font-weight: 700; color: #6d7c77; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { flex: 1; font-size: 14px; color: #1a2e28; }
  .amount-row { background: #f0f7f2; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
  .amount-row .label { width: auto; display: block; font-size: 11px; margin-bottom: 4px; }
  .amount-row .value { font-size: 28px; font-weight: 800; color: #19352e; }
  .footer { padding: 20px 32px; border-top: 2px solid #e8eee9; text-align: center; }
  .footer p { font-size: 11px; color: #999; }
  .footer .note { font-size: 12px; color: #6d7c77; margin-top: 8px; font-style: italic; }
  @media print { body { background: none; padding: 0; } .receipt { border: 2px solid #000; } }
</style></head><body>
<div class="receipt">
  <div class="header">
    <div class="school">${data.schoolName}</div>
    <div class="city">${data.schoolCity}</div>
  </div>
  <div class="receipt-title">
    FEE PAYMENT RECEIPT
    <div class="receipt-number">${data.receiptNumber}</div>
  </div>
  <div class="body">
    <div class="row"><div class="label">Student Name</div><div class="value">${data.studentName}</div></div>
    <div class="row"><div class="label">Admission No.</div><div class="value">${data.admissionNo}</div></div>
    <div class="row"><div class="label">Class</div><div class="value">${data.className}</div></div>
    <div class="row"><div class="label">Academic Year</div><div class="value">${data.academicYear}</div></div>
    <div class="row"><div class="label">Fee Category</div><div class="value">${data.categoryName}</div></div>
    <div class="row"><div class="label">Payment Date</div><div class="value">${new Date(data.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
    <div class="row"><div class="label">Payment Mode</div><div class="value">${modeLabel}</div></div>
    ${data.referenceNumber ? `<div class="row"><div class="label">Reference No.</div><div class="value">${data.referenceNumber}</div></div>` : ""}
    ${data.notes ? `<div class="row"><div class="label">Notes</div><div class="value">${data.notes}</div></div>` : ""}
    <div class="amount-row">
      <div class="label">Amount Paid</div>
      <div class="value">\u20B9${Number(data.amount).toLocaleString("en-IN")}</div>
    </div>
  </div>
  <div class="footer">
    <p>This is a computer-generated receipt and does not require a signature.</p>
    <p class="note">For queries, contact the accounts department of ${data.schoolName}.</p>
  </div>
</div>
</body></html>`;
}

// ─── Voucher Generation ─────────────────────────────────────────────────

export interface VoucherData {
  voucherNumber: string;
  voucherType: string;
  voucherDate: string;
  payeeName?: string;
  amount: number;
  description?: string;
  paymentMode?: string;
  status: string;
  createdByName: string;
  schoolName: string;
  schoolCity: string;
}

export function generateVoucherHtml(data: VoucherData): string {
  const typeLabel = data.voucherType === "payment" ? "PAYMENT VOUCHER" : data.voucherType === "receipt" ? "RECEIPT VOUCHER" : data.voucherType === "journal" ? "JOURNAL VOUCHER" : "EXPENSE VOUCHER";
  const typeColor = data.voucherType === "payment" ? "#dc2626" : data.voucherType === "receipt" ? "#059669" : data.voucherType === "expense" ? "#d97706" : "#3b82f6";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Voucher ${data.voucherNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f5f5; padding: 20px; }
  .voucher { max-width: 700px; margin: 0 auto; background: #fff; border: 2px solid ${typeColor}; border-radius: 12px; overflow: hidden; }
  .header { background: #19352e; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header .school { font-size: 18px; font-weight: 700; }
  .header .city { font-size: 12px; opacity: 0.8; }
  .type-badge { background: ${typeColor}; color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .body { padding: 28px 32px; }
  .row { display: flex; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
  .row:last-child { border-bottom: none; }
  .label { width: 180px; font-size: 12px; font-weight: 700; color: #6d7c77; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { flex: 1; font-size: 14px; color: #1a2e28; }
  .amount-box { background: ${typeColor}10; border: 2px solid ${typeColor}30; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
  .amount-box .label { width: auto; display: block; font-size: 11px; margin-bottom: 4px; color: ${typeColor}; }
  .amount-box .value { font-size: 28px; font-weight: 800; color: ${typeColor}; }
  .status-bar { display: flex; justify-content: space-between; align-items: center; padding: 12px 32px; background: #f8f9fa; border-top: 2px solid #e8eee9; }
  .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .status-badge.approved { background: #d1fae5; color: #059669; }
  .status-badge.pending { background: #fef3c7; color: #d97706; }
  .footer { padding: 16px 32px; text-align: center; }
  .footer p { font-size: 11px; color: #999; }
  @media print { body { background: none; padding: 0; } }
</style></head><body>
<div class="voucher">
  <div class="header">
    <div><div class="school">${data.schoolName}</div><div class="city">${data.schoolCity}</div></div>
    <div class="type-badge">${typeLabel}</div>
  </div>
  <div class="body">
    <div class="row"><div class="label">Voucher No.</div><div class="value" style="font-weight:700">${data.voucherNumber}</div></div>
    <div class="row"><div class="label">Date</div><div class="value">${new Date(data.voucherDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
    ${data.payeeName ? `<div class="row"><div class="label">Payee / Payer</div><div class="value">${data.payeeName}</div></div>` : ""}
    <div class="amount-box">
      <div class="label">Amount</div>
      <div class="value">\u20B9${Number(data.amount).toLocaleString("en-IN")}</div>
    </div>
    ${data.paymentMode ? `<div class="row"><div class="label">Payment Mode</div><div class="value">${data.paymentMode === "bank_transfer" ? "Bank Transfer" : data.paymentMode.toUpperCase()}</div></div>` : ""}
    ${data.description ? `<div class="row"><div class="label">Description</div><div class="value">${data.description}</div></div>` : ""}
    <div class="row"><div class="label">Created By</div><div class="value">${data.createdByName}</div></div>
  </div>
  <div class="status-bar">
    <span style="font-size:12px;color:#6d7c77">Generated on ${new Date().toLocaleDateString("en-IN")}</span>
    <span class="status-badge ${data.status}">${data.status}</span>
  </div>
  <div class="footer"><p>This is a computer-generated voucher.</p></div>
</div>
</body></html>`;
}

// ─── Receipt PDF Generation ─────────────────────────────────────────────

export function generateReceiptPdf(data: ReceiptData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const modeLabel = data.paymentMode === "bank_transfer" ? "Bank Transfer" : data.paymentMode === "upi" ? "UPI" : data.paymentMode.charAt(0).toUpperCase() + data.paymentMode.slice(1);

  // Header
  doc.fontSize(10).fillColor("#6d7c77").text("FEE PAYMENT RECEIPT", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(20).fillColor("#19352e").font("Helvetica-Bold").text(data.schoolName, { align: "center" });
  doc.fontSize(10).fillColor("#6d7c77").font("Helvetica").text(data.schoolCity, { align: "center" });
  doc.moveDown(0.5);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#19352e");
  doc.moveDown(0.5);

  // Receipt number
  doc.fontSize(12).fillColor("#19352e").font("Helvetica-Bold").text(`Receipt: ${data.receiptNumber}`, { align: "center" });
  doc.moveDown(0.8);

  // Details
  const labelX = 60;
  const valueX = 220;
  const lineHeight = 22;

  const details: [string, string][] = [
    ["Student Name", data.studentName],
    ["Admission No.", data.admissionNo],
    ["Class", data.className],
    ["Academic Year", data.academicYear],
    ["Fee Category", data.categoryName],
    ["Payment Date", new Date(data.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
    ["Payment Mode", modeLabel],
  ];
  if (data.referenceNumber) details.push(["Reference No.", data.referenceNumber]);
  if (data.notes) details.push(["Notes", data.notes]);

  for (const [label, value] of details) {
    doc.fontSize(10).fillColor("#6d7c77").font("Helvetica-Bold").text(label, labelX, doc.y, { width: 150 });
    doc.fontSize(10).fillColor("#1a2e28").font("Helvetica").text(value, valueX, doc.y - 13);
    doc.moveDown(0.3);
  }

  doc.moveDown(0.5);

  // Amount box
  const boxY = doc.y;
  doc.roundedRect(150, boxY, 295, 60, 6).fillAndStroke("#f0f7f2", "#19352e");
  doc.fontSize(10).fillColor("#6d7c77").font("Helvetica-Bold").text("AMOUNT PAID", 150, boxY + 14, { align: "center", width: 295 });
  doc.fontSize(22).fillColor("#19352e").font("Helvetica-Bold").text(`\u20B9${Number(data.amount).toLocaleString("en-IN")}`, 150, boxY + 32, { align: "center", width: 295 });
  doc.y = boxY + 75;

  // Footer
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e8eee9");
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#999999").font("Helvetica").text("This is a computer-generated receipt and does not require a signature.", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#6d7c77").text(`For queries, contact the accounts department of ${data.schoolName}.`, { align: "center" });

  return doc;
}

// ─── Voucher PDF Generation ─────────────────────────────────────────────

export function generateVoucherPdf(data: VoucherData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const typeLabel = data.voucherType === "payment" ? "PAYMENT VOUCHER" : data.voucherType === "receipt" ? "RECEIPT VOUCHER" : data.voucherType === "journal" ? "JOURNAL VOUCHER" : "EXPENSE VOUCHER";
  const typeColor = data.voucherType === "payment" ? "#dc2626" : data.voucherType === "receipt" ? "#059669" : data.voucherType === "expense" ? "#d97706" : "#3b82f6";

  // Header
  doc.rect(0, 0, 595.28, 80).fill("#19352e");
  doc.fontSize(16).fillColor("#ffffff").font("Helvetica-Bold").text(data.schoolName, 50, 25, { width: 350 });
  doc.fontSize(10).fillColor("#cccccc").font("Helvetica").text(data.schoolCity, 50, 48);
  doc.fontSize(12).fillColor(typeColor).font("Helvetica-Bold").text(typeLabel, 400, 30, { width: 145, align: "center" });
  doc.y = 100;

  // Voucher details
  const labelX = 60;
  const valueX = 220;

  const details: [string, string][] = [
    ["Voucher No.", data.voucherNumber],
    ["Date", new Date(data.voucherDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
  ];
  if (data.payeeName) details.push(["Payee / Payer", data.payeeName]);
  if (data.paymentMode) details.push(["Payment Mode", data.paymentMode === "bank_transfer" ? "Bank Transfer" : data.paymentMode.toUpperCase()]);
  if (data.description) details.push(["Description", data.description]);
  details.push(["Created By", data.createdByName]);

  for (const [label, value] of details) {
    doc.fontSize(10).fillColor("#6d7c77").font("Helvetica-Bold").text(label, labelX, doc.y, { width: 150 });
    doc.fontSize(10).fillColor("#1a2e28").font("Helvetica").text(value, valueX, doc.y - 13);
    doc.moveDown(0.3);
  }

  doc.moveDown(0.5);

  // Amount box
  const boxY = doc.y;
  doc.roundedRect(150, boxY, 295, 60, 6).fillAndStroke(`${typeColor}15`, typeColor);
  doc.fontSize(10).fillColor(typeColor).font("Helvetica-Bold").text("AMOUNT", 150, boxY + 14, { align: "center", width: 295 });
  doc.fontSize(22).fillColor(typeColor).font("Helvetica-Bold").text(`\u20B9${Number(data.amount).toLocaleString("en-IN")}`, 150, boxY + 32, { align: "center", width: 295 });
  doc.y = boxY + 75;

  // Status
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#6d7c77").font("Helvetica").text(`Status: ${data.status.toUpperCase()}`, 60, doc.y, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#999999").text(`Generated on ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });

  // Footer
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e8eee9");
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#999999").text("This is a computer-generated voucher.", { align: "center" });

  return doc;
}

// ─── CSV Generation ─────────────────────────────────────────────────────

export function generateCsv(headers: string[], rows: any[][]): string {
  const escapeCell = (val: any) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\n");
}
