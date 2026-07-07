# Montessori Portal — Client Meeting Requirements and Implementation Record

**Source:** `F:\Downloads\MEET INFO monte.docx`  
**Review date:** 5 July 2026  
**Authoritative codebase:** `E:\montessori-portal`  
**Deployment targets:** Vercel frontend and `api-v2.montessorischools.in` Hostinger backend

## Executive status

The meeting document was reviewed paragraph by paragraph. The application already contains substantial working implementations for students, documents, certificates, fees, accounts, events, reports, settings, imports, audit history, school isolation, and Super Admin campus switching. This development pass closed the highest-risk gaps discovered during the review:

- Staff navigation and routes now follow the permissions returned by the backend.
- Super Admin retains every School Admin permission and can change the active school scope.
- School-level roles remain locked to their assigned school by backend middleware.
- Secure self-service password recovery now uses random, hashed, single-use, 30-minute tokens.
- Cashbook creation and voucher creation now occur in one database transaction.
- Student lifecycle values now match the meeting vocabulary: Active, Inactive, Dropped, Transferred, Alumni.
- Transfer certificates now move the student to Transferred and record status history.
- The Grade 10 completion action transactionally moves eligible active students to Alumni and skips ineligible records.
- Protected receipts, vouchers, reports, supplier exports, and event files now use authenticated requests.
- SMTP passwords and messaging API secrets are encrypted at rest and masked in settings responses.

## Requirement traceability matrix

| Meeting requirement | Status | Implementation / next control |
|---|---|---|
| Detailed student admission form | Implemented | Multi-section student form, validation, parent/address/academic fields, duplicate check, photo, and final review are present. |
| Aadhaar and sensitive identifier protection | Implemented | Format validation plus authenticated encryption and masking in the backend. |
| Parent information | Implemented | Father, mother, guardian contact, email, Aadhaar and related fields are stored through the student model. |
| Review all details before admission | Implemented | Final review step exists before submission. |
| Student profile documents | Implemented | Birth, study, transfer, Aadhaar and other categories; upload, version, preview, archive, restore and download. |
| Student search/profile/print/export | Implemented | Search, full profile, browser print, CSV and Excel export. |
| Certificate formats and branding | Implemented | Template engine, QR verification, logo/signature/stamp support, preview and PDF download. |
| Dynamic school settings | Implemented | School identity, SMTP, messaging, certificate, branding and academic settings are configurable per school; provider secrets are encrypted and masked. |
| Class-wise fees | Implemented | Academic year, class, category, amount and due date structure with student balance summaries. |
| Payment methods and references | Implemented | Cash, bank transfer, UPI, cheque, card/other where applicable; receipt references are unique. |
| Cashbook and vouchers without duplicate entry | Implemented in this pass | Migration 017 links one voucher to one cashbook entry; both records are committed or rolled back together. |
| Supplier and optional GST data | Implemented | Supplier profile, GST number, ledger, outstanding and export. |
| Financial and operational reports | Implemented | Daily/monthly/annual reports, fees, defaulters, cashflow, P&L, balance sheet, students, certificates and exports. |
| Notifications inside application | Implemented | Persistent per-user notifications, unread count and module navigation. |
| Email password recovery | Implemented in this pass | Uses each school’s SMTP settings. Production intentionally returns a generic response whether an account exists or not. |
| SMS / WhatsApp / email operational messaging | Partially implemented | Configuration UI and internal notification records exist. Live provider calls require approved SMS/WhatsApp provider credentials and templates. |
| Student lifecycle | Implemented in this pass | Canonical statuses are Active, Inactive, Dropped, Transferred and Alumni. Transfer certificate workflow updates status automatically. |
| Automatic Grade 10 year-end alumni batch | Implemented | A permission-controlled bulk completion action moves active Grade 10/Class 10/X students to Alumni, with status history and audit events. |
| Events, media, albums | Implemented | Events, categories, participants, attendance, budgets, bulk media, folders and gallery. |
| Department-specific RBAC | Implemented in this pass | Backend permission enforcement plus permission-filtered frontend navigation and route denial. |
| Super Admin all-school access | Implemented | Campus directory, group metrics and explicit active-school scope on all school-bound requests. |
| School Admin school-only access | Implemented | Token home school and school-scope middleware prevent cross-school access. |
| Navy/gold/cream visual refresh | Implemented in working tree | The current uncommitted `frontend/src/styles.css` already defines the navy, gold and cream visual system. It was preserved without overwriting the user’s design work. |
| Persistent cloud file storage | Deployment-dependent | Storage root abstraction exists. Hostinger must mount `UPLOAD_ROOT` outside the release directory and include it in backup policy; S3-compatible storage remains an optional scale upgrade. |
| Backup, DNS and hosting | Documented / deployment pending | Deployment runbooks exist. Live Hostinger API routing and Vercel redeployment must be completed after migrations. |
| Full UAT, security and performance testing | In progress | Builds and 11 security/auth tests pass. Browser role-by-role UAT and production smoke tests follow deployment. |

## Role and data-scope rules

### Group Super Admin

- Holds every School Admin permission.
- Can view all campuses and select an active campus.
- Can operate student, document, certificate, fee, account, event, report, staff and settings modules for the selected campus.
- Can manage users and role assignments.
- Cannot select a nonexistent school; backend school-scope validation rejects it.

### School Admin

- Has full operational control for the assigned school.
- Cannot change the `X-School-ID` scope to another school.
- Can manage students, academics, documents, certificates, finances, events, reports, users and school settings for that school only.
- Does not receive the protected raw identifier permission reserved for Group Super Admin.

### Principal

- Dashboard, students, lifecycle changes, exports, account visibility, events, certificates, reports and settings visibility.
- No unrestricted user or system configuration management.

### Office / Administration Staff

- Student create/update, document upload, imports, events/certificates/report visibility and limited account visibility.
- No financial management, role management or school configuration management.

### Accountant

- Dashboard, student lookup, accounts management, audit and financial reporting.
- Student lookup exists only to support billing; unrelated administrative modules are hidden.

### Teacher and Auditor

- Teacher: dashboard, student view, events and operational reports.
- Auditor: read-oriented student exports, financial records/reports and settings visibility.

## Database migration gate

Migration `017_meeting_requirements.sql` is ready but has not been applied. The migration runner stopped because the production migration ledger records checksum:

`634d5ceb4f22264b20fafe94343e6f3c9995814167ec8e5bd7899c94f9eb81c8`

while the current repository copy of already-applied `016_user_seeds.sql` hashes to:

`ac33ea08c74b2f8a1224c140cebb74d25aeac4a8749d28593fb03059f1c2660e`

This is a production safety issue, not an application compile failure. Do not edit the migration ledger blindly and do not disable checksum checks. The correct sequence is:

1. Create and verify a restorable database backup.
2. Recover the exact `016_user_seeds.sql` content that was applied on 3 July 2026.
3. Compare its SQL effects with the current repository file.
4. Restore the historical file byte-for-byte, or approve a one-time checksum ledger repair only after the SQL equivalence is proven.
5. Run `npm run migrate:status`, then `npm run migrate:dry-run`.
6. Temporarily enable `ALLOW_PRODUCTION_MIGRATIONS=true`.
7. Run `npm run migrate:up`.
8. Disable production migrations again.

## Environment and provider controls

Backend production requires:

- `NODE_ENV=production`
- `JWT_SECRET` of at least 32 characters
- `DATA_ENCRYPTION_KEY` as a base64-encoded 32-byte key
- Hostinger MySQL host, port, user, password and database
- `DB_SSL=true` when supported by the Hostinger database endpoint
- `FRONTEND_ORIGIN=https://montessori-portal-frontend.vercel.app`
- persistent `UPLOAD_ROOT`
- `ALLOW_PRODUCTION_MIGRATIONS=false` except during the controlled migration window

Each school must configure SMTP host, port, username, password, from email and from name before password recovery email can be delivered. SMS and WhatsApp additionally require provider selection, API credentials, approved sender identity and approved message templates.

## Verification completed

- Backend TypeScript build: passed.
- Frontend TypeScript/Vite build: passed.
- Backend authentication/security tests: 11 passed, 0 failed.
- Frontend type check: passed.
- Migration dry-run: safely blocked by historical migration checksum mismatch before applying migration 017.

## Release sequence

1. Resolve the migration 016 checksum through the controlled process above.
2. Apply migration 017.
3. Configure and test SMTP for every campus.
4. Deploy the backend build to Hostinger and verify `/health` and `/api/health`.
5. Confirm Hostinger routes `api-v2.montessorischools.in` to the Node application rather than the default hosting page.
6. Redeploy Vercel with `VITE_API_URL=https://api-v2.montessorischools.in`.
7. Run production smoke tests.
8. Run role-by-role browser UAT for Super Admin, School Admin, Principal, Office Staff, Accountant, Teacher and Auditor.
9. Test student admission, document upload, certificate generation, fee collection, receipt, cashbook voucher, event media, exports and backup restoration.
10. Obtain client acceptance before importing or changing production student data.
