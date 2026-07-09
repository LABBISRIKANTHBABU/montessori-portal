# Legacy Student Sync Runbook

This runbook imports existing records from the read-only legacy `student_details` table into the normalized v2 student tables so they appear in the frontend Student Directory.

The immediate priority school is:

```text
MSSSACK - Montessori Senior Secondary School, A-Camp, Kurnool
```

The SQL dump shows this school has roughly 8600 legacy student rows, so the frontend must always use pagination/search/filtering. Do not load all students into the browser at once.

---

## What the sync does

For the selected school code, the script:

1. Reads legacy `student_details`.
2. Ensures required v2 academic years exist.
3. Ensures boards/classes exist.
4. Skips records already imported by `legacy_student_id` or admission number.
5. Creates normalized v2 records:
   - `v2_students`
   - `v2_student_identifiers`
   - `v2_guardians`
   - `v2_student_guardians`
   - `v2_student_addresses`
   - `v2_admissions`
   - `v2_student_leaving_records` where applicable
   - `v2_audit_events`
6. Preserves traceability using `v2_students.legacy_student_id`.

---

## Dry run first

```powershell
cd E:\montessori-portal\backend
$env:SCHOOL_CODE="MSSSACK"
$env:DRY_RUN="true"
npm run legacy:sync-students
```

Dry run validates mapping and prints counts without writing student records.

---

## Import A-Camp students

Only run this after database connectivity is healthy and a database backup exists.

```powershell
cd E:\montessori-portal\backend
$env:SCHOOL_CODE="MSSSACK"
$env:DRY_RUN="false"
npm run legacy:sync-students
```

Optional small batch:

```powershell
$env:LIMIT="500"
$env:OFFSET="0"
npm run legacy:sync-students
```

Then increase `OFFSET` by 500 for the next batch.

---

## Verify after import

```sql
SELECT s.legacy_code, s.name, COUNT(v.id) students
FROM v2_schools s
LEFT JOIN v2_students v ON v.school_id = s.id AND v.deleted_at IS NULL
WHERE s.legacy_code = 'MSSSACK'
GROUP BY s.id;
```

Frontend:

1. Login as Super Admin or A-Camp School Admin.
2. Select A-Camp / `MSSSACK`.
3. Open Student Directory.
4. Confirm pagination count shows the imported records.
5. Search by admission number and student name.
6. Open a student profile and verify guardians/address/admission details.

---

## Current known blocker

If the backend shows:

```text
ER_ACCESS_DENIED_ERROR
```

the API and sync script cannot read Hostinger MySQL. Fix `backend/.env` database credentials or Hostinger remote MySQL permissions before running the sync.

