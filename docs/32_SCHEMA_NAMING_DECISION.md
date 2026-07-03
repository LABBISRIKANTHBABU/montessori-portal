# Schema Naming Decision

## Current State

All production tables use a `v2_` prefix:

```
v2_schools, v2_users, v2_user_school_roles, v2_students,
v2_student_identifiers, v2_guardians, v2_student_guardians,
v2_student_addresses, v2_academic_years, v2_admissions,
v2_student_leaving_records, v2_boards, v2_classes, v2_sections,
v2_permissions, v2_role_permissions, v2_sessions,
v2_student_status_history, v2_audit_events,
v2_import_batches, v2_import_rows
```

## Why v2_ Exists

The `v2_` prefix was introduced because the production Hostinger database already contains legacy tables:

- `SchoolName` (school master)
- `student_details` (legacy student records)

The v2 schema is **additive** -- it sits alongside the legacy tables without modifying them. The prefix prevents naming collisions during the migration period.

## Decision

**The `v2_` prefix is a migration convenience, NOT a permanent naming convention.**

For a clean production deployment (fresh database), the final table names should be:

```
schools, users, user_school_roles, students,
student_identifiers, guardians, student_guardians,
student_addresses, academic_years, admissions,
student_leaving_records, boards, classes, sections,
permissions, role_permissions, sessions,
student_status_history, audit_events,
import_batches, import_rows
```

## Migration Path

### Option A: Rename tables after legacy data is migrated

Once all legacy data is imported into v2 tables and the legacy tables are no longer needed:

```sql
RENAME TABLE v2_schools TO schools;
RENAME TABLE v2_users TO users;
-- ... etc for all tables
```

Then update all SQL queries in the codebase to remove the `v2_` prefix.

### Option B: Fresh production database

For a new deployment without legacy data, create tables with clean names from the start. Modify the migration files to use clean names.

### Recommended

**Option B** for new deployments. **Option A** for the current Hostinger migration.

## Action Required

When legacy data migration is complete:

1. Run `RENAME TABLE` statements
2. Update all SQL in `server.ts`, `studentRepository.ts`, `importService.ts`
3. Update migration files for documentation
4. Remove this document
