# Student Information Module

## Scope

The student intake workflow preserves every meaningful field from the legacy `student_details` table while replacing the legacy 42-column record with normalized, school-scoped records.

The legacy SQL dump remains read-only. Its plaintext passwords, API tokens and child data are never copied into source control.

## Form structure

| Form section | Legacy fields covered |
|---|---|
| Admission | `SchoolName`, `AcademicYear`, `Board`, `IDNo`, `AdmissionNo`, `DateOfAdmission`, `ClassAdmitted`, `PreviousSchoolClass`, `TCNumber` |
| Student identity | `NameOfThePupil`, `DateOfBirth`, `Nationality`, `Religion`, `Caste`, `SubCaste`, `MotherTongue`, `StudentAadhaarNo`, `PENNo`, `AAPARID`, `PhotoOfStudent` |
| Parents and guardians | All father and mother identity, mobile, email, qualification, occupation and bank fields |
| Contact and residence | `MailID`, `ResidenceAddress` |
| Leaving and TC | `ClassLeaving`, `DateOfLeaving`, `LeavingTCNo`, `TCTakenDate` |

Gender and section are added because they are operationally required but absent from the legacy table.

## Data rules

- School ownership comes from the authenticated session, never a client-provided school ID.
- Admission numbers are unique inside a school.
- The application generates `student_uid`; office staff do not type it.
- Aadhaar accepts exactly 12 digits and must be encrypted before production persistence.
- Aadhaar and bank numbers are masked by default.
- Dates use real SQL `DATE` values rather than legacy text fields.
- Empty legacy placeholders such as `-`, `_` and blank strings normalize to `NULL`.
- A student photograph accepts JPEG, PNG or WebP up to 5 MB.
- Leaving information is optional for active admissions and belongs to an approval-controlled TC workflow.

## Required production transaction

Creating a student must execute as one database transaction:

1. Confirm the user has `student.create` for the authenticated school.
2. Reserve the school-scoped admission number and generated student UID.
3. Insert `v2_students`.
4. Insert typed identifiers.
5. Insert guardians and student-guardian relationships.
6. Insert residence address.
7. Insert admission and current enrolment.
8. Store the photograph in private storage and save only its storage key.
9. Append a redacted `v2_audit_events` record.
10. Commit. Roll back every step if any insert fails.

Sensitive values must never be written to application logs or audit JSON.

## API contract

`POST /api/students` uses `multipart/form-data`.

Required fields:

- `fullName`
- `admissionNo`
- `academicYear`
- `board`
- `dateOfAdmission`
- `dateOfBirth`
- `classAdmitted`
- `residenceAddress`
- `confirmed`

The API validates all fields independently of browser validation and returns `409` for a duplicate school admission number.

## Permissions

- `student.view`
- `student.create`
- `student.update`
- `student.status.change`
- `student.identifier.view_sensitive`
- `student.document.upload`
- `student.export`

Viewing Aadhaar, exporting records and changing status must create audit events.

## Remaining production connection

The complete form and API validation operate in demo mode. Before production:

1. Apply migrations `001` and `002` to a staging clone.
2. Implement the MySQL transaction repository described above.
3. Configure private object storage and malware scanning for uploads.
4. Provision fresh hashed user accounts and remove demo authentication.
5. Run tenant-isolation, duplicate, rollback, authorization and upload tests.
6. Reconcile staged legacy imports by school and source record ID.

No Hostinger production database should be changed until staging reconciliation and restore testing pass.

