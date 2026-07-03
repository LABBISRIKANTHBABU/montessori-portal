# Montessori Portal v2 - Launch Scope

This document defines exactly what ships in each version of the Montessori Portal.
Anything not listed in Version 1.0 is deferred to a future release.
The goal is to deliver a complete, polished product within 10 days.

## Version 1.0 (Core Release)

### Authentication & Security
- Landing page with school selection (9 campuses)
- School-specific staff login
- Super Admin login
- JWT access tokens (15-minute expiry)
- Refresh token rotation (7-day expiry)
- Forced password change on first login
- Session management with revocation
- Role-based access control (7 roles)
- Rate limiting on auth endpoints

### Dashboard
- School Admin dashboard: total students, active students, enrollment chart, recent activity, pending certificates, upcoming events
- Super Admin dashboard: cross-campus metrics (total students across 9 campuses, active staff, pending approvals)
- Quick actions (Add Student, View Reports)

### Student Management
- Student directory with search, status filter, and pagination
- 6-step intake wizard (Personal, Academics, Parents, Documents, Review, Submit)
- Student profile with tabs: General, Parents, Academic, Documents, Timeline, Certificates, Fees
- Student status change (Active, Alumni, Withdrawn, Suspended, Inactive)
- Soft delete with audit trail
- Student photo upload (JPEG/PNG/WebP, max 5MB)

### Document Management System
- Upload documents per student (Aadhaar, Birth Certificate, Marks Memo, Income Certificate, Caste Certificate, Bonafide, Transfer Certificate, Others)
- Document type categorization
- Document preview (inline for images, PDF viewer for documents)
- Document download (original file)
- Document replacement (upload new version, archive old)
- Multiple documents per student
- Folder-based organization per student
- Search by document type and academic year
- File size limits and type validation

### Certificate Engine
- Transfer Certificate generation
- Study Certificate generation
- Bonafide Certificate generation
- Conduct Certificate generation
- Auto-fill student details from profile
- Principal signature support
- School logo on certificate
- QR code verification
- PDF generation with print-ready A4 layout
- Certificate history per student
- Certificate approval workflow

### Accounts & Fees
- Fee categories (Tuition, Transport, Library, Lab, etc.)
- Fee structure per class per academic year
- Student fee profile (total/paid/pending)
- Receive payment (cash, bank transfer, UPI, cheque)
- Receipt generation with school branding
- Partial payment support
- Payment history per student
- Pending fees dashboard
- Scholarship/concession support
- Daily cash book and bank book
- Supplier management (master, purchases, payments, outstanding, ledger)
- Voucher management (payment, receipt, journal, expense)
- Financial reports (daily collection, income vs expense, cash flow, supplier outstanding, fee defaulters, GST)

### Events
- Event creation (name, date, type, description)
- Event scheduling with calendar view
- Student participation tracking
- Event attendance recording
- Photo and video uploads per event
- Event invitations and brochures upload
- Event archive (past events searchable)
- Event search by date, type, status
- Event downloads (photos, videos, documents)
- Permission-based access to event media

### Reports
- Student reports (enrollment, status, class-wise)
- Fee reports (collection, pending, defaulters)
- Certificate reports (issued, pending, types)
- Financial reports (income, expense, cash flow)
- Event reports (participation, attendance)
- Document reports (uploaded, pending, types)
- Export to Excel/PDF
- Print reports

### Bulk Import
- Upload Excel (.xlsx) or CSV file
- Template download with all 36 columns
- Header alias mapping for legacy column names
- Row validation with error reporting
- Duplicate detection
- Import preview with valid/error/duplicate counts
- Error report download as CSV
- Approve import to create student records
- Legacy staging from student_details table

### Landing Page
- All 9 campuses displayed
- Search by name or city
- Super Admin link

### Deployment
- Production deployment configuration
- HTTPS, environment variables, backups, logging

---

## Version 1.1 (Fast Follow)

- **Attendance**: Daily student attendance tracking
- **Staff Management**: Staff directory, role assignments, schedule
- **Parent Portal**: Dedicated parent access
- **Teacher Portal**: Dedicated teacher access

---

## Version 2.0 (Expansion)

- **Library**: Book inventory and borrowing
- **Transport**: Vehicle tracking and route assignment
- **Inventory**: Assets and supplies management
- **Mobile App**: Companion application
- **SMS/Email Notifications**: Automated alerts
- **Biometric Integration**: Attendance via biometric devices
