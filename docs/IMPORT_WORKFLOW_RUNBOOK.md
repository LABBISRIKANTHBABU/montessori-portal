# Student Import and Legacy Migration Runbook

## Supported sources

- Existing Montessori `.xlsx` workbook headers
- CSV using the same headers
- Read-only staging from the legacy `student_details` table

The legacy table is never updated or deleted.

## Workflow

1. Open **Students → Bulk import**.
2. Upload a workbook or choose **Stage legacy data**.
3. Review total, valid, error and duplicate counts.
4. Download the CSV error report when corrections are required.
5. Approve only validated rows.
6. Verify imported students through the student directory and profiles.
7. Reconcile imported counts with the source batch.

## Validation rules

- Admission number, pupil name, academic year, board, admission date, birth date, class and residence address are required.
- Dates normalize to ISO `yyyy-mm-dd`.
- Aadhaar must contain exactly 12 digits when present.
- `-`, `_`, blank, `NULL` and `N/A` normalize to missing values.
- Admission numbers are checked against both the workbook and existing students in the selected school.
- Identifiers remain text so leading zeroes are preserved.

## Safety and audit

- Uploading only creates staging rows.
- Approval requires `import.approve`.
- Every student is created through the existing transactional, encrypted student service.
- A failed row is retained with its error and can be corrected in a later batch.
- Source row numbers and legacy source IDs remain traceable.
- Batch upload and approval actions create audit events.

## Migration command

After database connectivity is healthy:

```powershell
cd E:\montessori-portal\backend
npm run migrate:status
npm run migrate:dry-run
npm run migrate:up
```

Migration `006_import_workflow.sql` must be applied before the import pages can be used. Sign out and back in after migration so the access token includes the new import permissions.
