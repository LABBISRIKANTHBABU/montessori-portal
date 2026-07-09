import "dotenv/config";
import type { RowDataPacket } from "mysql2/promise";
import { closePool, getPool } from "../database/pool.js";
import { getConfig } from "../config/env.js";
import { createProductionStudent, type ProductionStudentInput } from "../modules/students/studentRepository.js";

type LegacyStudentRow = RowDataPacket & {
  id: number;
  IDNo?: string | null;
  AdmissionNo?: string | null;
  NameOfThePupil?: string | null;
  StudentAadhaarNo?: string | null;
  PENNo?: string | null;
  AAPARID?: string | null;
  FatherName?: string | null;
  FatherAadhaarNo?: string | null;
  FatherMobileNumber?: string | null;
  MailID?: string | null;
  MotherName?: string | null;
  MotherAadharNo?: string | null;
  MotherMobileNo?: string | null;
  MotherBankAccountNo?: string | null;
  BankIFSCCode?: string | null;
  ResidenceAddress?: string | null;
  FatherQualification?: string | null;
  FatherOccupation?: string | null;
  FatherMailID?: string | null;
  MotherQualification?: string | null;
  MotherOccupation?: string | null;
  MotherMailID?: string | null;
  PreviousSchoolClass?: string | null;
  TCNumber?: string | null;
  DateOfAdmission?: string | Date | null;
  DateOfBirth?: string | Date | null;
  Nationality?: string | null;
  Religion?: string | null;
  Caste?: string | null;
  SubCaste?: string | null;
  MotherTongue?: string | null;
  ClassAdmitted?: string | null;
  ClassLeaving?: string | null;
  DateOfLeaving?: string | Date | null;
  LeavingTCNo?: string | null;
  TCTakenDate?: string | Date | null;
  EntryDate?: string | Date | null;
  AcademicYear?: string | null;
  Board?: string | null;
};

const placeholders = new Set(["", "-", "_", "null", "n/a", "na", "undefined"]);

function clean(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  return placeholders.has(text.toLowerCase()) ? undefined : text;
}

function digits(value: unknown) {
  return clean(value)?.replace(/\D/g, "");
}

function email(value: unknown) {
  return clean(value)?.toLowerCase();
}

function date(value: unknown) {
  const cleaned = clean(value);
  if (!cleaned) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const match = cleaned.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (match) return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString().slice(0, 10);
}

function board(value: unknown) {
  return clean(value)?.toUpperCase() || "UNKNOWN";
}

function academicYearName(value: unknown) {
  return clean(value) || "Legacy";
}

function academicYearDates(name: string) {
  const firstYear = name.match(/\d{4}/)?.[0];
  const year = firstYear ? Number(firstYear) : 2000;
  return {
    start: `${year}-06-01`,
    end: `${year + 1}-05-31`,
  };
}

function currentStatus(row: LegacyStudentRow): ProductionStudentInput["currentStatus"] {
  return clean(row.LeavingTCNo) || date(row.DateOfLeaving) ? "transferred" : "active";
}

function toProductionInput(row: LegacyStudentRow): ProductionStudentInput {
  const admissionNo = clean(row.AdmissionNo);
  const fullName = clean(row.NameOfThePupil);
  const admissionDate = date(row.DateOfAdmission) || date(row.EntryDate);

  if (!admissionNo) throw new Error(`Legacy row ${row.id} has no admission number.`);
  if (!fullName) throw new Error(`Legacy row ${row.id} has no student name.`);
  if (!admissionDate) throw new Error(`Legacy row ${row.id} has no admission date or entry date.`);

  return {
    legacyStudentId: Number(row.id),
    idNo: clean(row.IDNo),
    admissionNo,
    fullName,
    academicYear: academicYearName(row.AcademicYear),
    board: board(row.Board),
    dateOfAdmission: admissionDate,
    dateOfBirth: date(row.DateOfBirth),
    classAdmitted: clean(row.ClassAdmitted) || "Unassigned",
    residenceAddress: clean(row.ResidenceAddress) || "Not available from legacy record",
    studentAadhaarNo: digits(row.StudentAadhaarNo),
    penNo: clean(row.PENNo),
    apaarId: clean(row.AAPARID),
    fatherName: clean(row.FatherName),
    fatherAadhaarNo: digits(row.FatherAadhaarNo),
    fatherMobileNumber: digits(row.FatherMobileNumber),
    fatherEmail: email(row.FatherMailID),
    fatherQualification: clean(row.FatherQualification),
    fatherOccupation: clean(row.FatherOccupation),
    motherName: clean(row.MotherName),
    motherAadhaarNo: digits(row.MotherAadharNo),
    motherMobileNumber: digits(row.MotherMobileNo),
    motherEmail: email(row.MotherMailID),
    motherQualification: clean(row.MotherQualification),
    motherOccupation: clean(row.MotherOccupation),
    motherBankAccountNo: digits(row.MotherBankAccountNo),
    bankIfscCode: clean(row.BankIFSCCode),
    studentEmail: email(row.MailID),
    previousSchoolClass: clean(row.PreviousSchoolClass),
    previousTcNo: clean(row.TCNumber),
    nationality: clean(row.Nationality),
    religion: clean(row.Religion),
    caste: clean(row.Caste),
    subCaste: clean(row.SubCaste),
    motherTongue: clean(row.MotherTongue),
    classLeaving: clean(row.ClassLeaving),
    dateOfLeaving: date(row.DateOfLeaving),
    leavingTcNo: clean(row.LeavingTCNo),
    tcTakenDate: date(row.TCTakenDate),
    currentStatus: currentStatus(row),
  };
}

async function ensureMasters(schoolId: number, schoolCode: string) {
  const [years] = await getPool().execute<RowDataPacket[]>(
    `SELECT DISTINCT AcademicYear academicYear
     FROM student_details
     WHERE SchoolName = ? AND AcademicYear IS NOT NULL AND TRIM(AcademicYear) NOT IN ('', '-', '_')`,
    [schoolCode]
  );
  for (const row of years) {
    const name = academicYearName(row.academicYear);
    const dates = academicYearDates(name);
    await getPool().execute(
      `INSERT IGNORE INTO v2_academic_years (school_id, name, start_date, end_date, is_current)
       VALUES (?, ?, ?, ?, 0)`,
      [schoolId, name, dates.start, dates.end]
    );
  }

  const [boards] = await getPool().execute<RowDataPacket[]>(
    "SELECT DISTINCT Board board FROM student_details WHERE SchoolName = ? AND Board IS NOT NULL",
    [schoolCode]
  );
  for (const row of boards) {
    const code = board(row.board);
    await getPool().execute("INSERT IGNORE INTO v2_boards (code, name) VALUES (?, ?)", [code, code]);
  }

  await getPool().execute(
    `INSERT IGNORE INTO v2_classes (school_id, board_code, name)
     SELECT ?, NULLIF(UPPER(TRIM(Board)), ''), TRIM(ClassAdmitted)
     FROM student_details
     WHERE SchoolName = ? AND ClassAdmitted IS NOT NULL AND TRIM(ClassAdmitted) NOT IN ('', '-', '_')
     GROUP BY NULLIF(UPPER(TRIM(Board)), ''), TRIM(ClassAdmitted)`,
    [schoolId, schoolCode]
  );
}

async function main() {
  const config = getConfig();
  const schoolCode = process.env.SCHOOL_CODE || "MSSSACK";
  const dryRun = process.env.DRY_RUN !== "false";
  const limit = Number(process.env.LIMIT || 0);
  const offset = Number(process.env.OFFSET || 0);

  console.log("[LEGACY SYNC] Database target", {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    ssl: config.DB_SSL,
  });

  const [schools] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, legacy_code code, name FROM v2_schools WHERE legacy_code = ? LIMIT 1",
    [schoolCode]
  );
  const school = schools[0];
  if (!school) throw new Error(`No v2_schools record found for legacy code ${schoolCode}. Run migrations/bootstrap first.`);

  const [users] = await getPool().execute<RowDataPacket[]>(
    `SELECT u.id
     FROM v2_users u
     JOIN v2_user_school_roles usr ON usr.user_id = u.id
     WHERE usr.school_id = ?
     ORDER BY FIELD(usr.role_code, 'group_super_admin', 'school_admin', 'principal') ASC, u.id ASC
     LIMIT 1`,
    [school.id]
  );
  const userId = Number(users[0]?.id || 0);
  if (!userId) throw new Error(`No v2 user is assigned to ${schoolCode}. Create/provision an admin before syncing legacy students.`);

  const [countRows] = await getPool().execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) legacyTotal,
       SUM(CASE WHEN v.id IS NULL THEN 0 ELSE 1 END) alreadyImported
     FROM student_details d
     LEFT JOIN v2_students v ON v.school_id = ? AND (v.legacy_student_id = d.id OR v.admission_no = d.AdmissionNo)
     WHERE d.SchoolName = ?`,
    [school.id, schoolCode]
  );
  const counts = countRows[0] || { legacyTotal: 0, alreadyImported: 0 };

  console.log(`[LEGACY SYNC] School ${schoolCode} - ${school.name}`);
  console.log(`[LEGACY SYNC] Legacy rows: ${Number(counts.legacyTotal || 0)}, already in v2: ${Number(counts.alreadyImported || 0)}`);
  console.log(`[LEGACY SYNC] Mode: ${dryRun ? "DRY RUN" : "IMPORT"}`);

  await ensureMasters(Number(school.id), schoolCode);

  const limitSql = limit > 0 ? "LIMIT ? OFFSET ?" : "";
  const params: Array<string | number> = [school.id, schoolCode];
  if (limit > 0) params.push(limit, offset);
  const [rows] = await getPool().execute<LegacyStudentRow[]>(
    `SELECT d.*
     FROM student_details d
     LEFT JOIN v2_students v ON v.school_id = ? AND (v.legacy_student_id = d.id OR v.admission_no = d.AdmissionNo)
     WHERE d.SchoolName = ? AND v.id IS NULL
     ORDER BY d.id ${limitSql}`,
    params
  );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const input = toProductionInput(row);
      if (!dryRun) await createProductionStudent(input, { schoolId: Number(school.id), userId });
      imported++;
      if (imported % 250 === 0) console.log(`[LEGACY SYNC] ${dryRun ? "Validated" : "Imported"} ${imported}/${rows.length}`);
    } catch (error) {
      skipped++;
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`[LEGACY SYNC] ${dryRun ? "Validated" : "Imported"}: ${imported}`);
  console.log(`[LEGACY SYNC] Skipped/errors: ${skipped}`);
  if (errors.length) {
    console.log("[LEGACY SYNC] First errors:");
    for (const error of errors.slice(0, 20)) console.log(`- ${error}`);
  }
  if (dryRun) console.log("[LEGACY SYNC] No records were written. Re-run with DRY_RUN=false to import.");
}

function explainDatabaseFailure(error: unknown) {
  const typed = error as Error & { code?: string; errno?: number; sqlMessage?: string };
  if (typed.code !== "ER_ACCESS_DENIED_ERROR") return false;

  const config = getConfig();
  console.error("[LEGACY SYNC] MySQL rejected the configured login.");
  console.error("[LEGACY SYNC] This is not a student-data bug. No legacy rows were read and no v2 students were written.");
  console.error("[LEGACY SYNC] Check these values in backend/.env and Hostinger MySQL:");
  console.error(`- DB_HOST=${config.DB_HOST}`);
  console.error(`- DB_PORT=${config.DB_PORT}`);
  console.error(`- DB_USER=${config.DB_USER}`);
  console.error(`- DB_NAME=${config.DB_NAME}`);
  console.error(`- DB_SSL=${config.DB_SSL}`);
  console.error("- DB_PASSWORD must be the real password for that MySQL user.");
  console.error("- Hostinger must allow remote MySQL access from your current public IP.");
  console.error("- The MySQL user must have privileges on the selected database.");
  console.error("[LEGACY SYNC] After fixing credentials, run:");
  console.error("  cd E:\\montessori-portal\\backend");
  console.error("  $env:SCHOOL_CODE=\"MSSSACK\"");
  console.error("  $env:DRY_RUN=\"true\"");
  console.error("  npm run legacy:sync-students");
  return true;
}

main()
  .catch(error => {
    if (!explainDatabaseFailure(error)) {
      console.error("[LEGACY SYNC] Failed", error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  })
  .finally(() => {
    void closePool();
  });
