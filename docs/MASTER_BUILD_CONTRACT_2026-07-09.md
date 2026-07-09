# Montessori Portal - Master Build Contract

**Date:** 9 July 2026
**Purpose:** Convert the latest review notes and meeting requirements into one strict execution contract for development.
**Rule:** Do not "fix everything" randomly. Build one module at a time, end to end, with database, backend, frontend, permissions, tests and documentation completed together.

---

## 1. Current health assessment

| Area | Current maturity | Meaning |
|---|---:|---|
| Infrastructure | 95% | Local stack, migrations, env configuration and deployment structure are mostly in place. |
| Authentication | 90% | Login and role loading are largely working; remaining work is production hardening and full role-session verification. |
| Dashboard UI | 70% | Usable, but must become database-driven, role-aware and empty-state safe. |
| Student Management | 50% | Core form and table exist, but details, edit, photo persistence, exports and production polish remain. |
| Bulk Upload | 20-35% | Parsing, staging and validation have started, but the final production-grade preview/accept/import contract must be completed first. |
| Certificates | 30% | Template and preview ideas exist; full rendering, approval and PDF correctness still need work. |
| Accounts / Vouchers | 25% | Workflow is defined but not production-complete. |
| Events / Gallery | 40% | Needs upload, database persistence, school isolation and gallery polish. |
| Academic Year Architecture | 10-25% | Academic year must become a first-class system concept before reporting and student lifecycle can be trusted. |
| Production Readiness | 60% | Good direction, but live frontend/backend/database integration and failure handling must be verified module by module. |

---

## 2. Non-negotiable development rules

1. Build one feature/module at a time.
2. Every module must include database changes, backend service logic, API validation, permissions, frontend UI, empty states, error states, tests and documentation.
3. No placeholder screens, TODO-only code, fake dashboard values or demo-only flows.
4. Controllers/routes must not contain raw database business logic.
5. Backend flow should be:

```text
Route
-> Validation
-> Controller / handler
-> Service
-> Repository
-> Database
```

6. Frontend flow should be:

```text
Page
-> Feature components
-> Hook / state helper
-> API client
-> Backend
```

7. All operational data must be school-scoped unless the authenticated user is Super Admin.
8. Super Admin may view and manage all schools. School Admin may only manage their assigned school.
9. Backend permissions are mandatory. Hiding buttons in the UI is not security.
10. Every high-risk action must create an audit event.

---

## 3. Standard API response contract

All new and refactored endpoints should follow this shape:

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "pages": 0
  }
}
```

Errors should be explicit:

```json
{
  "success": false,
  "message": "Admission number already exists",
  "code": "ADMISSION_DUPLICATE",
  "details": []
}
```

Do not return vague messages such as `Login failed`, `Something went wrong` or `Session expired` when the backend knows the real reason.

---

## 4. Role model and school isolation

### Super Admin

Super Admin is the system owner role.

Allowed:

- View all schools.
- Switch/filter dashboard by school.
- View combined system-wide dashboard.
- Create, update, disable and audit schools.
- Create and manage school admins.
- Approve vouchers.
- View all students, certificates, uploads, events and reports across schools.
- Override school-level records when business approval is available.
- View audit history across all schools.

Restrictions:

- Must still be audited for all sensitive changes.
- Must not bypass validation rules.
- Must not silently mutate school data without an audit trail.

### School Admin

School Admin is scoped to assigned school only.

Allowed:

- Manage students for their school.
- Upload students for their school.
- Generate certificates for their school.
- Manage school events/gallery for their school.
- Create vouchers for their school.
- View dashboard for their school only.

Restrictions:

- Cannot access another school's students.
- Cannot approve system-wide vouchers unless given a specific permission.
- Cannot create or disable schools.
- Cannot view cross-school audit data.

### Other operational roles

| Role | Purpose | Default scope |
|---|---|---|
| Principal | Review school data, reports and approvals | Own school |
| Accountant | Fees, receipts, vouchers and payment reports | Own school |
| Teacher | Attendance and student academic records | Assigned school/classes |
| Reception / Data Entry | Student creation, edits and uploads where permitted | Own school |

---

## 5. Correct implementation order

### Phase 1 - Critical system correctness

1. Student Bulk Upload
2. Student List display and filtering
3. Database consistency
4. School-wise segregation
5. Admission number uniqueness
6. Academic Year architecture

### Phase 2 - Student Management

1. Student form sections/tabs/wizard
2. Student details page
3. Student photo upload and private file serving
4. Student PDF/profile export
5. Student edit lifecycle
6. Student sorting/filtering/pagination

### Phase 3 - UI polish

1. Premium login layout
2. Dashboard redesign
3. Super Admin school dropdown
4. Better empty states
5. Responsive fixes

### Phase 4 - Certificate module

1. Certificate templates
2. Student data rendering
3. PDF generation
4. Approval/audit where required

### Phase 5 - Voucher module

```text
Admin creates voucher
-> Uploads bill
-> Super Admin reviews
-> Super Admin approves/rejects
-> Approved voucher generated
-> Audit event created
```

### Phase 6 - Event gallery

```text
Image upload
-> Validate file
-> Store file
-> Save metadata in database
-> Display gallery
-> Enforce school-wise visibility
```

---

## 6. Sprint 1: Bulk Upload production contract

Bulk Upload is the highest-priority module because it controls whether the school can bring real student data into the new portal safely.

### Required workflow

```text
Upload Excel
-> Validate file type and size
-> Read workbook
-> Read selected worksheet
-> Read headers
-> Validate required headers
-> Map Excel columns to system fields
-> Normalize every cell
-> Validate every row
-> Detect duplicates inside the workbook
-> Detect duplicates already in database
-> Create preview batch
-> Show valid/error/duplicate counts
-> Download error report
-> User accepts import
-> Insert valid rows in one controlled database transaction
-> Save import history
-> Update dashboard/list counts
```

### Hard rules

- Never directly insert students immediately after upload.
- Upload must create preview/staging only.
- The user must explicitly accept the validated batch.
- Every invalid row must show exact row number, column name and error message.
- Duplicate admission numbers must be reported, not silently overwritten.
- School Admin imports only into their own school.
- Super Admin must explicitly choose target school when importing globally.
- Import must be restart-safe: refreshing the browser should not lose the staged batch.
- Approval/import action must be audited.

### Validation rules

| Field | Rule |
|---|---|
| Admission Number | Required, trimmed, unique per school + academic year unless business rule says otherwise |
| Student Name | Required |
| DOB | Valid date |
| Aadhaar | Optional, but if present must be 12 digits |
| Phone | Optional, but if present must be 10 digits |
| Email | Optional, but if present must be valid email |
| Academic Year | Required and must exist |
| School | Required and must exist |
| Class/Section | Required when business process requires current enrollment |

### Preview summary

The preview screen must show:

- Total rows read.
- Valid rows.
- Error rows.
- Duplicate rows.
- Missing required field count.
- Existing database duplicate count.
- Downloadable CSV error report.

Example:

```text
100 rows uploaded
96 valid
4 rejected
2 duplicate admission numbers
1 invalid Aadhaar
1 missing student name
```

### Import transaction requirement

The final accept/import step should be a controlled database operation. If the selected valid rows cannot be imported reliably, the system must stop and report the failure instead of leaving half-created student records without traceability.

Preferred production behavior:

```text
Begin transaction
-> Create student core records
-> Create parent/guardian records
-> Create address records
-> Create admission/enrollment records
-> Mark staging rows imported
-> Mark batch completed
-> Create audit event
-> Commit
```

If any required insert fails:

```text
Rollback
-> Keep batch available
-> Mark failed reason
-> Show exact error
```

---

## 7. Sprint 2: Student Management contract

### Student form

Use a clear wizard/tabs layout:

1. Student
2. Parents
3. Address
4. Admission
5. Photo
6. Preview

Parents should be grouped in one card:

- Father
- Mother
- Guardian

Address should be structured:

- Country
- State
- District
- City
- PIN
- Full address line

Photo upload must support:

- Upload
- Preview
- Replace
- Delete
- Private access through backend

### Student table

Must support:

- School filter for Super Admin.
- Academic year filter.
- Search.
- Class filter.
- Section filter.
- Pagination.
- Sorting.
- Status filter.
- Empty state.
- Export action where permitted.
- Row actions: view, edit, certificates, documents.

Never load all students into the browser at once.

### Student details page

Must show:

- Student identity.
- Admission details.
- Current class/section/academic year.
- Parent/guardian information.
- Address.
- Contact information.
- Uploaded photo/documents.
- Certificates.
- Audit/history.

---

## 8. Academic year architecture

Academic Year must be a master-data concept, not a free-text field.

Required:

- `v2_academic_years` as the source of truth.
- One active academic year per school, unless Super Admin explicitly configures otherwise.
- Student admission/enrollment records linked to academic year.
- Dashboard counts filtered by active academic year by default.
- Bulk Upload validates academic year before staging/import.
- Student table filters by academic year.
- Certificates and reports include academic year.

---

## 9. Dashboard contract

Dashboard must be database-driven only.

If no data exists, show real zero values:

```text
Students: 0
Events: 0
Fees: Rs 0
Certificates: 0
```

Do not show fake/demo metrics.

Super Admin dashboard:

- All-school overview.
- School dropdown/filter.
- Per-school cards.
- Cross-school upload/activity visibility.

School Admin dashboard:

- Own school only.
- Current academic year.
- Student counts.
- Upload status.
- Pending certificates/vouchers/events.

---

## 10. Certificate module contract

Required:

- Templates stored in database or controlled configuration.
- Student data rendered from real database records.
- PDF generation.
- Print-ready layout.
- School logo/watermark where required.
- Audit event on generation.
- No hardcoded student data.

Initial templates:

- Bonafide certificate.
- Study certificate.
- Transfer certificate.
- Conduct certificate if required by client.

---

## 11. Voucher module contract

Required workflow:

```text
School Admin / Accountant creates voucher
-> Enters voucher details
-> Uploads bill/proof
-> Status = Pending
-> Super Admin reviews
-> Approve or reject with remarks
-> Approved voucher number generated
-> PDF/print view available
-> Audit event created
```

Required statuses:

- Draft
- Pending Approval
- Approved
- Rejected
- Cancelled

---

## 12. Event gallery contract

Required:

- Image upload through backend.
- File validation.
- School-scoped metadata in database.
- Gallery listing.
- Event title/date/category.
- Super Admin all-school visibility.
- School Admin own-school visibility.
- No external/public write access.

---

## 13. Branding and watermark contract

The official school logo must be used consistently:

- Sidebar/app branding.
- Login page.
- Certificate templates.
- Printable documents.
- Optional soft watermark on authenticated app surfaces.

Watermark rules:

- Must be subtle.
- Must not reduce text readability.
- Must not appear over form inputs with strong opacity.
- For documents/certificates, use print-safe opacity.

---

## 14. Production deployment contract

Frontend:

- Vercel app points to the correct API base URL.
- API URL must come from environment configuration.
- No localhost API references in production builds.

Backend:

- Hostinger Node/Express app must serve the actual API, not the hosting default page.
- `/health` and `/api/health` must return JSON.
- CORS must allow the Vercel frontend domain.
- Database env values must be real production values, not placeholders.
- Connection pool must be enabled.

Database:

- Migrations must be applied in order.
- Migration status must be checked before and after deployment.
- Backups must be taken before destructive or risky changes.
- Legacy tables must not be deleted.

---

## 15. Testing contract

Each module is complete only when these pass:

```powershell
cd E:\montessori-portal
npm run build -w backend
npm run test -w backend
npm run build -w frontend
npm run test -w frontend
```

Manual checks:

- Login.
- Logout.
- Browser refresh session persistence.
- Protected route access.
- School Admin school isolation.
- Super Admin cross-school access.
- Empty database states.
- Real-data creation.
- Error states.
- Mobile/responsive layout.

Bulk Upload manual checks:

- Valid workbook.
- Missing required column.
- Invalid Aadhaar.
- Invalid phone.
- Invalid email.
- Duplicate inside Excel.
- Duplicate already in DB.
- Wrong academic year.
- Preview survives refresh.
- Accept imports only valid rows or rolls back cleanly.
- Error CSV downloads correctly.

---

## 16. Definition of done

A module is not done until:

- Database schema exists and is migrated.
- Backend validation exists.
- Service/repository logic exists.
- Permissions are enforced in backend.
- Frontend UI is complete and responsive.
- Empty/loading/error states are handled.
- Audit events are written for sensitive actions.
- Automated tests pass.
- Manual acceptance checklist passes.
- Documentation is updated.

---

## 17. Immediate next development action

The next implementation sprint should be:

**Sprint 1 - Finish Bulk Upload as a production-grade staged import system.**

Do not start certificates, vouchers, events or dashboard redesign until Bulk Upload is stable enough to import real client student data safely.

