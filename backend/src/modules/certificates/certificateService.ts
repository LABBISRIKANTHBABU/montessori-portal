/**
 * Certificate Service
 * 
 * Handles certificate generation, PDF rendering, preview HTML, and QR verification.
 * Uses PDFKit for PDF generation with watermarks, QR codes, and school branding.
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getPool, query } from "../../database/pool.js";
import { storeFile, resolveStoragePath } from "../../storage/storageService.js";
import type { RowDataPacket } from "mysql2/promise";

export type CertificateType = "transfer" | "study" | "bonafide" | "conduct" | "fee" | "participation" | "achievement";

export interface CertificateData {
  id: number;
  certificateNumber: string;
  type: CertificateType;
  issuedDate: string;
  academicYear?: string;
  status: string;
  studentName: string;
  admissionNo: string;
  studentUid: string;
  className: string;
  sectionName?: string;
  boardCode?: string;
  dateOfBirth?: string;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  schoolName: string;
  schoolCity?: string;
  reason?: string;
  issuedByName: string;
  qrCodeData: string;
  qrCodeImage?: string;
}

const CERT_PREFIXES: Record<string, string> = {
  transfer: "TC", study: "STU", bonafide: "BON", conduct: "CON",
  fee: "FEE", participation: "PAR", achievement: "ACH"
};

const CERT_TYPE_LABELS: Record<string, string> = {
  transfer: "TRANSFER CERTIFICATE",
  study: "STUDY CERTIFICATE",
  bonafide: "BONAFIDE CERTIFICATE",
  conduct: "CONDUCT CERTIFICATE",
  fee: "FEE CERTIFICATE",
  participation: "PARTICIPATION CERTIFICATE",
  achievement: "ACHIEVEMENT CERTIFICATE"
};

export async function getCertificateData(schoolId: number, certId: number): Promise<CertificateData | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT c.*, s.full_name studentName, s.admission_no admissionNo, s.student_uid studentUid,
            s.date_of_birth dateOfBirth, s.gender,
            a.class_admitted className, a.section_name sectionName, a.board_code boardCode,
            sc.name schoolName, sc.city schoolCity,
            u.name issuedByName
     FROM v2_certificates c
     JOIN v2_students s ON s.id = c.student_id
     LEFT JOIN v2_admissions a ON a.student_id = s.id
     JOIN v2_schools sc ON sc.id = c.school_id
     JOIN v2_users u ON u.id = c.issued_by
     WHERE c.id = ? AND c.school_id = ?`,
    [certId, schoolId]
  );
  if (!rows[0]) return null;

  const cert = rows[0];

  // Get parents
  const [guardians] = await getPool().execute<RowDataPacket[]>(
    `SELECT g.full_name, g.relation_type FROM v2_guardians g
     JOIN v2_student_guardians sg ON sg.guardian_id = g.id
     WHERE sg.student_id = ? ORDER BY sg.is_primary DESC`,
    [cert.student_id]
  );
  const father = guardians.find((g: any) => g.relation_type === "father");
  const mother = guardians.find((g: any) => g.relation_type === "mother");

  // Generate QR code image
  const qrCodeDataUrl = await QRCode.toDataURL(cert.qr_code_data || `https://montessori.edu/verify/${schoolId}/${cert.certificate_number}`, {
    width: 120, margin: 1, color: { dark: "#19352e", light: "#ffffff" }
  });

  return {
    id: cert.id,
    certificateNumber: cert.certificate_number,
    type: cert.certificate_type,
    issuedDate: cert.issued_date?.toISOString?.()?.split("T")[0] || String(cert.issued_date),
    academicYear: cert.academic_year || undefined,
    status: cert.status,
    studentName: cert.studentName,
    admissionNo: cert.admissionNo,
    studentUid: cert.studentUid,
    className: cert.className || "",
    sectionName: cert.sectionName || "",
    boardCode: cert.boardCode || "",
    dateOfBirth: cert.dateOfBirth?.toISOString?.()?.split("T")[0] || String(cert.dateOfBirth || ""),
    gender: cert.gender || "",
    fatherName: father?.full_name || "",
    motherName: mother?.full_name || "",
    schoolName: cert.schoolName,
    schoolCity: cert.schoolCity || "",
    reason: cert.reason || "",
    issuedByName: cert.issuedByName,
    qrCodeData: cert.qr_code_data || "",
    qrCodeImage: qrCodeDataUrl,
  };
}

export function generateCertificateHtml(data: CertificateData): string {
  const typeLabel = CERT_TYPE_LABELS[data.type] || "CERTIFICATE";
  const issueDate = new Date(data.issuedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  let bodyContent = "";

  switch (data.type) {
    case "transfer":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) was a student of <strong>${data.schoolName}</strong>, studying in Class <strong>${data.className}</strong>${data.sectionName ? `, Section ${data.sectionName}` : ""} during the academic year <strong>${data.academicYear || "—"}</strong>.</p>
        <p>The student has been duly enrolled in this school and has paid all fees due. The student's conduct and character during the period of study was <strong>satisfactory</strong>.</p>
        <p>The student is now leaving the school due to personal reasons. We wish the student all the best in future endeavors.</p>
        ${data.reason ? `<p><strong>Reason for leaving:</strong> ${data.reason}</p>` : ""}
        <p>The Transfer Certificate is issued upon the request of the parent/guardian.</p>
      `;
      break;
    case "study":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) is a bonafide student of <strong>${data.schoolName}</strong>, studying in Class <strong>${data.className}</strong>${data.sectionName ? `, Section ${data.sectionName}` : ""} for the academic year <strong>${data.academicYear || "—"}</strong>.</p>
        <p>The student's conduct and character during the period of study has been <strong>good</strong>.</p>
        <p>This certificate is issued for the purpose of <strong>${data.reason || "general requirements"}</strong>.</p>
      `;
      break;
    case "bonafide":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) is a bonafide student of <strong>${data.schoolName}</strong>, studying in Class <strong>${data.className}</strong>${data.sectionName ? `, Section ${data.sectionName}` : ""}.</p>
        <p>The student's date of birth is <strong>${data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}</strong>.</p>
        <p>This certificate is issued for the purpose of <strong>${data.reason || "general requirements"}</strong>.</p>
      `;
      break;
    case "conduct":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) has been a student of <strong>${data.schoolName}</strong>, studying in Class <strong>${data.className}</strong>${data.sectionName ? `, Section ${data.sectionName}` : ""} during the academic year <strong>${data.academicYear || "—"}</strong>.</p>
        <p>The conduct and character of the student during the period of study has been <strong>exemplary</strong>. The student has been regular in attendance, disciplined, and has shown good moral character.</p>
        <p>This certificate is issued at the request of the student/parent.</p>
      `;
      break;
    case "fee":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) has paid all the prescribed fees for the academic year <strong>${data.academicYear || "—"}</strong> at <strong>${data.schoolName}</strong>.</p>
        <p>The student has cleared all outstanding dues and is eligible for continuation of studies / issue of other certificates.</p>
      `;
      break;
    case "participation":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) of Class <strong>${data.className}</strong> has participated in <strong>${data.reason || "the school event"}</strong> organized by <strong>${data.schoolName}</strong>.</p>
        <p>The student has shown enthusiasm and commitment in the said activity.</p>
      `;
      break;
    case "achievement":
      bodyContent = `
        <p>This is to certify that <strong>${data.studentName}</strong> (Admission No: ${data.admissionNo}) of Class <strong>${data.className}</strong> has achieved <strong>${data.reason || "academic excellence"}</strong> at <strong>${data.schoolName}</strong>.</p>
        <p>We congratulate the student on this remarkable achievement.</p>
      `;
      break;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${typeLabel} — ${data.certificateNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f5f3ee; display: flex; justify-content: center; padding: 40px 20px; }
  .certificate {
    width: 800px; min-height: 560px; background: #fff;
    border: 3px solid #173f35; border-radius: 4px;
    padding: 50px 60px; position: relative; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  }
  .certificate::before {
    content: ''; position: absolute; inset: 8px;
    border: 1px solid #dcd8cc; border-radius: 2px; pointer-events: none;
  }
  .watermark {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72px; font-weight: 800; color: rgba(23,63,53,0.04);
    letter-spacing: 12px; white-space: nowrap; pointer-events: none; z-index: 0;
  }
  .header { text-align: center; margin-bottom: 28px; position: relative; z-index: 1; }
  .school-name { font-family: 'Playfair Display', serif; font-size: 26px; color: #173f35; margin-bottom: 2px; }
  .school-city { font-size: 12px; color: #6d7c77; letter-spacing: 0.15em; text-transform: uppercase; }
  .cert-title {
    font-family: 'Playfair Display', serif; font-size: 22px; color: #19352e;
    text-align: center; margin: 20px 0 24px; padding-bottom: 12px;
    border-bottom: 2px solid #173f35; display: inline-block;
    letter-spacing: 0.08em;
  }
  .cert-number { text-align: right; font-size: 11px; color: #6d7c77; margin-bottom: 16px; }
  .body { font-size: 14px; line-height: 1.8; color: #19352e; position: relative; z-index: 1; }
  .body p { margin-bottom: 14px; }
  .body strong { color: #173f35; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 1; }
  .signature-block { text-align: center; min-width: 160px; }
  .signature-line { border-top: 1px solid #19352e; width: 160px; margin: 0 auto 6px; }
  .signature-label { font-size: 11px; color: #6d7c77; }
  .signature-name { font-size: 12px; font-weight: 600; color: #19352e; }
  .qr-section { text-align: center; }
  .qr-section img { width: 80px; height: 80px; }
  .qr-section small { display: block; font-size: 9px; color: #6d7c77; margin-top: 4px; }
  .date-line { font-size: 12px; color: #6d7c77; text-align: right; margin-top: 20px; }
  .seal { position: absolute; bottom: 60px; right: 60px; width: 90px; height: 90px; border-radius: 50%; border: 2px solid rgba(23,63,53,0.15); display: grid; place-items: center; font-size: 8px; color: rgba(23,63,53,0.3); text-transform: uppercase; letter-spacing: 0.1em; transform: rotate(-15deg); z-index: 0; }
  @media print { body { background: none; padding: 0; } .certificate { box-shadow: none; border-width: 2px; } }
</style>
</head>
<body>
<div class="certificate">
  <div class="watermark">${data.schoolName}</div>
  <div class="header">
    <div class="school-name">${data.schoolName}</div>
    <div class="school-city">${data.schoolCity}</div>
  </div>
  <div style="text-align:center"><span class="cert-title">${typeLabel}</span></div>
  <div class="cert-number">Certificate No: <strong>${data.certificateNumber}</strong></div>
  <div class="body">
    ${bodyContent}
  </div>
  <div class="date-line">Date of Issue: ${issueDate}</div>
  <div class="footer">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${data.issuedByName}</div>
      <div class="signature-label">Authorized Signatory</div>
    </div>
    <div class="qr-section">
      <img src="${data.qrCodeImage}" alt="QR Code" />
      <small>Scan to verify</small>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">Principal</div>
      <div class="signature-label">${data.schoolName}</div>
    </div>
  </div>
  <div class="seal">Official<br>Certificate</div>
</div>
</body>
</html>`;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const typeLabel = CERT_TYPE_LABELS[data.type] || "CERTIFICATE";
    const issueDate = new Date(data.issuedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    // Border
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(2).stroke("#173f35");
    doc.rect(36, 36, doc.page.width - 72, doc.page.height - 72).lineWidth(0.5).stroke("#dcd8cc");

    // Watermark
    doc.save();
    doc.translate(doc.page.width / 2, doc.page.height / 2).rotate(-35)
       .font("Helvetica-Bold").fontSize(60).fillColor("#173f35", 0.04)
       .text(data.schoolName, -200, -20, { width: 400, align: "center" });
    doc.restore();

    // School name
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#173f35")
       .text(data.schoolName, 50, 60, { width: doc.page.width - 100, align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor("#6d7c77")
       .text(data.schoolCity || "", { align: "center" });

    // Certificate title
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#19352e")
       .text(typeLabel, { align: "center", underline: true });
    doc.moveDown(0.3);

    // Certificate number
    doc.font("Helvetica").fontSize(9).fillColor("#6d7c77")
       .text(`Certificate No: ${data.certificateNumber}`, { align: "right" });
    doc.moveDown(0.5);

    // Body content
    doc.font("Helvetica").fontSize(11).fillColor("#19352e");
    const bodyText = getBodyText(data);
    doc.text(bodyText, 60, doc.y, { width: doc.page.width - 120, lineGap: 4 });
    doc.moveDown(1);

    // Date
    doc.font("Helvetica").fontSize(10).fillColor("#6d7c77")
       .text(`Date of Issue: ${issueDate}`, { align: "right" });
    doc.moveDown(2);

    // Signatures
    const footerY = doc.y;
    // Left signature
    doc.moveTo(60, footerY + 30).lineTo(200, footerY + 30).lineWidth(0.5).stroke("#19352e");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#19352e").text(data.issuedByName, 60, footerY + 34, { width: 140, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor("#6d7c77").text("Authorized Signatory", 60, footerY + 46, { width: 140, align: "center" });

    // Right signature
    doc.moveTo(doc.page.width - 200, footerY + 30).lineTo(doc.page.width - 60, footerY + 30).lineWidth(0.5).stroke("#19352e");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#19352e").text("Principal", doc.page.width - 200, footerY + 34, { width: 140, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor("#6d7c77").text(data.schoolName, doc.page.width - 200, footerY + 46, { width: 140, align: "center" });

    // QR Code
    if (data.qrCodeImage) {
      try {
        const qrBuffer = Buffer.from(data.qrCodeImage!.split(",")[1] ?? "", "base64");
        doc.image(qrBuffer, doc.page.width / 2 - 35, footerY + 5, { width: 70, height: 70 });
        doc.font("Helvetica").fontSize(7).fillColor("#6d7c77").text("Scan to verify", doc.page.width / 2 - 35, footerY + 78, { width: 70, align: "center" });
      } catch { /* QR generation failed, skip */ }
    }

    // Seal
    doc.save();
    doc.translate(doc.page.width - 110, doc.page.height - 110).rotate(-15)
       .circle(0, 0, 35).lineWidth(1).stroke("#173f3580")
       .font("Helvetica").fontSize(7).fillColor("#173f3580")
       .text("OFFICIAL", -20, -8, { width: 40, align: "center" })
       .text("CERTIFICATE", -20, 2, { width: 40, align: "center" });
    doc.restore();

    doc.end();
  });
}

function getBodyText(data: CertificateData): string {
  const issueDate = new Date(data.issuedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const dob = data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

  switch (data.type) {
    case "transfer":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) was a student of ${data.schoolName}, studying in Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""} during the academic year ${data.academicYear || "—"}. The student has been duly enrolled and has paid all fees due. The student's conduct and character during the period of study was satisfactory. The student is now leaving the school. The Transfer Certificate is issued upon the request of the parent/guardian.${data.reason ? ` Reason for leaving: ${data.reason}.` : ""}`;
    case "study":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) is a bonafide student of ${data.schoolName}, studying in Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""} for the academic year ${data.academicYear || "—"}. The student's conduct and character during the period of study has been good. This certificate is issued for the purpose of ${data.reason || "general requirements"}.`;
    case "bonafide":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) is a bonafide student of ${data.schoolName}, studying in Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""}. The student's date of birth is ${dob}. This certificate is issued for the purpose of ${data.reason || "general requirements"}.`;
    case "conduct":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) has been a student of ${data.schoolName}, studying in Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""} during the academic year ${data.academicYear || "—"}. The conduct and character of the student during the period of study has been exemplary. The student has been regular in attendance, disciplined, and has shown good moral character.`;
    case "fee":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) has paid all the prescribed fees for the academic year ${data.academicYear || "—"} at ${data.schoolName}. The student has cleared all outstanding dues.`;
    case "participation":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) of Class ${data.className} has participated in ${data.reason || "the school event"} organized by ${data.schoolName}. The student has shown enthusiasm and commitment.`;
    case "achievement":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) of Class ${data.className} has achieved ${data.reason || "academic excellence"} at ${data.schoolName}. We congratulate the student on this remarkable achievement.`;
    default:
      return "";
  }
}
