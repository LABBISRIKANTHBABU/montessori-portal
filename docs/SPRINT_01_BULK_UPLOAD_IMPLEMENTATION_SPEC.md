# Sprint 01 - Bulk Upload Implementation Spec

**Module:** Student Bulk Upload
**Priority:** Critical
**Reason:** The portal cannot become useful for the client until real student data can be imported safely, validated clearly and traced after import.

---

## 1. Scope

This sprint completes the student bulk upload lifecycle:

```text
Excel upload
-> Header mapping
-> Row validation
-> Preview batch
-> Error report
-> Accept import
-> Transactional persistence
-> Import history
```

Out of scope for this sprint:

- Certificates.
- Voucher workflow.
- Event gallery.
- Full dashboard redesign.
- Academic promotion workflow.

---

## 2. Backend tasks

### 2.1 API endpoints

Required endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/imports/students/upload` | Upload workbook and create preview batch |
| `GET` | `/api/imports/students/batches` | List import history |
| `GET` | `/api/imports/students/batches/:id` | View batch rows and summary |
| `GET` | `/api/imports/students/batches/:id/errors.csv` | Download row-level error report |
| `POST` | `/api/imports/students/batches/:id/accept` | Import valid staged rows |
| `POST` | `/api/imports/students/batches/:id/rollback` | Roll back a completed batch where supported |

### 2.2 Service responsibilities

The import service must own:

- Workbook parsing.
- Header extraction.
- Header alias mapping.
- Required header validation.
- Cell normalization.
- Row validation.
- Duplicate detection.
- Staging rows.
- Error report generation.
- Batch acceptance.
- Batch status updates.

### 2.3 Repository responsibilities

The repository must own:

- Creating import batches.
- Creating import rows.
- Reading staged rows.
- Checking existing admission numbers.
- Creating students in transaction.
- Updating row statuses.
- Updating batch status.
- Writing audit events.

### 2.4 Transaction rule

The accept endpoint must not leave an unclear half-imported state.

Preferred implementation:

```text
Open DB transaction
-> Lock batch
-> Read valid staged rows
-> Insert all student records and child records
-> Mark rows imported
-> Mark batch completed
-> Write audit event
-> Commit
```

On failure:

```text
Rollback
-> Keep staged batch
-> Save failure message
-> Return actionable error
```

---

## 3. Frontend tasks

### 3.1 Upload page

Must show:

- File picker.
- Accepted formats.
- Download template button.
- Header mapping panel.
- Upload progress/loading state.
- Clear validation errors.

### 3.2 Preview page/state

Must show:

- Total row count.
- Valid row count.
- Error row count.
- Duplicate row count.
- Error table with row number, column and message.
- Accept import button.
- Download error CSV button.

### 3.3 History page/section

Must show:

- Uploaded file name.
- Uploaded by.
- Uploaded date/time.
- Total rows.
- Valid rows.
- Failed rows.
- Status.
- Action to view details.

---

## 4. Permissions

| Permission | Meaning |
|---|---|
| `import.students.upload` | Can upload and stage student workbooks |
| `import.students.approve` | Can accept/import staged valid rows |
| `import.students.rollback` | Can rollback supported batches |
| `import.students.view` | Can view import history |

School Admin:

- Can import only into own school.

Super Admin:

- Can select target school.
- Can view all school imports.
- Can approve/rollback where policy allows.

---

## 5. Validation rules

| Field | Required | Rule |
|---|---:|---|
| Admission Number | Yes | Unique within school and academic year |
| Student Name | Yes | Non-empty text |
| DOB | Yes/Policy | Valid date when present |
| Aadhaar | No | Exactly 12 digits when present |
| Parent Phone | No | Exactly 10 digits when present |
| Email | No | Valid email when present |
| Academic Year | Yes | Must exist in master data |
| Class | Yes/Policy | Must be valid text/master value |
| Section | No | Valid text/master value when present |
| Address | Yes/Policy | Required if legacy/client format requires it |

---

## 6. Error report columns

CSV error report should include:

- Row number.
- Admission number.
- Student name.
- Field/column.
- Error code.
- Error message.
- Raw value.

---

## 7. Acceptance checklist

Bulk Upload is complete only when:

- Upload does not insert students directly.
- Preview works for valid and invalid files.
- Header mapping works.
- Missing required headers are shown clearly.
- Row errors include exact row and column.
- Duplicate admission numbers are detected inside the workbook.
- Duplicate admission numbers are detected in the database.
- Error CSV downloads correctly.
- Accept imports valid rows safely.
- Failed accept rolls back cleanly.
- Import history is visible.
- School isolation is enforced.
- Super Admin target-school flow works.
- Audit events are written.
- Backend tests pass.
- Frontend tests pass.
- Manual browser test passes.

---

## 8. Test commands

```powershell
cd E:\montessori-portal
npm run build -w backend
npm run test -w backend
npm run build -w frontend
npm run test -w frontend
```

