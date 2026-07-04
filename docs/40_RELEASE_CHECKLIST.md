# Release Checklist - Version 1.0

Every item must be verified before Version 1.0 is considered ready.

---

## Authentication

- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials shows error
- [ ] School-specific login renders for each campus
- [ ] Super Admin login renders at /super-admin
- [ ] JWT access token issued on login
- [ ] Refresh token cookie set on login
- [ ] Token refresh rotates access token
- [ ] Session timeout after 15 minutes
- [ ] Logout clears session and cookie
- [ ] Forced password change on first login
- [ ] Password complexity enforced (12+ chars, upper/lowercase, number, symbol)
- [ ] Rate limiting on auth endpoints (30 requests/15 min)
- [ ] Role-based access control enforced on all endpoints

## Student Management

- [ ] Student directory loads with pagination
- [ ] Student search by name or admission number
- [ ] Status filter (Active, Alumni, Withdrawn, Suspended, Inactive)
- [ ] Status filter resets pagination to page 1
- [ ] Create student via 6-step intake wizard
- [ ] All required fields validated on create
- [ ] Student photo upload (JPEG/PNG/WebP, max 5MB)
- [ ] Duplicate admission number rejected
- [ ] Student profile view loads all tabs
- [ ] Student profile edit saves changes
- [ ] Student status change recorded in history
- [ ] Soft delete (deleted_at/deleted_by)
- [ ] Audit events logged for all mutations

## Student Profile Tabs

- [ ] General tab: personal info, identifiers, address
- [ ] Parents/Guardians tab: father, mother, contacts
- [ ] Academic tab: admission details, class, section
- [ ] Documents tab: Aadhaar, PEN, APAAR IDs
- [ ] Timeline tab: audit history with timestamps
- [ ] Certificates tab: certificate list per student
- [ ] Fees tab: fee summary per student

## Document Management System

- [ ] Upload document (Aadhaar, Birth Certificate, Marks Memo, etc.)
- [ ] Document type categorization (identity, academic, financial, other)
- [ ] Document preview (inline for images, PDF viewer for documents)
- [ ] Document download (original file)
- [ ] Document replacement (upload new version, archive old)
- [ ] Multiple documents per student
- [ ] Folder-based organization per student
- [ ] Search by document type
- [ ] Search by academic year
- [ ] File size limits enforced
- [ ] Allowed file types enforced (PDF, JPG, PNG)
- [ ] Document metadata (upload date, uploaded by, file size)
- [ ] Storage path isolation per school

## Certificate Engine

- [ ] Transfer Certificate generation
- [ ] Study Certificate generation
- [ ] Bonafide Certificate generation
- [ ] Conduct Certificate generation
- [ ] Auto-fill student details from profile
- [ ] Principal signature support (uploaded image)
- [ ] School logo on certificate
- [ ] QR code verification on certificate
- [ ] PDF generation with proper formatting
- [ ] Print-ready layout (A4)
- [ ] Certificate history per student
- [ ] Certificate approval workflow
- [ ] Duplicate certificate detection
- [ ] Certificate number sequencing

## Accounts & Fees

### Fee Collection
- [ ] Fee categories defined (Tuition, Transport, Library, Lab, etc.)
- [ ] Fee structure per class per academic year
- [ ] Student fee profile shows total/paid/pending
- [ ] Receive payment (cash, bank transfer, UPI, cheque)
- [ ] Receipt generation with school branding
- [ ] Partial payment support
- [ ] Payment history per student
- [ ] Pending fees dashboard
- [ ] Scholarship/concession application
- [ ] Fee waiver approval workflow

### Daily Accounts
- [ ] Daily cash book entry
- [ ] Opening/closing balance tracking
- [ ] Bank book entry
- [ ] Income recording
- [ ] Expense recording

### Supplier Management
- [ ] Supplier master (name, contact, GST, bank details)
- [ ] Purchase entry
- [ ] Payment to supplier
- [ ] Outstanding tracking
- [ ] Supplier ledger

### Voucher Management
- [ ] Payment voucher creation
- [ ] Receipt voucher creation
- [ ] Journal voucher creation
- [ ] Expense voucher creation
- [ ] Voucher approval workflow

### Financial Reports
- [ ] Daily collection report
- [ ] Income vs Expense report
- [ ] Cash flow statement
- [ ] Supplier outstanding report
- [ ] Fee defaulters list
- [ ] Tax/GST report

## Events

- [ ] Event creation (name, date, type, description)
- [ ] Event scheduling with calendar view
- [ ] Student participation tracking
- [ ] Event attendance recording
- [ ] Photo uploads per event
- [ ] Video uploads per event
- [ ] Event invitations/brochures upload
- [ ] Event archive (past events searchable)
- [ ] Event search by date, type, status
- [ ] Event downloads (photos, videos, documents)
- [ ] Permission-based access to event media

## Reports

- [ ] Student reports (enrollment, status, class-wise)
- [ ] Fee reports (collection, pending, defaulters)
- [ ] Certificate reports (issued, pending, types)
- [ ] Financial reports (income, expense, cash flow)
- [ ] Event reports (participation, attendance)
- [ ] Document reports (uploaded, pending, types)
- [ ] Export to Excel/PDF
- [ ] Print reports

## Dashboard

- [ ] School dashboard shows total students
- [ ] School dashboard shows active students
- [ ] Enrollment by class bar chart renders
- [ ] Recent activity feed shows latest events
- [ ] Super Admin dashboard shows cross-campus metrics
- [ ] Today's admissions count
- [ ] Pending certificates count
- [ ] Pending fees count
- [ ] Upcoming events
- [ ] Documents uploaded this week
- [ ] Add Student button navigates to intake wizard

## Landing Page

- [ ] All 9 campuses displayed
- [ ] Search filters schools by name or city
- [ ] Clicking school card navigates to login
- [ ] Super Admin link navigates to super admin login
- [ ] Responsive on mobile, tablet, desktop

## User Management

- [ ] Roles list (Group Super Admin, School Admin, Principal, Office Staff, Teacher, Accountant, Auditor)
- [ ] Permissions matrix per role
- [ ] Create new user
- [ ] Assign role to user
- [ ] Assign school to user
- [ ] Deactivate user
- [ ] Password reset by admin

## Settings

- [ ] School profile (name, logo, address, contact)
- [ ] Academic year management
- [ ] Board configuration
- [ ] Class and section management
- [ ] Fee structure configuration
- [ ] Certificate template configuration
- [ ] Principal signature upload
- [ ] School logo upload

## Security

- [ ] Helmet HTTP security headers enabled
- [ ] CORS restricted to FRONTEND_ORIGIN
- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] Aadhaar fields encrypted with AES-256-GCM
- [ ] Bank account fields encrypted with AES-256-GCM
- [ ] Masked values stored alongside encrypted values
- [ ] Parameterized SQL queries (no string concatenation)
- [ ] Transaction-wrapped multi-table mutations
- [ ] Session revocation on logout
- [ ] School isolation on all queries (school_id from JWT)
- [ ] No secrets committed to version control
- [ ] File upload type validation
- [ ] Storage path traversal prevention

## Database

- [ ] Migrations 001-006 run successfully
- [ ] Schools seeded from legacy SchoolName table
- [ ] Academic year 2026-27 seeded for all schools
- [ ] Boards seeded (CBSE, STATE, ICSE)
- [ ] Classes derived from legacy student data
- [ ] Admin user provisioned via CLI
- [ ] Connection pool configured (10 connections)
- [ ] SSL enabled for production database
- [ ] Backup strategy configured (daily)
- [ ] Disaster recovery plan documented

## Environment

- [ ] Dashboard and all modules read only from the configured production database
- [ ] JWT_SECRET is 32+ character random string
- [ ] DATA_ENCRYPTION_KEY is base64-encoded 32-byte key
- [ ] FRONTEND_ORIGIN matches deployed URL
- [ ] DB_HOST points to production database
- [ ] DB_SSL=true for production
- [ ] .env not committed to version control

## Deployment

- [ ] HTTPS configured (SSL certificate)
- [ ] Frontend built and served from CDN or server
- [ ] Backend running with process manager (PM2 or similar)
- [ ] Database backups configured (daily)
- [ ] Error logging configured (console or service)
- [ ] Health check endpoint responds at /api/health
- [ ] CORS allows production frontend origin
- [ ] Rate limiting active on auth endpoints
- [ ] Storage quota configured for uploads

## Responsive UI

- [ ] Landing page renders on mobile (320px+)
- [ ] Login page renders on mobile
- [ ] Dashboard renders on mobile
- [ ] Student directory table scrolls horizontally on mobile
- [ ] Intake wizard adapts to mobile layout
- [ ] Sidebar collapses on mobile with hamburger menu
- [ ] Forms stack vertically on narrow screens
- [ ] Certificate preview works on mobile
- [ ] Fee collection form works on mobile

## Error Handling

- [ ] 404 responses for unknown routes
- [ ] 401 responses for unauthenticated requests
- [ ] 403 responses for unauthorized actions
- [ ] 422 responses for validation errors
- [ ] 500 responses with generic message (no stack trace)
- [ ] Frontend shows user-friendly error messages
- [ ] Network errors handled gracefully
- [ ] File upload errors handled gracefully
- [ ] Database connection errors handled gracefully

---

## Sign-Off

| Area | Verified By | Date |
|---|---|---|
| Authentication | | |
| Student Management | | |
| Document Management | | |
| Certificate Engine | | |
| Accounts & Fees | | |
| Events | | |
| Reports | | |
| Dashboard | | |
| User Management | | |
| Settings | | |
| Security | | |
| Database | | |
| Deployment | | |
| Responsive UI | | |
| Error Handling | | |

**Version 1.0 is ready for release when ALL checkboxes above are complete.**
