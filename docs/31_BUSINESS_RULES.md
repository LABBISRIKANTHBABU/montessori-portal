# 31 Business Rules

These rules define how the system behaves under the hood. They are as important as the UI and must be strictly enforced at the backend validation layer.

## Student Rules

- **Admission Number:** Must be unique within a school.
- **Aadhaar:** Optional or required based on school policy (configurable).
- **Date of Birth:** Cannot be in the future.
- **Master Schema Adherence:** All student records must map to the 36 columns defined in `STUDENT_MASTER_SCHEMA.md`.
- **Gender:** Must be one of: male, female, other.
- **Status Transitions:**
  - Active -> Withdrawn (with reason)
  - Active -> Alumni (graduation)
  - Active -> Suspended (with reason)
  - Withdrawn -> Active (restore)
  - Suspended -> Active (restore)
  - Alumni -> Active (restore, rare)
- **Soft Delete:** Students are never hard-deleted. `deleted_at` and `deleted_by` are set. Records remain in the database for audit purposes.
- **School Isolation:** All student queries are filtered by `school_id` from the JWT. A user at School A can never see students from School B.
- **Photo Upload:** Maximum 5MB. Allowed types: JPEG, PNG, WebP. One photo per student (replaces previous).

## Document Management Rules

- **File Types:** Only PDF, JPG, PNG allowed for document uploads.
- **File Size:** Maximum 10MB per document.
- **Storage Path:** Documents stored in `uploads/documents/{school_id}/{student_id}/`.
- **Document Types:** Aadhaar, Birth Certificate, Marks Memo, Income Certificate, Caste Certificate, Bonafide, Transfer Certificate, Others.
- **Replacement:** Uploading a new version of an existing document type archives the old version. Both versions remain in the database.
- **Access:** Documents can only be viewed/ downloaded by users with the same `school_id`.
- **Metadata:** Each document records: upload date, uploaded by (user_id), file size, original filename, document type, academic year.

## Certificate Rules

- **Status Restriction:** Cannot generate a Transfer Certificate (TC) if the student is still Active. Student must be Withdrawn, Alumni, or Suspended.
- **Uniqueness:** Certificate numbers must be unique across the platform per school.
- **Audit Trail:** Every generated certificate permanently attaches to the student's profile history.
- **TC Trigger:** Generating a TC automatically changes student status to "Withdrawn" (if not already).
- **QR Code:** Each certificate includes a unique QR code linking to a verification URL.
- **Principal Signature:** Uploaded once in Settings, applied to all certificates automatically.
- **Auto-fill:** Student name, admission number, class, section, parent names, and dates are pulled from the student profile automatically.
- **Duplicate Prevention:** System warns if a certificate of the same type already exists for the student in the same academic year.

## Fee Rules

- **Overpayment:** Payment cannot exceed the outstanding balance unless advance payments are configured.
- **Receipts:** Receipts are generated sequentially per school (REC-2026-00001, REC-2026-00002, etc.).
- **Partial Payment:** Students may pay in installments. Each installment generates a separate receipt.
- **Fee Structure:** Defined per class per academic year. Includes fee categories and amounts.
- **Pending Fees:** Calculated as: Total Fee Structure - Sum(Payments). Updated in real-time.
- **Scholarships:** Reduce the payable amount. Recorded with approval by School Admin or Principal.
- **Refunds:** Handled manually by School Admin. Recorded as a negative entry in payment history.
- **Daily Cash Book:** All cash payments for the day are recorded. Opening balance + collections = closing balance.

## User & Role Rules

- **Data Entry Operator:** Cannot delete students permanently under any circumstances.
- **Principal:** Cannot create new schools or alter global platform configurations.
- **Super Admin:** The only role authorized to disable a school or provision a new school onto the platform.
- **Role Hierarchy:**
  - Group Super Admin: Full platform access
  - School Admin: Full school access
  - Principal: School-wide read access, certificate approval
  - Office Staff: Student CRUD, fee collection, import
  - Teacher: Student view, attendance (v1.1)
  - Accountant: Fee management, financial reports
  - Auditor: Read-only access to all data

## Event Rules

- **Creation:** Only School Admin and Principal can create events.
- **Photos/Videos:** Maximum 50 files per event. Maximum 25MB per file.
- **Archive:** Events older than 1 year are automatically archived but remain searchable.
- **Permissions:** Event media can be restricted to staff-only or shared with parents (v1.1).

## Import Rules

- **File Format:** Only .xlsx and .csv accepted.
- **Header Mapping:** Legacy column names are auto-mapped via alias dictionary (40+ mappings).
- **Validation:** Required fields: Admission No, Full Name, Date of Admission, Class Admitted, Date of Birth.
- **Duplicate Detection:** Admission number uniqueness checked against existing students in the same school.
- **Batch Processing:** Import creates a batch record. All rows in the batch are processed together.
- **Error Reporting:** Invalid rows are flagged with specific error messages. Error CSV is downloadable.
- **Approval:** Import requires explicit approval by a user with `import.approve` permission.

## Security Rules

- **Password Hashing:** bcrypt with 12 rounds.
- **Field Encryption:** Aadhaar and bank account numbers encrypted with AES-256-GCM.
- **Masked Values:** Last 4 digits stored in plain text alongside encrypted values (e.g., XXXX-XXXX-1234).
- **JWT Expiry:** Access tokens expire after 15 minutes. Refresh tokens expire after 7 days.
- **Session Revocation:** Sessions are revoked on logout. Revoked sessions cannot be refreshed.
- **Rate Limiting:** 30 requests per 15 minutes on auth endpoints.
- **CORS:** Restricted to configured FRONTEND_ORIGIN.
- **SQL Injection:** All queries use parameterized statements. No string concatenation.
- **Audit Logging:** All mutations (create, update, delete, status change, password change) are logged with user_id, school_id, entity_type, entity_id, action_name, and timestamp.
