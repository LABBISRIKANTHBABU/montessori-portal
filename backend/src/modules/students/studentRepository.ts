import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { withTransaction, getPool } from "../../database/pool.js";
import { encryptField, lastFour } from "../../security/fieldEncryption.js";

export type ProductionStudentInput = {
  fullName: string; admissionNo: string; academicYear: string; board: string; dateOfAdmission: string;
  classAdmitted: string; sectionName?: string; idNo?: string; previousSchoolClass?: string; previousTcNo?: string;
  dateOfBirth: string; gender?: "male" | "female" | "other"; nationality?: string; motherTongue?: string;
  religion?: string; caste?: string; subCaste?: string; studentAadhaarNo?: string; penNo?: string; apaarId?: string;
  fatherName?: string; fatherAadhaarNo?: string; fatherMobileNumber?: string; fatherEmail?: string;
  fatherQualification?: string; fatherOccupation?: string; motherName?: string; motherAadhaarNo?: string;
  motherMobileNumber?: string; motherEmail?: string; motherQualification?: string; motherOccupation?: string;
  motherBankAccountNo?: string; bankIfscCode?: string; studentEmail?: string; residenceAddress: string;
  currentStatus?: "active" | "inactive" | "dropped" | "transferred" | "alumni";
  classLeaving?: string; dateOfLeaving?: string; leavingTcNo?: string; tcTakenDate?: string;
};

export async function createProductionStudent(input: ProductionStudentInput, context: { schoolId: number; userId: number }, photoPath?: string) {
  return withTransaction(async connection => {
    const [duplicate] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM v2_students WHERE school_id = ? AND admission_no = ? FOR UPDATE", [context.schoolId, input.admissionNo]
    );
    if (duplicate.length) throw Object.assign(new Error("That admission number already exists in this school."), { statusCode: 409 });
    const [years] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM v2_academic_years WHERE school_id = ? AND name = ? LIMIT 1", [context.schoolId, input.academicYear]
    );
    if (!years[0]) throw Object.assign(new Error("The selected academic year is not configured for this school."), { statusCode: 422 });

    const studentUid = `MON-${context.schoolId}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [studentResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO v2_students
       (school_id, student_uid, admission_no, full_name, gender, date_of_birth, nationality, mother_tongue,
        religion, caste, sub_caste, student_email, photo_path, current_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [context.schoolId, studentUid, input.admissionNo, input.fullName, input.gender || null, input.dateOfBirth,
       input.nationality || null, input.motherTongue || null, input.religion || null, input.caste || null,
       input.subCaste || null, input.studentEmail || null, photoPath || null, input.currentStatus || "active"]
    );
    const studentId = studentResult.insertId;
    const identifiers = [
      input.idNo && ["legacy_id", input.idNo, null, null],
      ["admission_no", input.admissionNo, null, null],
      input.studentAadhaarNo && ["aadhaar", null, encryptField(input.studentAadhaarNo), `XXXX-XXXX-${lastFour(input.studentAadhaarNo)}`],
      input.penNo && ["pen", input.penNo, null, null],
      input.apaarId && ["apaar", input.apaarId, null, null]
    ].filter(Boolean) as [string, string | null, Buffer | null, string | null][];
    for (const item of identifiers) {
      await connection.execute(
        "INSERT INTO v2_student_identifiers (student_id, identifier_type, identifier_value, encrypted_value, masked_value) VALUES (?, ?, ?, ?, ?)",
        [studentId, ...item]
      );
    }
    const guardians = [
      input.fatherName && { relation: "father", name: input.fatherName, mobile: input.fatherMobileNumber, email: input.fatherEmail, aadhaar: input.fatherAadhaarNo, qualification: input.fatherQualification, occupation: input.fatherOccupation },
      input.motherName && { relation: "mother", name: input.motherName, mobile: input.motherMobileNumber, email: input.motherEmail, aadhaar: input.motherAadhaarNo, qualification: input.motherQualification, occupation: input.motherOccupation, bank: input.motherBankAccountNo, ifsc: input.bankIfscCode }
    ].filter(Boolean) as Array<Record<string, string | undefined>>;
    for (const guardian of guardians) {
      const [guardianResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO v2_guardians
         (full_name, relation_type, mobile, email, aadhaar_encrypted, aadhaar_last_four, qualification,
          occupation, bank_account_encrypted, bank_account_last_four, ifsc_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [guardian.name, guardian.relation, guardian.mobile || null, guardian.email || null, encryptField(guardian.aadhaar),
         lastFour(guardian.aadhaar), guardian.qualification || null, guardian.occupation || null,
         encryptField(guardian.bank), lastFour(guardian.bank), guardian.ifsc || null]
      );
      await connection.execute(
        "INSERT INTO v2_student_guardians (student_id, guardian_id, is_primary, is_emergency_contact) VALUES (?, ?, ?, ?)",
        [studentId, guardianResult.insertId, guardian.relation === "father" ? 1 : 0, guardian.mobile ? 1 : 0]
      );
    }
    await connection.execute("INSERT INTO v2_student_addresses (student_id, address_type, full_address) VALUES (?, 'residential', ?)", [studentId, input.residenceAddress]);
    await connection.execute(
      `INSERT INTO v2_admissions
       (school_id, student_id, academic_year_id, board_code, admission_no, admission_date, class_admitted,
        section_name, previous_school_class, previous_tc_no, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
      [context.schoolId, studentId, years[0].id, input.board, input.admissionNo, input.dateOfAdmission,
       input.classAdmitted, input.sectionName || null, input.previousSchoolClass || null, input.previousTcNo || null, context.userId]
    );
    if (input.classLeaving || input.dateOfLeaving || input.leavingTcNo) {
      await connection.execute(
        `INSERT INTO v2_student_leaving_records
         (school_id, student_id, class_leaving, date_of_leaving, tc_number, tc_taken_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [context.schoolId, studentId, input.classLeaving || null, input.dateOfLeaving || null, input.leavingTcNo || null, input.tcTakenDate || null]
      );
    }
    await connection.execute(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'student', ?, 'student.create', JSON_OBJECT('admissionNo', ?, 'studentUid', ?))`,
      [context.schoolId, context.userId, studentId, input.admissionNo, studentUid]
    );
    return { id: studentId, schoolId: context.schoolId, studentUid, admissionNo: input.admissionNo, fullName: input.fullName, className: input.classAdmitted, sectionName: input.sectionName || "—", gender: input.gender || "other", status: input.currentStatus || "active" };
  });
}

export async function listProductionStudents(schoolId: number, search: string, status?: string, limit = 50, offset = 0) {
  const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const conditions = ["s.school_id = ?", "s.deleted_at IS NULL"];
  const params: Array<string | number> = [schoolId];
  if (search) {
    conditions.push("(s.full_name LIKE ? OR s.admission_no LIKE ?)");
    params.push(term, term);
  }
  if (status) {
    conditions.push("s.current_status = ?");
    params.push(status);
  }
  const where = conditions.join(" AND ");
  // Get total count
  const [countResult] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) total FROM v2_students s WHERE ${where}`,
    params
  );
  const total = Number(countResult[0]?.total || 0);
  // Get paginated rows
  params.push(limit, offset);
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT s.id, s.student_uid studentUid, s.admission_no admissionNo, s.full_name fullName,
            COALESCE(a.class_admitted, '—') className, COALESCE(a.section_name, '—') sectionName,
            COALESCE(s.gender, 'other') gender, s.current_status status,
            (SELECT g.mobile
             FROM v2_student_guardians sg
             JOIN v2_guardians g ON g.id = sg.guardian_id
             WHERE sg.student_id = s.id
             ORDER BY sg.is_primary DESC, sg.id
             LIMIT 1) guardianPhone
     FROM v2_students s
     LEFT JOIN v2_admissions a ON a.student_id = s.id
     WHERE ${where}
     ORDER BY s.full_name LIMIT ? OFFSET ?`,
    params
  );
  return { data: rows, total };
}

export async function getProductionStudent(schoolId: number, studentId: number) {
  const [students] = await getPool().execute<RowDataPacket[]>(
    `SELECT s.*, a.academic_year_id, y.name academicYear, a.board_code board, a.admission_date dateOfAdmission,
            a.class_admitted classAdmitted, a.section_name sectionName, a.previous_school_class previousSchoolClass,
            ad.full_address residenceAddress
     FROM v2_students s LEFT JOIN v2_admissions a ON a.student_id=s.id
     LEFT JOIN v2_academic_years y ON y.id=a.academic_year_id
     LEFT JOIN v2_student_addresses ad ON ad.student_id=s.id AND ad.address_type='residential'
     WHERE s.id=? AND s.school_id=? AND s.deleted_at IS NULL LIMIT 1`, [studentId, schoolId]);
  if (!students[0]) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
  const [guardians] = await getPool().execute<RowDataPacket[]>(
    `SELECT g.id,g.full_name fullName,g.relation_type relationType,g.mobile,g.email,g.qualification,g.occupation,
            g.aadhaar_last_four aadhaarLastFour,g.bank_account_last_four bankLastFour,g.ifsc_code ifscCode
     FROM v2_guardians g JOIN v2_student_guardians sg ON sg.guardian_id=g.id WHERE sg.student_id=?`, [studentId]);
  const [identifiers] = await getPool().execute<RowDataPacket[]>(
    "SELECT identifier_type type, COALESCE(masked_value,identifier_value) value,is_verified isVerified FROM v2_student_identifiers WHERE student_id=?", [studentId]);
  const [history] = await getPool().execute<RowDataPacket[]>(
    "SELECT action_name actionName,created_at createdAt FROM v2_audit_events WHERE school_id=? AND entity_type='student' AND entity_id=? ORDER BY created_at DESC LIMIT 30", [schoolId, studentId]);
  return { ...students[0], guardians, identifiers, history };
}

export async function updateProductionStudent(schoolId: number, studentId: number, userId: number, input: { fullName: string; studentEmail?: string; residenceAddress: string; classAdmitted: string; sectionName?: string }) {
  return withTransaction(async connection => {
    const [found] = await connection.execute<RowDataPacket[]>("SELECT id FROM v2_students WHERE id=? AND school_id=? AND deleted_at IS NULL FOR UPDATE", [studentId, schoolId]);
    if (!found[0]) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
    await connection.execute("UPDATE v2_students SET full_name=?,student_email=? WHERE id=?", [input.fullName, input.studentEmail || null, studentId]);
    await connection.execute("UPDATE v2_admissions SET class_admitted=?,section_name=? WHERE student_id=?", [input.classAdmitted, input.sectionName || null, studentId]);
    await connection.execute("UPDATE v2_student_addresses SET full_address=? WHERE student_id=? AND address_type='residential'", [input.residenceAddress, studentId]);
    await connection.execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name) VALUES (?,?,'student',?,'student.update')", [schoolId, userId, studentId]);
    return getProductionStudent(schoolId, studentId);
  });
}

export async function changeProductionStudentStatus(schoolId: number, studentId: number, userId: number, status: string, reason?: string) {
  return withTransaction(async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT current_status FROM v2_students WHERE id=? AND school_id=? AND deleted_at IS NULL FOR UPDATE", [studentId, schoolId]);
    if (!rows[0]) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
    await connection.execute("UPDATE v2_students SET current_status=? WHERE id=?", [status, studentId]);
    await connection.execute("INSERT INTO v2_student_status_history (student_id,old_status,new_status,reason,changed_by) VALUES (?,?,?,?,?)", [studentId, rows[0].current_status, status, reason || null, userId]);
    await connection.execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'student',?,'student.status.change',JSON_OBJECT('status',?))", [schoolId, userId, studentId, status]);
    return { id: studentId, status };
  });
}

export async function restoreProductionStudent(schoolId: number, studentId: number) {
  return withTransaction(async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT current_status FROM v2_students WHERE id=? AND school_id=? AND deleted_at IS NULL FOR UPDATE",
      [studentId, schoolId]
    );
    if (!rows[0]) throw Object.assign(new Error("Student not found."), { statusCode: 404 });
    if (rows[0].current_status === "active") throw Object.assign(new Error("Student is already active."), { statusCode: 422 });
    await connection.execute("UPDATE v2_students SET current_status='active' WHERE id=?", [studentId]);
    await connection.execute(
      "INSERT INTO v2_student_status_history (student_id, old_status, new_status, reason, changed_by) VALUES (?, ?, 'active', 'Restored by administrator', 0)",
      [studentId, rows[0].current_status]
    );
    return { id: studentId, status: "active", message: "Student restored to active status." };
  });
}

export async function exportProductionStudents(schoolId: number, search: string, status?: string) {
  const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const conditions = ["s.school_id = ?", "s.deleted_at IS NULL"];
  const params: Array<string | number> = [schoolId];
  if (search) {
    conditions.push("(s.full_name LIKE ? OR s.admission_no LIKE ?)");
    params.push(term, term);
  }
  if (status) {
    conditions.push("s.current_status = ?");
    params.push(status);
  }
  const where = conditions.join(" AND ");
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT s.admission_no admissionNo, s.full_name fullName, COALESCE(s.gender,'') gender,
            s.date_of_birth dateOfBirth, s.current_status status,
            COALESCE(a.class_admitted,'') className, COALESCE(a.section_name,'') sectionName,
            a.board_code board, a.admission_date dateOfAdmission,
            COALESCE(s.student_email,'') studentEmail, COALESCE(s.phone,'') phone
     FROM v2_students s
     LEFT JOIN v2_admissions a ON a.student_id = s.id
     WHERE ${where}
     ORDER BY s.full_name`,
    params
  );
  return rows;
}

export async function checkDuplicateAdmission(schoolId: number, admissionNo: string, excludeStudentId?: number) {
  const conditions = ["school_id = ?", "admission_no = ?", "deleted_at IS NULL"];
  const params: Array<string | number> = [schoolId, admissionNo];
  if (excludeStudentId) {
    conditions.push("id != ?");
    params.push(excludeStudentId);
  }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, full_name fullName, admission_no admissionNo FROM v2_students WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params
  );
  return rows[0] || null;
}

export async function getProductionDashboard(schoolId: number) {
  const [[totals]] = await getPool().execute<RowDataPacket[]>(`SELECT COUNT(*) students,SUM(current_status='active') active FROM v2_students WHERE school_id=? AND deleted_at IS NULL`, [schoolId]);
  const [[events]] = await getPool().execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM v2_events WHERE school_id=?`, [schoolId]);
  const [[fees]] = await getPool().execute<RowDataPacket[]>(`SELECT COALESCE(SUM(amount),0) total FROM v2_fee_payments WHERE school_id=?`, [schoolId]);
  const [[certificates]] = await getPool().execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM v2_certificates WHERE school_id=?`, [schoolId]);
  const [classes] = await getPool().execute<RowDataPacket[]>(`SELECT a.class_admitted label,COUNT(*) value FROM v2_admissions a JOIN v2_students s ON s.id=a.student_id WHERE a.school_id=? AND s.deleted_at IS NULL GROUP BY a.class_admitted ORDER BY a.class_admitted`, [schoolId]);
  const [recent] = await getPool().execute<RowDataPacket[]>(`SELECT action_name title,CONCAT(entity_type,' #',COALESCE(entity_id,'')) meta,DATE_FORMAT(created_at,'%d %b %H:%i') time FROM v2_audit_events WHERE school_id=? ORDER BY created_at DESC LIMIT 6`, [schoolId]);
  return {
    totals: {
      students: Number(totals?.students || 0), active: Number(totals?.active || 0),
      events: Number(events?.total || 0), fees: Number(fees?.total || 0),
      certificates: Number(certificates?.total || 0), schools: 1, pendingCertificates: 0,
    },
    enrollmentByClass: classes,
    recent,
  };
}

export async function bulkPromoteProductionStudents(schoolId: number, studentIds: number[], targetClass: string, targetSection: string | undefined, userId: number) {
  return withTransaction(async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT s.id, a.class_admitted oldClass, a.section_name oldSection
       FROM v2_students s JOIN v2_admissions a ON a.student_id = s.id
       WHERE s.school_id = ? AND s.id IN (${studentIds.map(() => "?").join(",")}) AND s.deleted_at IS NULL`,
      [schoolId, ...studentIds]
    );
    if (!rows.length) throw Object.assign(new Error("No valid students found for promotion."), { statusCode: 404 });
    const updated: number[] = [];
    for (const row of rows) {
      await connection.execute("UPDATE v2_admissions SET class_admitted=?, section_name=? WHERE student_id=?", [targetClass, targetSection || null, row.id]);
      await connection.execute(
        "INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json) VALUES (?,?,'student',?,'student.promote',JSON_OBJECT('from',?,'to',?))",
        [schoolId, userId, row.id, `${row.oldClass} ${row.oldSection || ""}`.trim(), `${targetClass} ${targetSection || ""}`.trim()]
      );
      updated.push(row.id);
    }
    return { promoted: updated.length, studentIds: updated };
  });
}

export async function bulkAssignProductionStudents(schoolId: number, studentIds: number[], assignType: "class" | "section", value: string, userId: number) {
  return withTransaction(async connection => {
    const column = assignType === "class" ? "class_admitted" : "section_name";
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT s.id FROM v2_students s JOIN v2_admissions a ON a.student_id = s.id
       WHERE s.school_id = ? AND s.id IN (${studentIds.map(() => "?").join(",")}) AND s.deleted_at IS NULL`,
      [schoolId, ...studentIds]
    );
    if (!rows.length) throw Object.assign(new Error("No valid students found."), { statusCode: 404 });
    const ids = rows.map(r => r.id);
    await connection.execute(
      `UPDATE v2_admissions SET ${column}=? WHERE student_id IN (${ids.map(() => "?").join(",")})`,
      [value, ...ids]
    );
    for (const id of ids) {
      await connection.execute(
        "INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json) VALUES (?,?,'student',?,'student.assign',JSON_OBJECT('field',?,'value',?))",
        [schoolId, userId, id, assignType, value]
      );
    }
    return { assigned: ids.length, studentIds: ids };
  });
}

export async function graduateGradeTenStudents(schoolId: number, studentIds: number[], userId: number) {
  return withTransaction(async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT s.id, s.current_status currentStatus, a.class_admitted className
       FROM v2_students s
       JOIN v2_admissions a ON a.student_id = s.id
       WHERE s.school_id = ? AND s.id IN (${studentIds.map(() => "?").join(",")})
         AND s.deleted_at IS NULL FOR UPDATE`,
      [schoolId, ...studentIds],
    );
    const terminalClasses = new Set(["10", "grade 10", "class 10", "x"]);
    const eligible = rows.filter((row: any) =>
      row.currentStatus === "active" && terminalClasses.has(String(row.className || "").trim().toLowerCase()),
    );
    for (const row of eligible as any[]) {
      await connection.execute("UPDATE v2_students SET current_status = 'alumni' WHERE id = ?", [row.id]);
      await connection.execute(
        `INSERT INTO v2_student_status_history (student_id, old_status, new_status, reason, changed_by)
         VALUES (?, ?, 'alumni', 'Grade 10 completion', ?)`,
        [row.id, row.currentStatus, userId],
      );
      await connection.execute(
        `INSERT INTO v2_audit_events
         (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
         VALUES (?, ?, 'student', ?, 'student.graduate', JSON_OBJECT('fromClass', ?, 'status', 'alumni'))`,
        [schoolId, userId, row.id, row.className],
      );
    }
    return {
      graduated: eligible.length,
      studentIds: eligible.map((row: any) => Number(row.id)),
      skipped: rows.length - eligible.length,
    };
  });
}

export async function getProductionStudentTimeline(schoolId: number, studentId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT ae.id, ae.action_name actionName, ae.metadata_json metadataJson,
            ae.created_at createdAt, u.name actorName
     FROM v2_audit_events ae
     LEFT JOIN v2_users u ON u.id = ae.user_id
     WHERE ae.school_id = ? AND ae.entity_type = 'student' AND ae.entity_id = ?
     ORDER BY ae.created_at DESC LIMIT 100`,
    [schoolId, studentId]
  );
  return rows;
}

export async function getProductionStudentMedical(schoolId: number, studentId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT * FROM v2_student_medical WHERE school_id = ? AND student_id = ? LIMIT 1",
    [schoolId, studentId]
  );
  return rows[0] || null;
}

export async function upsertProductionStudentMedical(schoolId: number, studentId: number, data: {
  blood_group?: string; allergies?: string; medications?: string; conditions?: string;
  emergency_contact_name?: string; emergency_contact_phone?: string; insurance_info?: string;
}) {
  await getPool().execute(
    `INSERT INTO v2_student_medical (student_id, school_id, blood_group, allergies, medications, conditions, emergency_contact_name, emergency_contact_phone, insurance_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE blood_group=VALUES(blood_group), allergies=VALUES(allergies), medications=VALUES(medications),
       conditions=VALUES(conditions), emergency_contact_name=VALUES(emergency_contact_name),
       emergency_contact_phone=VALUES(emergency_contact_phone), insurance_info=VALUES(insurance_info)`,
    [studentId, schoolId, data.blood_group || null, data.allergies || null, data.medications || null,
     data.conditions || null, data.emergency_contact_name || null, data.emergency_contact_phone || null, data.insurance_info || null]
  );
  return getProductionStudentMedical(schoolId, studentId);
}

export async function getProductionStudentNotes(schoolId: number, studentId: number, noteType?: string) {
  const conditions = ["school_id = ?", "student_id = ?"];
  const params: Array<string | number> = [schoolId, studentId];
  if (noteType) { conditions.push("note_type = ?"); params.push(noteType); }
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT n.*, u.name createdByName FROM v2_student_notes n
     LEFT JOIN v2_users u ON u.id = n.created_by
     WHERE ${conditions.join(" AND ")} ORDER BY n.created_at DESC LIMIT 100`,
    params
  );
  return rows;
}

export async function createProductionStudentNote(schoolId: number, studentId: number, userId: number, data: {
  noteType: string; title: string; content: string;
}) {
  const [result] = await getPool().execute<ResultSetHeader>(
    "INSERT INTO v2_student_notes (student_id, school_id, note_type, title, content, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [studentId, schoolId, data.noteType, data.title, data.content, userId]
  );
  return { id: result.insertId, ...data, createdBy: userId, createdAt: new Date().toISOString() };
}

export async function deleteProductionStudentNote(schoolId: number, noteId: number) {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM v2_student_notes WHERE id = ? AND school_id = ?",
    [noteId, schoolId]
  );
  if (!result.affectedRows) throw Object.assign(new Error("Note not found."), { statusCode: 404 });
}

export async function getProductionAcademicSetup(schoolId: number) {
  const [years] = await getPool().execute<RowDataPacket[]>("SELECT name FROM v2_academic_years WHERE school_id = ? ORDER BY start_date DESC", [schoolId]);
  const [boards] = await getPool().query<RowDataPacket[]>("SELECT code FROM v2_boards ORDER BY code");
  const [classes] = await getPool().execute<RowDataPacket[]>("SELECT name FROM v2_classes WHERE school_id = ? ORDER BY sort_order, name", [schoolId]);
  return { academicYears: years.map(row => String(row.name)), boards: boards.map(row => String(row.code)), classes: classes.map(row => String(row.name)) };
}
