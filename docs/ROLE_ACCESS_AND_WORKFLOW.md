# Role Access, Responsibilities, and School Workflow

## 1. Non-negotiable access rules

1. Every protected request requires a valid JWT.
2. Every request operates inside one effective school scope.
3. A Group Super Admin may select any active school.
4. A School Admin is permanently restricted to the school in the JWT.
5. Sending another school ID does not expand School Admin access; the API returns `403`.
6. Database queries use the effective school ID, not a school ID supplied in a form body.
7. Group Super Admin has every School Admin permission plus sensitive-identifier access.
8. School Admin cannot create, promote, edit, deactivate, reset, or delete a Group Super Admin.
9. Every important mutation must create a school-scoped audit event.

## 2. Group Super Admin

Scope: all active Montessori schools.

### Responsibilities

- View group totals and school-by-school operating metrics.
- Select an operating campus from the dashboard or sidebar.
- Enter the selected school's Students, Certificates, Fees, Documents, Events, Reports, Staff, and Settings modules.
- Create and manage School Admin, Principal, Office Staff/Data Entry, Teacher, Accountant, and Auditor accounts.
- Create another Group Super Admin when organizational policy permits.
- Review sensitive student identifiers when operationally required.
- Review financial, operational, and audit reports across campuses.
- Correct school configuration, academic masters, users, fees, events, and certificates.
- Remain accountable for every cross-school change through the audit log.

### Workflow

1. Sign in through `/super-admin`.
2. Review the group portfolio.
3. Choose a campus using the Operating Campus selector or a campus card.
4. Confirm the active campus shown in the sidebar and scope seal.
5. Open any operational module.
6. Read or change data; all requests carry the selected campus in `X-School-ID`.
7. Change campus when required. The module remounts and reloads from the newly selected school.

## 3. School Admin

Scope: exactly one assigned school.

### Responsibilities

- Manage students, admissions, documents, events, certificates, fees, reports, staff, and settings for the assigned school.
- Maintain the school's academic years, classes, sections, branding, and operational setup.
- Create and manage campus-level staff.
- Review the school's audit and financial activity.
- Escalate group-wide configuration or Super Admin account changes to Group Super Admin.

### Restrictions

- Cannot select or access another school.
- Cannot obtain another school's records through request headers, URLs, IDs, exports, or forms.
- Cannot grant the Group Super Admin role.
- Cannot manage an existing Group Super Admin account.
- Cannot view sensitive student identifiers unless a future permission is explicitly approved.

## 4. Operational role categories

| Role | Scope | Core responsibility |
|---|---|---|
| Group Super Admin | All schools | Group governance and unrestricted campus operations |
| School Admin | One school | Complete school operations |
| Principal | One school | Academic oversight, events, certificates, and reports |
| Office Staff / Data Entry | One school | Student records, uploads, documents, and routine operations |
| Accountant | One school | Fees, accounts, audit, and financial reports |
| Teacher | One school | Student viewing, events, and academic reports |
| Auditor | One school | Read-only operational and financial review |

## 5. Module authority matrix

| Module | Group Super Admin | School Admin |
|---|---|---|
| Group overview | All campuses | No |
| Campus selection | Any active campus | No |
| Students | Full selected-campus control | Full assigned-campus control |
| Sensitive identifiers | Permitted | Denied |
| Academic masters | Full selected-campus control | Full assigned-campus control |
| Users and roles | All roles | Campus roles except Group Super Admin |
| Fees and accounts | Full selected-campus control | Full assigned-campus control |
| Events | Full selected-campus control | Full assigned-campus control |
| Certificates | Full selected-campus control | Full assigned-campus control |
| Documents | Full selected-campus control | Full assigned-campus control |
| Reports | Group and selected-campus | Assigned campus |
| Settings | Full selected-campus control | Assigned campus |
| Audit | Group and selected-campus | Assigned campus |

## 6. Enforcement points

- `authenticate` verifies the JWT and resolves the effective campus.
- `resolveSchoolScope` rejects cross-school School Admin requests.
- `requirePermission` checks action-level permissions.
- `requireRole` protects group-only APIs.
- Repository and module queries always receive `req.auth.schoolId`.
- User-management rules protect Group Super Admin accounts from School Admin changes.

## 7. Dashboard meaning

The Group Control Centre contains real database totals and one card per active school. Selecting a campus changes the secure context for every operational module.

The School Admin dashboard displays a Single-School Authority contract and never exposes a campus selector. Its values and actions belong only to the assigned school.
