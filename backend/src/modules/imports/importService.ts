import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, withTransaction } from "../../database/pool.js";
import { createProductionStudent, ProductionStudentInput } from "../students/studentRepository.js";

const aliases:Record<string,string>={
  idno:"idNo",admissionno:"admissionNo",nameofthepupil:"fullName",studentaadhaarno:"studentAadhaarNo",
  penno:"penNo",aaparid:"apaarId",apaarid:"apaarId",fathername:"fatherName",fatheraadhaarno:"fatherAadhaarNo",
  fathermobilenumber:"fatherMobileNumber",mailid:"studentEmail",mothername:"motherName",motheraadharno:"motherAadhaarNo",
  mothermobileno:"motherMobileNumber",motherbankaccountno:"motherBankAccountNo",bankifsccode:"bankIfscCode",
  residenceaddress:"residenceAddress",fatherqualification:"fatherQualification",fatheroccupation:"fatherOccupation",
  fathermailid:"fatherEmail",motherqualification:"motherQualification",motheroccupation:"motherOccupation",
  mothermailid:"motherEmail",previousschoolclass:"previousSchoolClass",tcnumber:"previousTcNo",dateofadmission:"dateOfAdmission",
  dateofbirth:"dateOfBirth",nationality:"nationality",religion:"religion",caste:"caste",subcaste:"subCaste",
  mothertongue:"motherTongue",classadmitted:"classAdmitted",classleaving:"classLeaving",dateofleaving:"dateOfLeaving",
  leavingtcno:"leavingTcNo",tctakendate:"tcTakenDate",academicyear:"academicYear",board:"board",gender:"gender",section:"sectionName"
};
const cleanHeader=(value:unknown)=>String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"");
const cleanValue=(value:unknown)=>{
  if(value instanceof Date)return value.toISOString().slice(0,10);
  if(value&&typeof value==="object"&&"text" in value)return String((value as {text:unknown}).text);
  const text=String(value??"").trim();return ["","-","_","null","n/a"].includes(text.toLowerCase())?undefined:text;
};
const isoDate=(value:unknown)=>{
  const cleaned=cleanValue(value);if(!cleaned)return undefined;
  if(/^\d{4}-\d{2}-\d{2}$/.test(cleaned))return cleaned;
  const match=cleaned.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if(match)return `${match[3]!}-${match[2]!.padStart(2,"0")}-${match[1]!.padStart(2,"0")}`;
  const date=new Date(cleaned);return Number.isNaN(date.valueOf())?undefined:date.toISOString().slice(0,10);
};
export async function parseStudentWorkbook(buffer:Buffer,filename:string){
  const workbook=new ExcelJS.Workbook();
  if(filename.toLowerCase().endsWith(".csv"))await workbook.csv.read(Readable.from(buffer));
  else await workbook.xlsx.load(buffer as never);
  const sheet=workbook.worksheets[0];if(!sheet)throw Object.assign(new Error("The workbook has no worksheet."),{statusCode:422});
  const headers:string[]=[];sheet.getRow(1).eachCell({includeEmpty:true},(cell,col)=>{headers[col-1]=aliases[cleanHeader(cell.value)]||"";});
  if(!headers.includes("admissionNo")||!headers.includes("fullName"))throw Object.assign(new Error("Required columns AdmissionNo and NameOfThePupil were not found."),{statusCode:422});
  const rows:Array<{rowNumber:number;raw:Record<string,unknown>}>=[];sheet.eachRow((row,rowNumber)=>{if(rowNumber===1)return;const raw:Record<string,unknown>={};headers.forEach((key,index)=>{if(key)raw[key]=row.getCell(index+1).value;});if(Object.values(raw).some(cleanValue))rows.push({rowNumber,raw});});
  return rows;
}
export function validateRows(rows:Array<{rowNumber:number;raw:Record<string,unknown>}>,existing:Set<string>){
  const seen=new Set<string>();
  return rows.map(({rowNumber,raw})=>{
    const normalized:Record<string,unknown>={};for(const [key,value] of Object.entries(raw))normalized[key]=cleanValue(value);
    for(const field of ["dateOfAdmission","dateOfBirth","dateOfLeaving","tcTakenDate"])normalized[field]=isoDate(raw[field]);
    normalized.board=cleanValue(raw.board)?.toUpperCase();normalized.gender=cleanValue(raw.gender)?.toLowerCase();
    const errors:string[]=[];for(const field of ["admissionNo","fullName","academicYear","board","dateOfAdmission","dateOfBirth","classAdmitted","residenceAddress"])if(!normalized[field])errors.push(`${field} is required`);
    if(normalized.studentAadhaarNo&&!/^\d{12}$/.test(String(normalized.studentAadhaarNo)))errors.push("studentAadhaarNo must contain 12 digits");
    const admission=String(normalized.admissionNo||"").toLowerCase();const duplicate=!!admission&&(seen.has(admission)||existing.has(admission));if(admission)seen.add(admission);
    return {rowNumber,raw,normalized:normalized as unknown as ProductionStudentInput,errors,status:duplicate?"duplicate":errors.length?"error":"valid"};
  });
}
export async function existingAdmissionNumbers(schoolId:number){
  const [rows]=await getPool().execute<RowDataPacket[]>("SELECT admission_no FROM v2_students WHERE school_id=?",[schoolId]);
  return new Set(rows.map(row=>String(row.admission_no).toLowerCase()));
}
export async function stageBatch(context:{schoolId:number;userId:number},sourceType:"excel"|"csv"|"legacy",filename:string,rows:ReturnType<typeof validateRows>){
  const id=randomUUID();await withTransaction(async connection=>{
    const valid=rows.filter(r=>r.status==="valid").length,error=rows.filter(r=>r.status==="error").length,duplicate=rows.filter(r=>r.status==="duplicate").length;
    await connection.execute("INSERT INTO v2_import_batches (id,school_id,uploaded_by,source_type,original_filename,status,total_rows,valid_rows,error_rows,duplicate_rows) VALUES (?,?,?,?,?,'ready',?,?,?,?)",[id,context.schoolId,context.userId,sourceType,filename,rows.length,valid,error,duplicate]);
    for(const row of rows)await connection.execute("INSERT INTO v2_import_rows (batch_id,source_row_number,source_record_id,raw_json,normalized_json,row_status,errors_json) VALUES (?,?,?,?,?,?,?)",[id,row.rowNumber,(row.raw.id as number)||null,JSON.stringify(row.raw),JSON.stringify(row.normalized),row.status,JSON.stringify(row.errors)]);
    await connection.execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.stage',JSON_OBJECT('batchId',?,'rows',?))",[context.schoolId,context.userId,id,rows.length]);
  });return getBatch(context.schoolId,id);
}
export async function getBatch(schoolId:number,id:string){
  const [batches]=await getPool().execute<RowDataPacket[]>("SELECT * FROM v2_import_batches WHERE id=? AND school_id=?",[id,schoolId]);if(!batches[0])throw Object.assign(new Error("Import batch not found."),{statusCode:404});
  const [rows]=await getPool().execute<RowDataPacket[]>("SELECT id,source_row_number sourceRowNumber,row_status status,errors_json errors,normalized_json normalized FROM v2_import_rows WHERE batch_id=? ORDER BY source_row_number LIMIT 500",[id]);
  return {...batches[0],rows};
}
export async function listBatches(schoolId:number){const [rows]=await getPool().execute<RowDataPacket[]>("SELECT id,source_type sourceType,original_filename filename,status,total_rows totalRows,valid_rows validRows,error_rows errorRows,duplicate_rows duplicateRows,imported_rows importedRows,created_at createdAt FROM v2_import_batches WHERE school_id=? ORDER BY created_at DESC LIMIT 50",[schoolId]);return rows;}
export async function approveBatch(context:{schoolId:number;userId:number},id:string){
  const batch:any=await getBatch(context.schoolId,id);if(!["ready","approved","completed_with_errors"].includes(String(batch.status)))throw Object.assign(new Error("This batch cannot be imported in its current state."),{statusCode:409});
  await getPool().execute("UPDATE v2_import_batches SET status='importing',approved_by=?,approved_at=UTC_TIMESTAMP(),processed_rows=0,last_processed_row=0 WHERE id=?",[context.userId,id]);
  return processBatchChunk(context,id);
}

export async function processBatchChunk(context:{schoolId:number;userId:number},id:string,chunkSize:number=1000){
  const batch:any=await getBatch(context.schoolId,id);
  if(batch.status!=="importing")throw Object.assign(new Error("Batch is not in importing state."),{statusCode:409});
  const lastProcessed=batch.last_processed_row||0;
  const [rows]=await getPool().execute<RowDataPacket[]>(
    "SELECT id,source_row_number,normalized_json FROM v2_import_rows WHERE batch_id=? AND row_status='valid' AND source_row_number>? ORDER BY source_row_number LIMIT ?",
    [id,lastProcessed,chunkSize]
  );
  if(rows.length===0){
    const [counts]=await getPool().execute<RowDataPacket[]>(
      "SELECT SUM(CASE WHEN row_status='imported' THEN 1 ELSE 0 END) as imported,SUM(CASE WHEN row_status='error' THEN 1 ELSE 0 END) as failed FROM v2_import_rows WHERE batch_id=?",
      [id]
    );
    const imported=counts[0]?.imported||0;
    const failed=counts[0]?.failed||0;
    await getPool().execute("UPDATE v2_import_batches SET status=?,imported_rows=?,error_rows=?,valid_rows=0,completed_at=UTC_TIMESTAMP() WHERE id=?",[failed?"completed_with_errors":"completed",imported,failed,id]);
    await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.approve',JSON_OBJECT('batchId',?,'imported',?,'failed',?))",[context.schoolId,context.userId,id,imported,failed]);
    return getBatch(context.schoolId,id);
  }
  let imported=0,failed=0;
  for(const row of rows){
    try{
      const data=typeof row.normalized_json==="string"?JSON.parse(row.normalized_json):row.normalized_json;
      const student=await createProductionStudent(data,context);
      await getPool().execute("UPDATE v2_import_rows SET row_status='imported',imported_student_id=? WHERE id=?",[student.id,row.id]);
      imported++;
    }catch(error){
      await getPool().execute("UPDATE v2_import_rows SET row_status='error',errors_json=? WHERE id=?",[JSON.stringify([(error as Error).message]),row.id]);
      failed++;
    }
  }
  const lastRow=rows[rows.length-1]?.source_row_number||lastProcessed;
  await getPool().execute(
    "UPDATE v2_import_batches SET processed_rows=processed_rows+?,last_processed_row=?,imported_rows=imported_rows+?,error_rows=error_rows+? WHERE id=?",
    [rows.length,lastRow,imported,failed,id]
  );
  if(rows.length===chunkSize){
    return {batchId:id,status:"processing",processed:batch.processed_rows+rows.length,total:batch.total_rows,nextChunk:true};
  }
  const [counts]=await getPool().execute<RowDataPacket[]>(
    "SELECT SUM(CASE WHEN row_status='imported' THEN 1 ELSE 0 END) as imported,SUM(CASE WHEN row_status='error' THEN 1 ELSE 0 END) as failed FROM v2_import_rows WHERE batch_id=?",
    [id]
  );
  const totalImported=counts[0]?.imported||0;
  const totalFailed=counts[0]?.failed||0;
  await getPool().execute("UPDATE v2_import_batches SET status=?,imported_rows=?,error_rows=?,valid_rows=0,completed_at=UTC_TIMESTAMP() WHERE id=?",[totalFailed?"completed_with_errors":"completed",totalImported,totalFailed,id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.approve',JSON_OBJECT('batchId',?,'imported',?,'failed',?))",[context.schoolId,context.userId,id,totalImported,totalFailed]);
  return getBatch(context.schoolId,id);
}

export async function cancelBatch(context:{schoolId:number;userId:number},id:string){
  const batch:any=await getBatch(context.schoolId,id);
  if(!["ready","approved","importing"].includes(String(batch.status)))throw Object.assign(new Error("This batch cannot be cancelled in its current state."),{statusCode:409});
  await getPool().execute("UPDATE v2_import_batches SET status='cancelled',cancelled_at=UTC_TIMESTAMP(),cancelled_by=? WHERE id=?",[context.userId,id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.cancel',JSON_OBJECT('batchId',?))",[context.schoolId,context.userId,id]);
  return getBatch(context.schoolId,id);
}

export async function getImportHistory(schoolId:number){
  const [rows]=await getPool().execute<RowDataPacket[]>(
    `SELECT id,source_type sourceType,original_filename filename,status,total_rows totalRows,
            valid_rows validRows,error_rows errorRows,duplicate_rows duplicateRows,
            imported_rows importedRows,processed_rows processedRows,
            created_at createdAt,completed_at completedAt,cancelled_at cancelledAt
     FROM v2_import_batches WHERE school_id=? ORDER BY created_at DESC LIMIT 100`,
    [schoolId]
  );
  return rows;
}

export async function getImportProgress(schoolId:number,id:string){
  const [rows]=await getPool().execute<RowDataPacket[]>(
    "SELECT id,status,total_rows totalRows,processed_rows processedRows,imported_rows importedRows,error_rows errorRows,last_processed_row lastProcessedRow FROM v2_import_batches WHERE id=? AND school_id=?",
    [id,schoolId]
  );
  if(!rows[0])throw Object.assign(new Error("Import batch not found."),{statusCode:404});
  const batch=rows[0];
  const percentage=batch.totalRows>0?Math.round((batch.processedRows/batch.totalRows)*100):0;
  return {...batch,percentage};
}

export async function rejectBatch(context:{schoolId:number;userId:number},id:string){
  const batch=await getBatch(context.schoolId,id) as any;
  if(!["ready","approved"].includes(String(batch.status)))throw Object.assign(new Error("This batch cannot be rejected in its current state."),{statusCode:409});
  await getPool().execute("UPDATE v2_import_batches SET status='rejected' WHERE id=?",[id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.reject',JSON_OBJECT('batchId',?))",[context.schoolId,context.userId,id]);
  return getBatch(context.schoolId,id);
}

export async function rollbackBatch(context:{schoolId:number;userId:number},id:string){
  const batch:any=await getBatch(context.schoolId,id);
  if(!["completed","completed_with_errors"].includes(String(batch.status)))throw Object.assign(new Error("Only completed imports can be rolled back."),{statusCode:409});
  const [importedRows]=await getPool().execute<RowDataPacket[]>("SELECT imported_student_id FROM v2_import_rows WHERE batch_id=? AND row_status='imported' AND imported_student_id IS NOT NULL",[id]);
  const studentIds=importedRows.map(r=>r.imported_student_id).filter(Boolean);
  if(studentIds.length){
    await getPool().execute(`UPDATE v2_students SET deleted_at=UTC_TIMESTAMP(), current_status='inactive' WHERE id IN (${studentIds.map(()=>"?").join(",")})`,studentIds);
    await getPool().execute(`UPDATE v2_admissions SET status='revoked' WHERE student_id IN (${studentIds.map(()=>"?").join(",")})`,studentIds);
  }
  await getPool().execute("UPDATE v2_import_rows SET row_status='error',errors_json=JSON_ARRAY('Rolled back'),imported_student_id=NULL WHERE batch_id=? AND row_status='imported'",[id]);
  await getPool().execute("UPDATE v2_import_batches SET status='rolled_back',imported_rows=0,completed_at=UTC_TIMESTAMP() WHERE id=?",[id]);
  await getPool().execute("INSERT INTO v2_audit_events (school_id,user_id,entity_type,entity_id,action_name,metadata_json) VALUES (?,?,'import',NULL,'import.rollback',JSON_OBJECT('batchId',?,'studentsReversed',?))",[context.schoolId,context.userId,id,studentIds.length]);
  return getBatch(context.schoolId,id);
}

export async function getErrorReportHtml(schoolId:number,id:string){
  const batch:any=await getBatch(schoolId,id);
  const [rows]=await getPool().execute<RowDataPacket[]>("SELECT source_row_number,row_status,errors_json,raw_json FROM v2_import_rows WHERE batch_id=? AND row_status IN ('error','duplicate') ORDER BY source_row_number",[id]);
  const rowsHtml=rows.map(r=>{
    const errors=typeof r.errors_json==="string"?JSON.parse(r.errors_json):r.errors_json;
    const raw=typeof r.raw_json==="string"?JSON.parse(r.raw_json):r.raw_json;
    const statusColor=r.row_status==="duplicate"?"#f59e0b":"#ef4444";
    return `<tr><td>${r.source_row_number}</td><td>${raw.fullName||raw.NameOfThePupil||"—"}</td><td>${raw.admissionNo||raw.AdmissionNo||"—"}</td><td style="color:${statusColor};font-weight:600">${r.row_status}</td><td>${errors.map((e:string)=>`<div class="err">• ${e}</div>`).join("")}</td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Import Error Report — ${batch.original_filename||batch.filename}</title><style>
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
    <div class="header"><h1>Import Error Report</h1><p>${batch.original_filename||batch.filename} · Generated ${new Date().toLocaleString()}</p></div>
    <div class="metrics">
      <div class="metric"><strong>${batch.total_rows}</strong><small>Total Rows</small></div>
      <div class="metric bad"><strong>${batch.error_rows}</strong><small>Errors</small></div>
      <div class="metric warn"><strong>${batch.duplicate_rows}</strong><small>Duplicates</small></div>
    </div>
    <table><thead><tr><th>Row</th><th>Student Name</th><th>Admission No</th><th>Status</th><th>Issues</th></tr></thead>
    <tbody>${rowsHtml||'<tr><td colspan="5" style="text-align:center;padding:32px;color:#6b7280">No errors found.</td></tr>'}</tbody></table>
    <div class="footer">Montessori School Management · Automated Error Report</div>
  </body></html>`;
}
