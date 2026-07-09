/**
 * Certificate Service
 *
 * Handles certificate preview HTML and PDF rendering.
 * TC and Study/Conduct certificates use the official school templates supplied
 * by the client. Remaining certificate types keep the generic certificate shell
 * until their official templates are provided.
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getPool } from "../../database/pool.js";
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
  dateOfAdmission?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  religion?: string;
  caste?: string;
  subCaste?: string;
  motherTongue?: string;
  fatherName?: string;
  motherName?: string;
  previousSchoolClass?: string;
  previousTcNo?: string;
  classLeaving?: string;
  dateOfLeaving?: string;
  leavingTcNo?: string;
  tcTakenDate?: string;
  residenceAddress?: string;
  schoolName: string;
  schoolCity?: string;
  reason?: string;
  issuedByName: string;
  qrCodeData: string;
  qrCodeImage?: string;
}

const CERT_TYPE_LABELS: Record<string, string> = {
  transfer: "TRANSFER CERTIFICATE",
  study: "STUDY & CONDUCT CERTIFICATE",
  bonafide: "BONAFIDE CERTIFICATE",
  conduct: "CONDUCT CERTIFICATE",
  fee: "FEE CERTIFICATE",
  participation: "PARTICIPATION CERTIFICATE",
  achievement: "ACHIEVEMENT CERTIFICATE"
};

export async function getCertificateData(schoolId: number, certId: number): Promise<CertificateData | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT c.*, s.full_name studentName, s.admission_no admissionNo, s.student_uid studentUid,
            s.date_of_birth dateOfBirth, s.gender, s.nationality, s.religion, s.caste,
            s.sub_caste subCaste, s.mother_tongue motherTongue,
            a.class_admitted className, a.section_name sectionName, a.board_code boardCode,
            a.admission_date dateOfAdmission, a.previous_school_class previousSchoolClass,
            a.previous_tc_no previousTcNo, y.name admissionAcademicYear,
            l.class_leaving classLeaving, l.date_of_leaving dateOfLeaving,
            l.tc_number leavingTcNo, l.tc_taken_date tcTakenDate,
            addr.full_address residenceAddress,
            sc.name schoolName, sc.city schoolCity,
            u.name issuedByName
     FROM v2_certificates c
     JOIN v2_students s ON s.id = c.student_id
     LEFT JOIN v2_admissions a ON a.student_id = s.id AND a.school_id = s.school_id
     LEFT JOIN v2_academic_years y ON y.id = a.academic_year_id
     LEFT JOIN v2_student_leaving_records l ON l.student_id = s.id AND l.school_id = s.school_id
     LEFT JOIN v2_student_addresses addr ON addr.student_id = s.id AND addr.address_type = 'residential'
     JOIN v2_schools sc ON sc.id = c.school_id
     JOIN v2_users u ON u.id = c.issued_by
     WHERE c.id = ? AND c.school_id = ?`,
    [certId, schoolId]
  );
  if (!rows[0]) return null;

  const cert = rows[0];
  const [guardians] = await getPool().execute<RowDataPacket[]>(
    `SELECT g.full_name, g.relation_type
     FROM v2_guardians g
     JOIN v2_student_guardians sg ON sg.guardian_id = g.id
     WHERE sg.student_id = ?
     ORDER BY sg.is_primary DESC`,
    [cert.student_id]
  );
  const father = guardians.find((g: any) => g.relation_type === "father");
  const mother = guardians.find((g: any) => g.relation_type === "mother");

  const qrCodeData = cert.qr_code_data || `https://montessorischools.in/api/certificates/verify/${cert.certificate_number}`;
  const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
    width: 120,
    margin: 1,
    color: { dark: "#111111", light: "#ffffff" }
  });

  return {
    id: cert.id,
    certificateNumber: cert.certificate_number,
    type: cert.certificate_type,
    issuedDate: toIsoDate(cert.issued_date),
    academicYear: cert.academic_year || cert.admissionAcademicYear || undefined,
    status: cert.status,
    studentName: cert.studentName || "",
    admissionNo: cert.admissionNo || "",
    studentUid: cert.studentUid || "",
    className: cert.className || "",
    sectionName: cert.sectionName || "",
    boardCode: cert.boardCode || "",
    dateOfAdmission: toIsoDate(cert.dateOfAdmission),
    dateOfBirth: toIsoDate(cert.dateOfBirth),
    gender: cert.gender || "",
    nationality: cert.nationality || "",
    religion: cert.religion || "",
    caste: cert.caste || "",
    subCaste: cert.subCaste || "",
    motherTongue: cert.motherTongue || "",
    fatherName: father?.full_name || "",
    motherName: mother?.full_name || "",
    previousSchoolClass: cert.previousSchoolClass || "",
    previousTcNo: cert.previousTcNo || "",
    classLeaving: cert.classLeaving || "",
    dateOfLeaving: toIsoDate(cert.dateOfLeaving),
    leavingTcNo: cert.leavingTcNo || "",
    tcTakenDate: toIsoDate(cert.tcTakenDate),
    residenceAddress: cert.residenceAddress || "",
    schoolName: cert.schoolName || "",
    schoolCity: cert.schoolCity || "",
    reason: cert.reason || "",
    issuedByName: cert.issuedByName || "",
    qrCodeData,
    qrCodeImage: qrCodeDataUrl
  };
}

export function generateCertificateHtml(data: CertificateData): string {
  if (data.type === "transfer") return generateTransferCertificateHtml(data);
  if (data.type === "study") return generateStudyCertificateHtml(data);
  return generateGenericCertificateHtml(data);
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (data.type === "transfer") drawTransferCertificatePdf(doc, data);
    else if (data.type === "study") drawStudyCertificatePdf(doc, data);
    else drawGenericCertificatePdf(doc, data);

    doc.end();
  });
}

function generateStudyCertificateHtml(data: CertificateData): string {
  const profile = schoolProfile(data);
  const genderWord = heShe(data, "He / She");
  const childOf = data.fatherName || data.motherName || "—";
  const joinedYear = data.dateOfAdmission ? new Date(data.dateOfAdmission).getFullYear().toString() : firstYear(data.academicYear);
  const leftClass = data.classLeaving || data.className || "—";
  const studyYears = yearsBetween(data.dateOfAdmission, data.dateOfLeaving) || "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Study & Conduct Certificate - ${escapeHtml(data.certificateNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { background-color: #555; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; margin: 0; padding: 20px; }
  .certificate-outer { background-color: #fcfcfc; width: 880px; padding: 3px; border: 3px solid #1a1a1a; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
  .certificate-inner { border: 1px solid #1a1a1a; padding: 30px 40px 50px; position: relative; min-height: 620px; }
  .header { position: relative; text-align: center; margin-bottom: 10px; }
  .logo-container { position: absolute; top: -10px; left: 0; text-align: center; width: 140px; }
  .logo-container img { width: 74px; height: 74px; object-fit: contain; }
  .logo-text-cursive { font-family: "Brush Script MT", "Lucida Handwriting", cursive; font-size: 20px; color: #000; margin-top: -8px; line-height: 1; }
  .logo-text-estd { font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; margin-top: 2px; }
  .school-name { font-family: "Times New Roman", Times, serif; font-size: 46px; font-weight: 900; margin: 0; letter-spacing: 1px; color: #1a1a1a; }
  .school-sub { font-family: "Times New Roman", Times, serif; font-size: 22px; font-weight: 900; margin: 5px 0 2px; color: #1a1a1a; white-space: pre-line; }
  .school-affiliation { font-family: "Times New Roman", Times, serif; font-size: 15px; font-weight: bold; margin: 0; color: #1a1a1a; }
  .admn-no-container { text-align: right; font-family: Arial, sans-serif; font-weight: bold; font-size: 16px; margin: 12px 0 15px; }
  .cert-title { text-align: center; font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; text-decoration: underline; text-underline-offset: 4px; margin-bottom: 35px; }
  .body-content { font-family: Arial, Helvetica, sans-serif; font-size: 17.5px; font-weight: bold; line-height: 2.3; color: #1a1a1a; text-align: justify; }
  .line-value { display: inline-block; border-bottom: 1.5px solid #1a1a1a; margin: 0 4px; transform: translateY(-2px); min-height: 21px; padding: 0 8px; text-align: center; line-height: 1.25; }
  .l-1 { width: 520px; } .l-2 { width: 545px; } .l-3 { width: 235px; } .l-4 { width: 420px; }
  .l-5 { width: 100px; } .l-6 { width: 110px; } .l-7 { width: 160px; } .l-8 { width: 100px; } .l-9 { width: 150px; }
  .indent { display: inline-block; width: 45px; }
  .footer { display: flex; justify-content: space-between; margin-top: 60px; font-family: Arial, sans-serif; font-weight: bold; font-size: 18px; }
  .qr { position: absolute; right: 38px; bottom: 28px; text-align: center; font: 9px Arial, sans-serif; color: #333; }
  .qr img { width: 56px; height: 56px; display: block; margin-bottom: 3px; }
  @media print { body { background: none; padding: 0; } .certificate-outer { box-shadow: none; width: 100%; border-width: 3px; } }
</style>
</head>
<body>
  <div class="certificate-outer">
    <div class="certificate-inner">
      <div class="header">
        <div class="logo-container">
          <img src="/montessori-golden-jubilee-logo.jpeg" alt="Montessori logo">
          <div class="logo-text-cursive">montessori</div>
          <div class="logo-text-estd">Estd. 1976</div>
        </div>
        <h1 class="school-name">MONTESSORI</h1>
        <h2 class="school-sub">${escapeHtml(profile.studyHeader)}</h2>
        <p class="school-affiliation">${escapeHtml(profile.affiliation)}</p>
      </div>
      <div class="admn-no-container">Admn. No. <span class="line-value" style="width: 120px;">${escapeHtml(data.admissionNo)}</span></div>
      <div class="cert-title">STUDY &amp; CONDUCT CERTIFICATE</div>
      <div class="body-content">
        <span class="indent"></span>This is to certify that <span class="line-value l-1">${escapeHtml(data.studentName)}</span><br>
        Son/ Daughter of Sri <span class="line-value l-2">${escapeHtml(childOf)}</span><br>
        studied in this institution in Class / Classes <span class="line-value l-3">${escapeHtml(data.className || "—")}</span> during the year<br>
        <span class="line-value l-4">${escapeHtml(data.academicYear || "—")}</span>. ${escapeHtml(genderWord)} joined this Institution in<br>
        Class <span class="line-value l-5">${escapeHtml(data.className || "—")}</span> in <span class="line-value l-6">${escapeHtml(joinedYear)}</span> and left this institution in <span class="line-value l-7">${escapeHtml(data.dateOfLeaving ? formatDate(data.dateOfLeaving) : "—")}</span> after completing<br>
        <span class="line-value l-8">${escapeHtml(leftClass)}</span> class. His / Her period of study in this institution is <span class="line-value l-9">${escapeHtml(studyYears)}</span> years.<br>
        His / Her conduct during this period has been satisfactory.
      </div>
      <div class="footer"><div>Date: ${escapeHtml(formatDate(data.issuedDate))}</div><div>Principal.</div></div>
      <div class="qr"><img src="${data.qrCodeImage}" alt="Verify QR">Verify</div>
    </div>
  </div>
</body>
</html>`;
}

function generateTransferCertificateHtml(data: CertificateData): string {
  const profile = schoolProfile(data);
  const dob = data.dateOfBirth ? `${formatDate(data.dateOfBirth)} / ${dateInWords(data.dateOfBirth)}` : "—";
  const nationalReligion = [data.nationality, data.religion].filter(Boolean).join(" / ") || "—";
  const caste = [data.caste, data.subCaste].filter(Boolean).join(" / ") || "—";
  const lastClass = data.classLeaving || data.className || "—";
  const reason = data.reason || "Parent / Guardian request";

  const row = (n: string, label: string, value: string) => `
    <tr><td class="col-num">${n}</td><td class="col-text">${escapeHtml(label)}</td><td class="col-colon">:</td><td class="col-input"><span>${escapeHtml(value || "—")}</span></td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transfer Certificate - ${escapeHtml(data.certificateNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { background-color: #e0e0e0; font-family: "Times New Roman", Times, serif; display: flex; justify-content: center; padding: 30px; margin: 0; }
  .certificate-container { background-color: #fff; width: 210mm; min-height: 297mm; padding: 15mm 20mm; box-shadow: 0 0 15px rgba(0,0,0,0.2); position: relative; color: #000; }
  .header { text-align: center; margin-bottom: 25px; position: relative; }
  .original-text { position: absolute; top: 0; right: 0; font-size: 10px; font-weight: bold; }
  .logo { position: absolute; top: 0; left: 0; width: 74px; height: 74px; }
  .logo img { width: 74px; height: 74px; object-fit: contain; }
  h1 { font-size: 22px; font-weight: 900; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
  .motto { font-size: 11px; font-style: italic; margin: 3px 0; font-weight: bold; }
  .affiliation, .address { font-size: 10px; margin: 2px 0; }
  .title-section { margin-top: 15px; }
  .tc-header { text-decoration: underline; font-weight: bold; font-size: 16px; text-transform: uppercase; }
  .serial-number { color: #c00; font-size: 18px; font-weight: bold; display: block; margin-top: 5px; }
  .top-meta { display: flex; justify-content: space-between; margin-top: 20px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px; }
  td { padding: 3px 0; vertical-align: bottom; }
  .col-num { width: 30px; vertical-align: top; padding-top: 6px; }
  .col-text { width: 45%; vertical-align: top; padding-top: 6px; padding-right: 5px; }
  .col-colon { width: 15px; text-align: center; vertical-align: top; padding-top: 6px; }
  .col-input { border-bottom: 1px solid #000; height: 24px; }
  .col-input span { display: inline-block; padding-left: 6px; font-weight: bold; }
  .subject-row { display: flex; justify-content: space-between; width: 100%; }
  .sub-item { width: 32%; display: flex; }
  .sub-label { margin-right: 5px; }
  .sub-line { border-bottom: 1px solid #000; flex-grow: 1; height: 16px; }
  .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 13px; font-weight: bold; }
  .footer-left { text-align: left; width: 30%; } .footer-center { text-align: center; width: 40%; } .footer-right { text-align: right; width: 30%; line-height: 1.4; }
  .sub-text { font-weight: normal; font-size: 11px; display: block; margin-top: 2px; }
  .qr { position: absolute; right: 18mm; bottom: 10mm; text-align: center; font: 9px Arial, sans-serif; color: #333; }
  .qr img { width: 52px; height: 52px; display: block; margin-bottom: 3px; }
  @media print { body { background: none; padding: 0; } .certificate-container { box-shadow: none; margin: 0; width: 100%; min-height: 100%; } }
</style>
</head>
<body>
<div class="certificate-container">
  <div class="header">
    <div class="original-text">ORIGINAL</div>
    <div class="logo"><img src="/montessori-golden-jubilee-logo.jpeg" alt="Montessori logo"></div>
    <h1>${escapeHtml(profile.transferHeader)}</h1>
    <div class="motto">Help the child to Help Himself</div>
    <div class="affiliation">${escapeHtml(profile.affiliation)}</div>
    <div class="address">${escapeHtml(profile.address)}</div>
    <div class="title-section"><div class="tc-header">TRANSFER CERTIFICATE</div><div class="serial-number">${escapeHtml(data.leavingTcNo || data.certificateNumber)}</div></div>
  </div>
  <div class="top-meta">
    <div>Book No...........................</div>
    <div>Sl.No. ${escapeHtml(data.certificateNumber)}</div>
    <div>Admission No. ${escapeHtml(data.admissionNo)}</div>
  </div>
  <table>
    ${row("1.", "Name of Pupil", data.studentName)}
    ${row("2.", "Father's / Guardian's Name", data.fatherName || "—")}
    ${row("3.", "Mother's Name", data.motherName || "—")}
    ${row("4.", "Nationality & Religion", nationalReligion)}
    ${row("5.", "Whether the candidate belongs to SC or ST", caste)}
    ${row("6.", "Date of first admission in the school with class", `${formatDate(data.dateOfAdmission)} with Class ${data.className || "—"}`)}
    ${row("7.", "Date of Birth (in Christian Era) according to Admission Register (in figures) (in words)", dob)}
    ${row("8.", "Class in which the pupil last studied (in figures) & (in words)", `${lastClass} / ${classInWords(lastClass)}`)}
    ${row("9.", "School/Board Annual examination last taken with result", data.boardCode || "—")}
    ${row("10.", "Whether failed, if so once/twice in the same class", "No")}
    <tr><td class="col-num">11.</td><td class="col-text">Subjects Studied</td><td class="col-colon">:</td><td><div class="subject-row"><div class="sub-item"><span class="sub-label">1.</span><span class="sub-line"></span></div><div class="sub-item"><span class="sub-label">2.</span><span class="sub-line"></span></div><div class="sub-item"><span class="sub-label">3.</span><span class="sub-line"></span></div></div></td></tr>
    <tr><td class="col-num"></td><td class="col-text"></td><td class="col-colon">:</td><td><div class="subject-row"><div class="sub-item"><span class="sub-label">4.</span><span class="sub-line"></span></div><div class="sub-item"><span class="sub-label">5.</span><span class="sub-line"></span></div><div class="sub-item"><span class="sub-label">6.</span><span class="sub-line"></span></div></div></td></tr>
    ${row("12.", "Whether qualified for promotion to the higher class", "Yes")}
    ${row("", "If so, to which class (In figure) (in words)", "—")}
    ${row("13.", "Month upto which the (pupil has paid) school dues paid", "—")}
    ${row("14.", "Any fee concession availed of if so, the nature of such concession", "—")}
    ${row("15.", "Total No. of working days", "—")}
    ${row("16.", "Total No. of working days present", "—")}
    ${row("17.", "Whether NCC Cadet / Boy Scout / Girl Guide (details may be given)", "—")}
    ${row("18.", "Games played or extra-curricular activities in which the pupil usually took part (mention achievement level here in)", "—")}
    ${row("19.", "General conduct", "Satisfactory")}
    ${row("20.", "Date of application for certificate", formatDate(data.tcTakenDate || data.issuedDate))}
    ${row("21.", "Date of issue of certificate", formatDate(data.issuedDate))}
    ${row("22.", "Reasons for leaving the school", reason)}
    ${row("23.", "Any other remarks", data.previousTcNo ? `Previous TC No: ${data.previousTcNo}` : "—")}
  </table>
  <div class="footer"><div class="footer-left">Signature of Class Teacher</div><div class="footer-center">Checked by<span class="sub-text">(State full name and designation)</span></div><div class="footer-right">Principal<br>Seal</div></div>
  <div class="qr"><img src="${data.qrCodeImage}" alt="Verify QR">Verify</div>
</div>
</body>
</html>`;
}

function generateGenericCertificateHtml(data: CertificateData): string {
  const typeLabel = CERT_TYPE_LABELS[data.type] || "CERTIFICATE";
  const issueDate = formatLongDate(data.issuedDate);
  const bodyText = getBodyText(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(typeLabel)} - ${escapeHtml(data.certificateNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, "Times New Roman", serif; background: #f5f3ee; display: flex; justify-content: center; padding: 40px 20px; }
  .certificate { width: 800px; min-height: 560px; background: #fff; border: 3px solid #173f35; padding: 50px 60px; position: relative; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08); }
  .certificate::before { content: ''; position: absolute; inset: 8px; border: 1px solid #dcd8cc; pointer-events: none; }
  .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 72px; font-weight: 800; color: rgba(23,63,53,0.04); letter-spacing: 12px; white-space: nowrap; pointer-events: none; z-index: 0; }
  .header { text-align: center; margin-bottom: 28px; position: relative; z-index: 1; }
  .school-name { font-size: 26px; color: #173f35; margin-bottom: 2px; font-weight: 700; }
  .school-city { font-size: 12px; color: #6d7c77; letter-spacing: 0.15em; text-transform: uppercase; }
  .cert-title { font-size: 22px; color: #19352e; text-align: center; margin: 20px 0 24px; padding-bottom: 12px; border-bottom: 2px solid #173f35; display: inline-block; letter-spacing: 0.08em; }
  .cert-number { text-align: right; font-size: 11px; color: #6d7c77; margin-bottom: 16px; }
  .body { font-size: 15px; line-height: 1.9; color: #19352e; position: relative; z-index: 1; }
  .footer { margin-top: 46px; display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 1; }
  .signature-block { text-align: center; min-width: 160px; }
  .signature-line { border-top: 1px solid #19352e; width: 160px; margin: 0 auto 6px; }
  .signature-label { font-size: 11px; color: #6d7c77; }
  .signature-name { font-size: 12px; font-weight: 600; color: #19352e; }
  .qr-section { text-align: center; }
  .qr-section img { width: 80px; height: 80px; }
  .date-line { font-size: 12px; color: #6d7c77; text-align: right; margin-top: 24px; }
  @media print { body { background: none; padding: 0; } .certificate { box-shadow: none; } }
</style>
</head>
<body>
<div class="certificate">
  <div class="watermark">${escapeHtml(data.schoolName)}</div>
  <div class="header"><div class="school-name">${escapeHtml(data.schoolName)}</div><div class="school-city">${escapeHtml(data.schoolCity || "")}</div></div>
  <div style="text-align:center"><span class="cert-title">${escapeHtml(typeLabel)}</span></div>
  <div class="cert-number">Certificate No: <strong>${escapeHtml(data.certificateNumber)}</strong></div>
  <div class="body">${escapeHtml(bodyText)}</div>
  <div class="date-line">Date of Issue: ${escapeHtml(issueDate)}</div>
  <div class="footer">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-name">${escapeHtml(data.issuedByName)}</div><div class="signature-label">Authorized Signatory</div></div>
    <div class="qr-section"><img src="${data.qrCodeImage}" alt="QR Code"><small>Scan to verify</small></div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-name">Principal</div><div class="signature-label">${escapeHtml(data.schoolName)}</div></div>
  </div>
</div>
</body>
</html>`;
}

function drawStudyCertificatePdf(doc: PDFKit.PDFDocument, data: CertificateData) {
  const profile = schoolProfile(data);
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(2).stroke("#111111");
  doc.rect(36, 36, doc.page.width - 72, doc.page.height - 72).lineWidth(0.5).stroke("#111111");

  doc.font("Times-Bold").fontSize(34).fillColor("#111111").text("MONTESSORI", 60, 56, { align: "center" });
  doc.fontSize(16).text(profile.studyHeader, 110, 98, { width: doc.page.width - 220, align: "center" });
  doc.fontSize(10).text(profile.affiliation, 110, 138, { width: doc.page.width - 220, align: "center" });
  doc.font("Helvetica-Bold").fontSize(10).text("Admn. No.", 410, 168);
  lineText(doc, data.admissionNo, 470, 168, 90);
  doc.font("Helvetica-Bold").fontSize(14).text("STUDY & CONDUCT CERTIFICATE", 0, 204, { align: "center", underline: true });

  const childOf = data.fatherName || data.motherName || "—";
  const joinedYear = data.dateOfAdmission ? new Date(data.dateOfAdmission).getFullYear().toString() : firstYear(data.academicYear);
  const leftClass = data.classLeaving || data.className || "—";
  const studyYears = yearsBetween(data.dateOfAdmission, data.dateOfLeaving) || "—";

  let y = 260;
  doc.font("Helvetica-Bold").fontSize(12);
  textWithLine(doc, "This is to certify that", data.studentName, 75, y, 380); y += 32;
  textWithLine(doc, "Son/ Daughter of Sri", childOf, 75, y, 390); y += 32;
  textWithLine(doc, "studied in this institution in Class / Classes", data.className || "—", 75, y, 190); y += 32;
  textWithLine(doc, "during the year", data.academicYear || "—", 75, y, 300); y += 32;
  textWithLine(doc, `${heShe(data, "He / She")} joined this Institution in Class`, data.className || "—", 75, y, 90);
  textWithLine(doc, "in", joinedYear, 390, y, 80); y += 32;
  textWithLine(doc, "and left this institution in", data.dateOfLeaving ? formatDate(data.dateOfLeaving) : "—", 75, y, 180); y += 32;
  textWithLine(doc, "after completing", leftClass, 75, y, 100);
  textWithLine(doc, "class. His / Her period of study in this institution is", studyYears, 250, y, 90); y += 32;
  doc.text("His / Her conduct during this period has been satisfactory.", 75, y);
  doc.text(`Date: ${formatDate(data.issuedDate)}`, 75, 710);
  doc.text("Principal.", 430, 710);
  drawQr(doc, data, 278, 700, 58);
}

function drawTransferCertificatePdf(doc: PDFKit.PDFDocument, data: CertificateData) {
  const profile = schoolProfile(data);
  doc.font("Times-Bold").fontSize(17).text(profile.transferHeader, 90, 48, { width: 420, align: "center" });
  doc.font("Times-Italic").fontSize(9).text("Help the child to Help Himself", 90, 70, { width: 420, align: "center" });
  doc.font("Times-Roman").fontSize(8).text(profile.affiliation, 90, 84, { width: 420, align: "center" });
  doc.text(profile.address, 90, 96, { width: 420, align: "center" });
  doc.font("Helvetica-Bold").fontSize(8).text("ORIGINAL", 500, 45);
  doc.font("Helvetica-Bold").fontSize(12).text("TRANSFER CERTIFICATE", 0, 124, { align: "center", underline: true });
  doc.fillColor("#cc0000").fontSize(14).text(data.leavingTcNo || data.certificateNumber, 0, 144, { align: "center" }).fillColor("#000000");

  doc.font("Times-Roman").fontSize(11).text("Book No...........................", 55, 178);
  doc.text(`Sl.No. ${data.certificateNumber}`, 245, 178);
  doc.text(`Admission No. ${data.admissionNo}`, 410, 178);

  const rows: Array<[string, string, string]> = [
    ["1.", "Name of Pupil", data.studentName],
    ["2.", "Father's / Guardian's Name", data.fatherName || "—"],
    ["3.", "Mother's Name", data.motherName || "—"],
    ["4.", "Nationality & Religion", [data.nationality, data.religion].filter(Boolean).join(" / ")],
    ["5.", "Whether the candidate belongs to SC or ST", [data.caste, data.subCaste].filter(Boolean).join(" / ")],
    ["6.", "Date of first admission in the school with class", `${formatDate(data.dateOfAdmission)} with Class ${data.className || "—"}`],
    ["7.", "Date of Birth (in Christian Era) according to Admission Register", data.dateOfBirth ? `${formatDate(data.dateOfBirth)} / ${dateInWords(data.dateOfBirth)}` : "—"],
    ["8.", "Class in which the pupil last studied", `${data.classLeaving || data.className || "—"} / ${classInWords(data.classLeaving || data.className)}`],
    ["9.", "School/Board Annual examination last taken with result", data.boardCode || "—"],
    ["10.", "Whether failed, if so once/twice in the same class", "No"],
    ["11.", "Subjects Studied", "1.        2.        3.        4.        5.        6."],
    ["12.", "Whether qualified for promotion to the higher class", "Yes"],
    ["13.", "Month upto which the school dues paid", "—"],
    ["14.", "Any fee concession availed", "—"],
    ["15.", "Total No. of working days", "—"],
    ["16.", "Total No. of working days present", "—"],
    ["17.", "NCC Cadet / Scout / Guide", "—"],
    ["18.", "Games played / extra-curricular activities", "—"],
    ["19.", "General conduct", "Satisfactory"],
    ["20.", "Date of application for certificate", formatDate(data.tcTakenDate || data.issuedDate)],
    ["21.", "Date of issue of certificate", formatDate(data.issuedDate)],
    ["22.", "Reasons for leaving the school", data.reason || "Parent / Guardian request"],
    ["23.", "Any other remarks", data.previousTcNo ? `Previous TC No: ${data.previousTcNo}` : "—"]
  ];

  let y = 210;
  doc.font("Times-Roman").fontSize(9.6);
  for (const [n, label, value] of rows) {
    doc.text(n, 50, y, { width: 24 });
    doc.text(label, 76, y, { width: 240 });
    doc.text(":", 322, y);
    doc.moveTo(338, y + 12).lineTo(540, y + 12).lineWidth(0.5).stroke();
    doc.font("Times-Bold").text(value || "—", 344, y - 1, { width: 190, height: 18 });
    doc.font("Times-Roman");
    y += n === "18." ? 25 : 21;
  }

  doc.font("Times-Bold").fontSize(10).text("Signature of Class Teacher", 50, 748);
  doc.text("Checked by", 255, 748);
  doc.font("Times-Roman").fontSize(8).text("(State full name and designation)", 230, 762);
  doc.font("Times-Bold").fontSize(10).text("Principal\nSeal", 470, 748, { align: "right" });
  drawQr(doc, data, 280, 704, 52);
}

function drawGenericCertificatePdf(doc: PDFKit.PDFDocument, data: CertificateData) {
  const typeLabel = CERT_TYPE_LABELS[data.type] || "CERTIFICATE";
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(2).stroke("#173f35");
  doc.rect(36, 36, doc.page.width - 72, doc.page.height - 72).lineWidth(0.5).stroke("#dcd8cc");
  doc.save();
  doc.translate(doc.page.width / 2, doc.page.height / 2).rotate(-35)
    .font("Helvetica-Bold").fontSize(60).fillColor("#173f35", 0.04)
    .text(data.schoolName, -200, -20, { width: 400, align: "center" });
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#173f35").text(data.schoolName, 50, 60, { width: doc.page.width - 100, align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#6d7c77").text(data.schoolCity || "", { align: "center" });
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#19352e").text(typeLabel, { align: "center", underline: true });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(9).fillColor("#6d7c77").text(`Certificate No: ${data.certificateNumber}`, { align: "right" });
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(11).fillColor("#19352e").text(getBodyText(data), 60, doc.y, { width: doc.page.width - 120, lineGap: 4 });
  doc.font("Helvetica").fontSize(10).fillColor("#6d7c77").text(`Date of Issue: ${formatLongDate(data.issuedDate)}`, 60, 620, { align: "right" });
  doc.moveTo(60, 710).lineTo(200, 710).stroke("#19352e");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#19352e").text(data.issuedByName, 60, 716, { width: 140, align: "center" });
  doc.moveTo(doc.page.width - 200, 710).lineTo(doc.page.width - 60, 710).stroke("#19352e");
  doc.text("Principal", doc.page.width - 200, 716, { width: 140, align: "center" });
  drawQr(doc, data, doc.page.width / 2 - 35, 690, 70);
}

function drawQr(doc: PDFKit.PDFDocument, data: CertificateData, x: number, y: number, size: number) {
  if (!data.qrCodeImage) return;
  try {
    const qrBuffer = Buffer.from(data.qrCodeImage.split(",")[1] ?? "", "base64");
    doc.image(qrBuffer, x, y, { width: size, height: size });
    doc.font("Helvetica").fontSize(7).fillColor("#555555").text("Scan to verify", x - 4, y + size + 4, { width: size + 8, align: "center" });
  } catch {
    // QR is helpful but should never block certificate generation.
  }
}

function textWithLine(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, lineWidth: number) {
  doc.text(label, x, y);
  const lx = x + doc.widthOfString(label) + 8;
  lineText(doc, value, lx, y, lineWidth);
}

function lineText(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number) {
  doc.moveTo(x, y + 14).lineTo(x + width, y + 14).lineWidth(0.6).stroke("#111111");
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(value || "—", x + 4, y - 1, { width: width - 8, align: "center" });
}

function schoolProfile(data: CertificateData) {
  const school = clean(data.schoolName);
  const city = clean(data.schoolCity);
  const upper = school.toUpperCase();
  const place = city || inferPlace(school);
  return {
    transferHeader: upper,
    studyHeader: upper.replace(/^MONTESSORI\s*/i, "").replace(/,\s*/g, ",\n"),
    affiliation: school.toLowerCase().includes("senior secondary")
      ? "(Affiliated to CBSE, New Delhi - Affiliation No. 130467)"
      : "(Affiliated to CBSE / State Board as applicable)",
    address: place ? `${place}, Andhra Pradesh, India.` : "Andhra Pradesh, India."
  };
}

function inferPlace(schoolName: string) {
  const match = schoolName.match(/,\s*(.+)$/);
  return match ? match[1] : "";
}

function getBodyText(data: CertificateData): string {
  const dob = data.dateOfBirth ? formatLongDate(data.dateOfBirth) : "—";
  switch (data.type) {
    case "transfer":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) was a student of ${data.schoolName}, studying in Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""} during the academic year ${data.academicYear || "—"}. The student's conduct was satisfactory. Reason for leaving: ${data.reason || "Parent / Guardian request"}.`;
    case "study":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) studied in ${data.schoolName}, Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""}, during ${data.academicYear || "—"}. The student's conduct during this period has been satisfactory.`;
    case "bonafide":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) is a bonafide student of ${data.schoolName}, studying in Class ${data.className}${data.sectionName ? `, Section ${data.sectionName}` : ""}. The student's date of birth is ${dob}. This certificate is issued for ${data.reason || "general requirements"}.`;
    case "conduct":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) has been a student of ${data.schoolName}. The conduct and character of the student during the period of study has been satisfactory.`;
    case "fee":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) has paid the prescribed fees for the academic year ${data.academicYear || "—"} at ${data.schoolName}.`;
    case "participation":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) of Class ${data.className} has participated in ${data.reason || "the school event"} organized by ${data.schoolName}.`;
    case "achievement":
      return `This is to certify that ${data.studentName} (Admission No: ${data.admissionNo}) of Class ${data.className} has achieved ${data.reason || "academic excellence"} at ${data.schoolName}.`;
    default:
      return "";
  }
}

function toIsoDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0] || "";
  const text = String(value);
  return text.includes("T") ? text.split("T")[0] || "" : text;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatLongDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function dateInWords(value?: string) {
  if (!value) return "—";
  return formatLongDate(value);
}

function firstYear(academicYear?: string) {
  const match = String(academicYear || "").match(/\d{4}/);
  return match ? match[0] : "—";
}

function yearsBetween(from?: string, to?: string) {
  if (!from || !to) return "";
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return String(Math.max(1, end.getFullYear() - start.getFullYear()));
}

function heShe(data: CertificateData, fallback: string) {
  const gender = String(data.gender || "").toLowerCase();
  if (gender === "male") return "He";
  if (gender === "female") return "She";
  return fallback;
}

function classInWords(value?: string) {
  const raw = clean(value);
  const roman: Record<string, string> = {
    I: "One", II: "Two", III: "Three", IV: "Four", V: "Five", VI: "Six", VII: "Seven",
    VIII: "Eight", IX: "Nine", X: "Ten", XI: "Eleven", XII: "Twelve"
  };
  return roman[raw.toUpperCase()] || raw || "—";
}

function clean(value?: string) {
  return String(value || "").trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
