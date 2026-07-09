import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { RowDataPacket } from "mysql2/promise";
import { getPool, withTransaction } from "../../database/pool.js";
import { createProductionStudent, ProductionStudentInput } from "../students/studentRepository.js";

type ParsedRow = { rowNumber: number; raw: Record<string, unknown> };
type ImportMapping = Record<string, string>;
type ImportDefaultValues = Record<string, unknown>;
type ValidationContext = {
  existingAdmissions: Set<string>;
  academicYears?: Set<string>;
  boards?: Set<string>;
  schoolExists?: boolean;
  requiredFields?: readonly (typeof requiredFields[number])[];
  defaultValues?: ImportDefaultValues;
};

const requiredFields = [
  "admissionNo",
  "fullName",
  "academicYear",
  "dateOfAdmission",
  "dateOfBirth",
  "classAdmitted",
  "residenceAddress",
] as const;

const canonicalLabels: Record<string, string> = {
  idNo: "ID No",
  admissionNo: "Admission Number",
  fullName: "Student Name",
  studentAadhaarNo: "Student Aadhaar No",
  penNo: "PEN No",
  apaarId: "APAAR ID",
  fatherName: "Father Name",
  fatherAadhaarNo: "Father Aadhaar No",
  fatherMobileNumber: "Father Mobile Number",
  fatherEmail: "Father Email",
  fatherQualification: "Father Qualification",
  fatherOccupation: "Father Occupation",
  motherName: "Mother Name",
  motherAadhaarNo: "Mother Aadhaar No",
  motherMobileNumber: "Mother Mobile Number",
  motherEmail: "Mother Email",
  motherQualification: "Mother Qualification",
  motherOccupation: "Mother Occupation",
  motherBankAccountNo: "Mother Bank Account No",
  bankIfscCode: "Bank IFSC Code",
  studentEmail: "Student Email",
  residenceAddress: "Residence Address",
  previousSchoolClass: "Previous School Class",
  previousTcNo: "TC Number",
  dateOfAdmission: "Date of Admission",
  dateOfBirth: "Date of Birth",
  nationality: "Nationality",
  religion: "Religion",
  caste: "Caste",
  subCaste: "Sub Caste",
  motherTongue: "Mother Tongue",
  classAdmitted: "Class Admitted",
  sectionName: "Section",
  classLeaving: "Class Leaving",
  dateOfLeaving: "Date of Leaving",
  leavingTcNo: "Leaving TC No",
  tcTakenDate: "TC Taken Date",
  academicYear: "Academic Year",
  board: "Board",
  gender: "Gender",
};

const aliases: Record<string, string> = {
  id: "idNo",
  idno: "idNo",
  idnumber: "idNo",
  admissionno: "admissionNo",
  admissionnumber: "admissionNo",
  admno: "admissionNo",
  admission: "admissionNo",
  studentname: "fullName",
  name: "fullName",
  fullname: "fullName",
  nameofthepupil: "fullName",
  pupilename: "fullName",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  birthdate: "dateOfBirth",
  dateofadmission: "dateOfAdmission",
  admissiondate: "dateOfAdmission",
  academicyear: "academicYear",
  year: "academicYear",
  board: "board",
  class: "classAdmitted",
  classadmitted: "classAdmitted",
  admittedclass: "classAdmitted",
  grade: "classAdmitted",
  section: "sectionName",
  sectionname: "sectionName",
  gender: "gender",
  sex: "gender",
  address: "residenceAddress",
  residenceaddress: "residenceAddress",
  residentialaddress: "residenceAddress",
  studentaadhaarno: "studentAadhaarNo",
  studentaadharno: "studentAadhaarNo",
  aadhaar: "studentAadhaarNo",
  aadhar: "studentAadhaarNo",
  aadhaarno: "studentAadhaarNo",
  penno: "penNo",
  pen: "penNo",
  aaparid: "apaarId",
  apaarid: "apaarId",
  apaar: "apaarId",
  mailid: "studentEmail",
  email: "studentEmail",
  studentemail: "studentEmail",
  nationality: "nationality",
  religion: "religion",
  caste: "caste",
  subcaste: "subCaste",
  mothertongue: "motherTongue",
  fathername: "fatherName",
  fatheraadhaarno: "fatherAadhaarNo",
  fatheraadharno: "fatherAadhaarNo",
  fathermobilenumber: "fatherMobileNumber",
  fathermobile: "fatherMobileNumber",
  fatherphone: "fatherMobileNumber",
  fathermailid: "fatherEmail",
  fatheremail: "fatherEmail",
  fatherqualification: "fatherQualification",
  fatheroccupation: "fatherOccupation",
  mothername: "motherName",
  motheraadhaarno: "motherAadhaarNo",
  motheraadharno: "motherAadhaarNo",
  mothermobileno: "motherMobileNumber",
  mothermobile: "motherMobileNumber",
  motherphone: "motherMobileNumber",
  mothermailid: "motherEmail",
  motheremail: "motherEmail",
  motherqualification: "motherQualification",
  motheroccupation: "motherOccupation",
  motherbankaccountno: "motherBankAccountNo",
  bankifsccode: "bankIfscCode",
  ifsccode: "bankIfscCode",
  previousschoolclass: "previousSchoolClass",
  previousschool: "previousSchoolClass",
  tcnumber: "previousTcNo",
  previousTcNo: "previousTcNo",
  classleaving: "classLeaving",
  dateofleaving: "dateOfLeaving",
  leavingtcno: "leavingTcNo",
  tctakendate: "tcTakenDate",
};

const cleanHeader = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const cleanValue = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    if ("text" in value) return String((value as { text: unknown }).text).trim();
    if ("result" in value) return cleanValue((value as { result: unknown }).result);
    if ("richText" in value) return (value as { richText: Array<{ text?: string }> }).richText.map(item => item.text || "").join("").trim();
  }
  const text = String(value ?? "").trim();
  return ["", "-", "_", "null", "n/a", "na", "undefined"].includes(text.toLowerCase()) ? undefined : text;
};

const onlyDigits = (value: unknown) => cleanValue(value)?.replace(/\D/g, "");

const normalizeEmail = (value: unknown) => cleanValue(value)?.toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeBoardCode = (value: unknown) => {
  const cleaned = cleanValue(value)?.toUpperCase().replace(/\s+/g, "_");
  if (!cleaned) return undefined;
  if (["STATE_BOARD", "STATEBOARD", "SSC"].includes(cleaned)) return "STATE";
  if (["CENTRAL_BOARD", "CBSE_BOARD"].includes(cleaned)) return "CBSE";
  return cleaned;
};

const normalizeGender = (value: unknown) => {
  const cleaned = cleanValue(value)?.toLowerCase();
  if (!cleaned) return undefined;
  if (["m", "male", "boy"].includes(cleaned)) return "male";
  if (["f", "female", "girl"].includes(cleaned)) return "female";
  if (["o", "other"].includes(cleaned)) return "other";
  return cleaned;
};

const isoDate = (value: unknown) => {
  const cleaned = cleanValue(value);
  if (!cleaned) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const match = cleaned.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (match) return `${match[3]!}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  const date = new Date(cleaned);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString().slice(0, 10);
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
};

function resolveHeaderMapping(rawHeaders: string[], providedMapping?: ImportMapping) {
  const mapping: ImportMapping = {};
  for (const header of rawHeaders) {
    const trimmed = String(header || "").trim();
    if (!trimmed) continue;
    const mapped = Object.prototype.hasOwnProperty.call(providedMapping || {}, trimmed)
      ? providedMapping?.[trimmed]
      : aliases[cleanHeader(trimmed)];
    if (mapped) mapping[trimmed] = mapped;
  }
  return mapping;
}

function assertValidMapping(mapping: ImportMapping) {
  const mappedFields = Object.values(mapping).filter(Boolean);
  const duplicates = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
  if (duplicates.length) {
    throw Object.assign(new Error(`One student field is mapped more than once: ${[...new Set(duplicates)].join(", ")}.`), { statusCode: 422 });
  }
  const missing = requiredFields.filter(field => !mappedFields.includes(field));
  if (missing.length) {
    throw Object.assign(new Error(`Required columns are not mapped: ${missing.map(field => canonicalLabels[field]).join(", ")}.`), { statusCode: 422 });
  }
}

export async function parseStudentWorkbook(buffer: Buffer, filename: string, providedMapping?: ImportMapping) {
  const workbook = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv")) await workbook.csv.read(Readable.from(buffer));
  else await workbook.xlsx.load(buffer as never);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw Object.assign(new Error("The workbook has no worksheet."), { statusCode: 422 });

  const rawHeaders: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    rawHeaders[col - 1] = String(cleanValue(cell.value) || "").trim();
  });

  const mapping = resolveHeaderMapping(rawHeaders, providedMapping);
  assertValidMapping(mapping);

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, unknown> = {};
    rawHeaders.forEach((header, index) => {
      const canonical = mapping[header];
      if (canonical) raw[canonical] = row.getCell(index + 1).value;
    });
    if (Object.values(raw).some(cleanValue)) rows.push({ rowNumber, raw });
  });

  if (!rows.length) throw Object.assign(new Error("No student rows were found after the header row."), { statusCode: 422 });
  return { rows, mapping, rawHeaders };
}

export function validateRows(rows: ParsedRow[], contextOrExisting: ValidationContext | Set<string>) {
  const context = contextOrExisting instanceof Set
    ? { existingAdmissions: contextOrExisting }
    : contextOrExisting;
  const seen = new Set<string>();

  return rows.map(({ rowNumber, raw }) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) normalized[key] = cleanValue(value);

    for (const field of ["dateOfAdmission", "dateOfBirth", "dateOfLeaving", "tcTakenDate"]) {
      const original = raw[field];
      const cleaned = cleanValue(original);
      const parsed = isoDate(original);
      normalized[field] = parsed;
      if (cleaned && !parsed) normalized[`${field}Invalid`] = true;
    }

    normalized.board = normalizeBoardCode(raw.board) || normalizeBoardCode(context.defaultValues?.board);
    normalized.gender = normalizeGender(raw.gender);
    normalized.studentEmail = normalizeEmail(raw.studentEmail);
    normalized.fatherEmail = normalizeEmail(raw.fatherEmail);
    normalized.motherEmail = normalizeEmail(raw.motherEmail);

    for (const field of ["studentAadhaarNo", "fatherAadhaarNo", "motherAadhaarNo"]) {
      const digits = onlyDigits(raw[field]);
      if (digits) normalized[field] = digits;
    }
    for (const field of ["fatherMobileNumber", "motherMobileNumber"]) {
      const digits = onlyDigits(raw[field]);
      if (digits) normalized[field] = digits;
    }

    const errors: string[] = [];
    if (context.schoolExists === false) errors.push("School does not exist.");

    if (raw.id && !normalized.legacyStudentId) {
      const legacyStudentId = Number(raw.id);
      if (Number.isFinite(legacyStudentId)) normalized.legacyStudentId = legacyStudentId;
    }

    const fieldsRequiredForThisRun = context.requiredFields || requiredFields;
    for (const field of fieldsRequiredForThisRun) {
      if (!normalized[field]) errors.push(`${canonicalLabels[field]} is required.`);
    }

    for (const field of ["dateOfAdmission", "dateOfBirth", "dateOfLeaving", "tcTakenDate"]) {
      if (normalized[`${field}Invalid`]) errors.push(`${canonicalLabels[field] || field} must be a valid date.`);
      delete normalized[`${field}Invalid`];
    }

    for (const field of ["studentAadhaarNo", "fatherAadhaarNo", "motherAadhaarNo"]) {
      if (normalized[field] && !/^\d{12}$/.test(String(normalized[field]))) {
        errors.push(`${canonicalLabels[field]} must contain 12 digits.`);
      }
    }

    for (const field of ["fatherMobileNumber", "motherMobileNumber"]) {
      if (normalized[field] && !/^\d{10}$/.test(String(normalized[field]))) {
        errors.push(`${canonicalLabels[field]} must contain 10 digits.`);
      }
    }

    for (const field of ["studentEmail", "fatherEmail", "motherEmail"]) {
      if (normalized[field] && !isValidEmail(String(normalized[field]))) {
        errors.push(`${canonicalLabels[field]} must be a valid email address.`);
      }
    }

    if (normalized.academicYear && context.academicYears && !context.academicYears.has(String(normalized.academicYear))) {
      errors.push(`Academic Year "${normalized.academicYear}" is not configured for this school.`);
    }
    if (normalized.board && context.boards && !context.boards.has(String(normalized.board))) {
      errors.push(`Board "${normalized.board}" is not configured.`);
    }

    const admission = String(normalized.admissionNo || "").trim().toLowerCase();
    let duplicateReason = "";
    if (admission) {
      if (seen.has(admission)) duplicateReason = "Admission Number is duplicated inside this spreadsheet.";
      else if (context.existingAdmissions.has(admission)) duplicateReason = "Admission Number already exists in this school's database.";
      seen.add(admission);
    }
    if (duplicateReason) errors.push(duplicateReason);

    const status = duplicateReason ? "duplicate" : errors.length ? "error" : "valid";
    return {
      rowNumber,
      raw,
      normalized: normalized as unknown as ProductionStudentInput,
      errors,
      status,
    };
  });
}

export async function existingAdmissionNumbers(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT admission_no FROM v2_students WHERE school_id=? AND deleted_at IS NULL",
    [schoolId]
  );
  return new Set(rows.map(row => String(row.admission_no).toLowerCase()));
}

export async function existingAcademicYears(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT name FROM v2_academic_years WHERE school_id=?",
    [schoolId]
  );
  return new Set(rows.map(row => String(row.name)));
}

export async function existingBoards() {
  const [rows] = await getPool().execute<RowDataPacket[]>("SELECT code FROM v2_boards");
  return new Set(rows.map(row => String(row.code)));
}

export async function defaultBoardForSchool(schoolId: number) {
  const [classBoards] = await getPool().execute<RowDataPacket[]>(
    "SELECT DISTINCT board_code code FROM v2_classes WHERE school_id=? AND board_code IS NOT NULL AND board_code<>''",
    [schoolId]
  );
  const configured = classBoards.map(row => String(row.code).trim().toUpperCase()).filter(Boolean);
  if (configured.length === 1) return configured[0];
  if (configured.includes("STATE")) return "STATE";
  if (configured.includes("CBSE")) return "CBSE";
  if (configured[0]) return configured[0];

  const boards = await existingBoards();
  if (boards.has("STATE")) return "STATE";
  if (boards.has("CBSE")) return "CBSE";
  return [...boards][0] || "STATE";
}

export async function stageBatch(
  context: { schoolId: number; userId: number },
  sourceType: "excel" | "csv" | "legacy",
  filename: string,
  rows: ReturnType<typeof validateRows>,
  mapping?: ImportMapping,
) {
  const id = randomUUID();
  await withTransaction(async connection => {
    const valid = rows.filter(row => row.status === "valid").length;
    const error = rows.filter(row => row.status === "error").length;
    const duplicate = rows.filter(row => row.status === "duplicate").length;
    await connection.execute(
      `INSERT INTO v2_import_batches
       (id,school_id,uploaded_by,source_type,original_filename,status,total_rows,valid_rows,error_rows,duplicate_rows,mapping_json)
       VALUES (?,?,?,?,?,'ready',?,?,?,?,?)`,
      [id, context.schoolId, context.userId, sourceType, filename, rows.length, valid, error, duplicate, mapping ? JSON.stringify(mapping) : null]
    );
    for (const row of rows) {
      await connection.execute(
        `INSERT INTO v2_import_rows
         (batch_id,source_row_number,source_record_id,raw_json,normalized_json,row_status,errors_json)
         VALUES (?,?,?,?,?,?,?)`,
        [id, row.rowNumber, (row.raw.id as number) || null, JSON.stringify(row.raw), JSON.stringify(row.normalized), row.status, JSON.stringify(row.errors)]
      );
    }
    await connection.execute(
      `INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json)
       VALUES (?,?,'import',NULL,'import.stage',JSON_OBJECT('batchId',?,'rows',?,'valid',?,'errors',?,'duplicates',?))`,
      [context.schoolId, context.userId, id, rows.length, valid, error, duplicate]
    );
  });
  return getBatch(context.schoolId, id);
}

export async function getBatch(schoolId: number, id: string) {
  const [batches] = await getPool().execute<RowDataPacket[]>(
    "SELECT * FROM v2_import_batches WHERE id=? AND school_id=?",
    [id, schoolId]
  );
  if (!batches[0]) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id,source_row_number sourceRowNumber,row_status status,errors_json errors,normalized_json normalized,raw_json raw FROM v2_import_rows WHERE batch_id=? ORDER BY source_row_number LIMIT 500",
    [id]
  );
  return {
    ...batches[0],
    mapping: parseJson<Record<string, string>>(batches[0].mapping_json, {}),
    rows: rows.map(row => ({
      ...row,
      errors: parseJson<string[]>(row.errors, []),
      normalized: parseJson<Record<string, unknown>>(row.normalized, {}),
      raw: parseJson<Record<string, unknown>>(row.raw, {}),
    })),
  };
}

export async function listBatches(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT b.id,b.source_type sourceType,b.original_filename filename,b.status,b.total_rows totalRows,
            b.valid_rows validRows,b.error_rows errorRows,b.duplicate_rows duplicateRows,b.imported_rows importedRows,
            b.created_at createdAt,u.full_name uploadedBy
     FROM v2_import_batches b
     LEFT JOIN v2_users u ON u.id=b.uploaded_by
     WHERE b.school_id=?
     ORDER BY b.created_at DESC LIMIT 50`,
    [schoolId]
  );
  return rows;
}

export async function approveBatch(context: { schoolId: number; userId: number }, id: string) {
  const batch: any = await getBatch(context.schoolId, id);
  if (!["ready", "approved"].includes(String(batch.status))) {
    throw Object.assign(new Error("This batch cannot be imported in its current state."), { statusCode: 409 });
  }
  await getPool().execute(
    "UPDATE v2_import_batches SET status='importing',approved_by=?,approved_at=UTC_TIMESTAMP(),processed_rows=0,last_processed_row=0 WHERE id=?",
    [context.userId, id]
  );
  return processBatchChunk(context, id);
}

export async function processBatchChunk(context: { schoolId: number; userId: number }, id: string, chunkSize = 1000) {
  const batch: any = await getBatch(context.schoolId, id);
  if (batch.status !== "importing") throw Object.assign(new Error("Batch is not in importing state."), { statusCode: 409 });
  const lastProcessed = batch.last_processed_row || 0;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id,source_row_number,normalized_json FROM v2_import_rows WHERE batch_id=? AND row_status='valid' AND source_row_number>? ORDER BY source_row_number LIMIT ?",
    [id, lastProcessed, chunkSize]
  );

  if (rows.length === 0) return completeBatch(context, id);

  let imported = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const data = parseJson<ProductionStudentInput>(row.normalized_json, {} as ProductionStudentInput);
      const student = await createProductionStudent(data, context);
      await getPool().execute(
        "UPDATE v2_import_rows SET row_status='imported',imported_student_id=? WHERE id=?",
        [student.id, row.id]
      );
      imported++;
    } catch (error) {
      await getPool().execute(
        "UPDATE v2_import_rows SET row_status='error',errors_json=? WHERE id=?",
        [JSON.stringify([(error as Error).message]), row.id]
      );
      failed++;
    }
  }

  const lastRow = rows[rows.length - 1]?.source_row_number || lastProcessed;
  await getPool().execute(
    "UPDATE v2_import_batches SET processed_rows=processed_rows+?,last_processed_row=?,imported_rows=imported_rows+?,error_rows=error_rows+? WHERE id=?",
    [rows.length, lastRow, imported, failed, id]
  );

  if (rows.length === chunkSize) {
    return { batchId: id, status: "processing", processed: batch.processed_rows + rows.length, total: batch.total_rows, nextChunk: true };
  }
  return completeBatch(context, id);
}

async function completeBatch(context: { schoolId: number; userId: number }, id: string) {
  const [counts] = await getPool().execute<RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN row_status='imported' THEN 1 ELSE 0 END) imported,
       SUM(CASE WHEN row_status='error' THEN 1 ELSE 0 END) failed,
       SUM(CASE WHEN row_status='duplicate' THEN 1 ELSE 0 END) duplicates
     FROM v2_import_rows WHERE batch_id=?`,
    [id]
  );
  const imported = Number(counts[0]?.imported || 0);
  const failed = Number(counts[0]?.failed || 0);
  const duplicates = Number(counts[0]?.duplicates || 0);
  await getPool().execute(
    "UPDATE v2_import_batches SET status=?,imported_rows=?,error_rows=?,duplicate_rows=?,completed_at=UTC_TIMESTAMP() WHERE id=?",
    [failed || duplicates ? "completed_with_errors" : "completed", imported, failed, duplicates, id]
  );
  await getPool().execute(
    `INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json)
     VALUES (?,?,'import',NULL,'import.approve',JSON_OBJECT('batchId',?,'imported',?,'failed',?,'duplicates',?))`,
    [context.schoolId, context.userId, id, imported, failed, duplicates]
  );
  return getBatch(context.schoolId, id);
}

export async function cancelBatch(context: { schoolId: number; userId: number }, id: string) {
  const batch: any = await getBatch(context.schoolId, id);
  if (!["ready", "approved", "importing"].includes(String(batch.status))) {
    throw Object.assign(new Error("This batch cannot be cancelled in its current state."), { statusCode: 409 });
  }
  await getPool().execute("UPDATE v2_import_batches SET status='cancelled',cancelled_at=UTC_TIMESTAMP(),cancelled_by=? WHERE id=?", [context.userId, id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.cancel',JSON_OBJECT('batchId',?))", [context.schoolId, context.userId, id]);
  return getBatch(context.schoolId, id);
}

export async function getImportHistory(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT b.id,b.source_type sourceType,b.original_filename filename,b.status,b.total_rows totalRows,
            b.valid_rows validRows,b.error_rows errorRows,b.duplicate_rows duplicateRows,
            b.imported_rows importedRows,b.processed_rows processedRows,
            b.created_at createdAt,b.completed_at completedAt,b.cancelled_at cancelledAt,
            u.full_name uploadedBy
     FROM v2_import_batches b
     LEFT JOIN v2_users u ON u.id=b.uploaded_by
     WHERE b.school_id=? ORDER BY b.created_at DESC LIMIT 100`,
    [schoolId]
  );
  return rows;
}

export async function getImportProgress(schoolId: number, id: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id,status,total_rows totalRows,processed_rows processedRows,imported_rows importedRows,error_rows errorRows,last_processed_row lastProcessedRow FROM v2_import_batches WHERE id=? AND school_id=?",
    [id, schoolId]
  );
  if (!rows[0]) throw Object.assign(new Error("Import batch not found."), { statusCode: 404 });
  const batch = rows[0];
  const percentage = batch.totalRows > 0 ? Math.round((batch.processedRows / batch.totalRows) * 100) : 0;
  return { ...batch, percentage };
}

export async function rejectBatch(context: { schoolId: number; userId: number }, id: string) {
  const batch = await getBatch(context.schoolId, id) as any;
  if (!["ready", "approved"].includes(String(batch.status))) {
    throw Object.assign(new Error("This batch cannot be rejected in its current state."), { statusCode: 409 });
  }
  await getPool().execute("UPDATE v2_import_batches SET status='rejected' WHERE id=?", [id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.reject',JSON_OBJECT('batchId',?))", [context.schoolId, context.userId, id]);
  return getBatch(context.schoolId, id);
}

export async function rollbackBatch(context: { schoolId: number; userId: number }, id: string) {
  const batch: any = await getBatch(context.schoolId, id);
  if (!["completed", "completed_with_errors"].includes(String(batch.status))) {
    throw Object.assign(new Error("Only completed imports can be rolled back."), { statusCode: 409 });
  }
  const [importedRows] = await getPool().execute<RowDataPacket[]>(
    "SELECT imported_student_id FROM v2_import_rows WHERE batch_id=? AND row_status='imported' AND imported_student_id IS NOT NULL",
    [id]
  );
  const studentIds = importedRows.map(row => row.imported_student_id).filter(Boolean);
  if (studentIds.length) {
    await getPool().execute(
      `UPDATE v2_students SET deleted_at=UTC_TIMESTAMP(), current_status='inactive' WHERE school_id=? AND id IN (${studentIds.map(() => "?").join(",")})`,
      [context.schoolId, ...studentIds]
    );
    await getPool().execute(
      `UPDATE v2_admissions SET status='revoked' WHERE school_id=? AND student_id IN (${studentIds.map(() => "?").join(",")})`,
      [context.schoolId, ...studentIds]
    );
  }
  await getPool().execute("UPDATE v2_import_rows SET row_status='error',errors_json=JSON_ARRAY('Rolled back'),imported_student_id=NULL WHERE batch_id=? AND row_status='imported'", [id]);
  await getPool().execute("UPDATE v2_import_batches SET status='rolled_back',imported_rows=0,completed_at=UTC_TIMESTAMP() WHERE id=?", [id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.rollback',JSON_OBJECT('batchId',?,'studentsReversed',?))", [context.schoolId, context.userId, id, studentIds.length]);
  return getBatch(context.schoolId, id);
}

export async function getErrorReportHtml(schoolId: number, id: string) {
  const batch: any = await getBatch(schoolId, id);
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT source_row_number,row_status,errors_json,raw_json,normalized_json FROM v2_import_rows WHERE batch_id=? AND row_status IN ('error','duplicate') ORDER BY source_row_number",
    [id]
  );
  const rowsHtml = rows.map(row => {
    const errors = parseJson<string[]>(row.errors_json, []);
    const raw = parseJson<Record<string, unknown>>(row.raw_json, {});
    const normalized = parseJson<Record<string, unknown>>(row.normalized_json, {});
    const statusColor = row.row_status === "duplicate" ? "#f59e0b" : "#ef4444";
    return `<tr><td>${row.source_row_number}</td><td>${normalized.fullName || raw.fullName || "—"}</td><td>${normalized.admissionNo || raw.admissionNo || "—"}</td><td style="color:${statusColor};font-weight:600">${row.row_status}</td><td>${errors.map(error => `<div class="err">• ${error}</div>`).join("")}</td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Import Error Report — ${batch.original_filename || batch.filename}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:40px;color:#1a1a2e;background:#fafafa}
    .header{background:#1a1a2e;color:#fff;padding:24px 32px;border-radius:12px;margin-bottom:24px}
    .header h1{margin:0 0 4px;font-size:22px}.header p{margin:0;opacity:.7;font-size:14px}
    .metrics{display:flex;gap:16px;margin-bottom:24px}
    .metric{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;flex:1;text-align:center}
    .metric strong{display:block;font-size:28px;margin-bottom:4px}.metric small{color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
    .metric.bad strong{color:#ef4444}.metric.warn strong{color:#f59e0b}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    th{background:#f3f4f6;padding:12px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280}
    td{padding:10px 16px;border-top:1px solid #f3f4f6;font-size:13px;vertical-align:top}
    .err{color:#dc2626;font-size:12px;margin:2px 0}
    .footer{margin-top:24px;text-align:center;color:#9ca3af;font-size:12px}
  </style></head><body>
    <div class="header"><h1>Import Error Report</h1><p>${batch.original_filename || batch.filename} · Generated ${new Date().toLocaleString()}</p></div>
    <div class="metrics">
      <div class="metric"><strong>${batch.total_rows}</strong><small>Total Rows</small></div>
      <div class="metric bad"><strong>${batch.error_rows}</strong><small>Errors</small></div>
      <div class="metric warn"><strong>${batch.duplicate_rows}</strong><small>Duplicates</small></div>
    </div>
    <table><thead><tr><th>Row</th><th>Student Name</th><th>Admission No</th><th>Status</th><th>Issues</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:32px;color:#6b7280">No errors found.</td></tr>'}</tbody></table>
    <div class="footer">Montessori School Management · Automated Error Report</div>
  </body></html>`;
}
