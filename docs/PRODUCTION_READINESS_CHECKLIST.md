# Production Readiness Checklist

This document acts as the release gate. Every core module must pass these checks before the project is considered ready for the client. 

## 1. Authentication
- [ ] Login flow is secure (Super Admin & School Admin).
- [ ] Logout invalidates the session securely.
- [ ] JWT access tokens are short-lived.
- [ ] Refresh tokens securely rotate.
- [ ] Password reset / forced first-login change is enforced.
- [ ] Session persistence (Remember Me) works correctly.

## 2. Dashboard
- [ ] Graceful loading states are implemented.
- [ ] Error states handle API failures gracefully.
- [ ] Empty states guide the user clearly.
- [ ] Metric cards show accurate, real-time data.
- [ ] Charts render correctly across screen sizes.
- [ ] Recent Activity feed displays meaningful updates.

## 3. Students (CRUD & Profile)
- [ ] Create, Read, Update, Delete (Soft-delete), and Restore are fully functional.
- [ ] Search and filtering logic is robust.
- [ ] Pagination handles large student lists efficiently.
- [ ] Exporting lists to CSV/Excel is supported.
- [ ] Student Profile page displays comprehensive data.
- [ ] Audit Timeline records and displays history accurately.

## 4. Bulk Upload (Imports)
- [ ] Parses both CSV and Excel securely.
- [ ] Normalizes and validates data against business rules.
- [ ] Previews batches before final approval.
- [ ] Supports rollback/deletion of failed or unapproved batches.
- [ ] Accurately detects and flags duplicates.
- [ ] Generates downloadable Import Reports for error correction.

## 5. Certificates
- [ ] Previews certificates accurately in the UI.
- [ ] Generates Transfer, Study, Bonafide, and Conduct certificates.
- [ ] Downloads certificates as high-quality PDFs.
- [ ] Printing is optimized (CSS `@media print`).
- [ ] Certificate generation history is logged in the student timeline.

## 6. Deployment & Infrastructure
- [ ] Application is served entirely over HTTPS.
- [ ] Environment variables (Secrets) are securely managed.
- [ ] API logging is in place without leaking sensitive PII.
- [ ] Error tracking is active for production bugs.
- [ ] Automated database backups are configured.
