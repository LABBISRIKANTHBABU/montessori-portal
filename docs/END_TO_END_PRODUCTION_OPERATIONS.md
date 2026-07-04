# Montessori Portal: End-to-End Production Operations

## 1. Production objective

The completed production request path must be:

```text
Browser
  -> https://montessori-portal-frontend.vercel.app
  -> https://api-v2.montessorischools.in/api/*
  -> Express authorization and school-scope enforcement
  -> Hostinger MySQL u456094573_montessori_pro
  -> persistent upload storage for images, documents, PDFs, logos, and event media
```

The browser must never connect directly to MySQL. Database usernames, passwords, JWT secrets, and encryption keys belong only in Hostinger's backend environment variables.

## 2. Current verified state

### Working

- Vercel serves the React application over HTTPS.
- `api-v2.montessorischools.in` has DNS and HTTPS.
- The local production backend connects successfully to Hostinger MySQL.
- Authentication, school isolation, Super Admin campus switching, and all read-only module smoke checks pass.
- The production frontend build contains `https://api-v2.montessorischools.in` as its API origin.

### Still required in Hostinger

`api-v2.montessorischools.in` currently serves Hostinger's Default page. It does not yet serve Express:

- `/health` returns `404`.
- `/api/health` returns `404`.
- `/api/schools` returns `404`.

This means the domain was created as a website/subdomain, but it has not been connected to a running Hostinger **Node.js Web App**.

## 3. Hostinger Node.js application setup

In hPanel:

1. Open **Websites**.
2. Select **Add Website**.
3. Select **Node.js Web App**, not a static website.
4. Import the GitHub repository `LABBISRIKANTHBABU/montessori-portal`.
5. Select the `backend` application directory.
6. Framework: **Express.js**. Use **Other** only when Express is not detected.
7. Node.js: 22 or 24.
8. Install command: `npm install`.
9. Build command: `npm run build`.
10. Start command: `npm start`.
11. Entry file when requested: `dist/server.js`.
12. Output directory when requested: `dist`.
13. Attach `api-v2.montessorischools.in` to this Node.js Web App.
14. Redeploy so Hostinger regenerates the routing `.htaccess`.

The root of the deployed backend must contain `package.json`. If Hostinger cannot deploy the `backend` subdirectory from the monorepo, deploy a backend-only GitHub repository or a ZIP whose root is the contents of `backend`.

## 4. Backend environment variables

Configure these in **Hostinger → Node.js App → Settings & Redeploy → Environment Variables**:

```env
NODE_ENV=production
JWT_SECRET=<minimum-32-character-random-secret>
DATA_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
DB_HOST=<Hostinger MySQL hostname>
DB_PORT=3306
DB_USER=<Hostinger MySQL username>
DB_PASSWORD=<Hostinger MySQL password>
DB_NAME=u456094573_montessori_pro
DB_CONNECTION_LIMIT=10
DB_SSL=true
UPLOAD_ROOT=<absolute persistent Hostinger upload directory>
FRONTEND_ORIGIN=https://montessori-portal-frontend.vercel.app
ALLOW_PRODUCTION_MIGRATIONS=false
```

Rules:

- Never place these secrets in Vercel.
- Never prefix backend secrets with `VITE_`.
- Never commit the real `.env`.
- Do not change `DATA_ENCRYPTION_KEY` after encrypted data has been created.
- Do not overwrite a Hostinger-provided `PORT`. Express automatically reads `PORT`.
- Environment-variable changes require a Hostinger redeployment.

## 5. Vercel frontend setup

Vercel project:

```text
Root Directory: frontend
Framework: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Production and Preview environment variable:

```env
VITE_API_URL=https://api-v2.montessorischools.in
```

After adding or changing it, redeploy Vercel. Vite embeds this public URL at build time.

The expected browser request is:

```text
GET https://api-v2.montessorischools.in/api/schools
Origin: https://montessori-portal-frontend.vercel.app
```

The expected API response header is:

```text
Access-Control-Allow-Origin: https://montessori-portal-frontend.vercel.app
```

## 6. Database persistence model

### Data saved in MySQL

All structured application information is saved in Hostinger MySQL:

- users, roles, permissions, and school assignments;
- student identity, admission, guardians, addresses, medical information, notes, and status;
- academic years, boards, classes, and sections;
- fee structures, payments, cashbook, suppliers, vouchers, and concessions;
- event details, attendance, participants, budgets, and folders;
- document metadata and document versions;
- certificates, templates, status, and issue history;
- school settings and branding metadata;
- notifications, imports, saved reports, and audit events.

### Images and files

Images and documents should not be stored as large MySQL BLOB values. The production design is:

```text
physical file -> persistent UPLOAD_ROOT
metadata/path -> Hostinger MySQL
```

Examples:

- Student photo: file in `UPLOAD_ROOT/students`; path in `v2_students`.
- Student documents: file in school/module storage; metadata in `v2_student_documents` and `v2_document_versions`.
- Event media: file in `UPLOAD_ROOT/events`; metadata in event-media tables.
- School logo, signatures, and stamp: file in `UPLOAD_ROOT/settings`; metadata in `v2_school_logos` and `v2_school_settings`.

`UPLOAD_ROOT` must point to a directory that survives application restarts and redeployments. Verify persistence by uploading a test image, restarting the Node.js app, redeploying once, and downloading the same image. If Hostinger does not provide a persistent application directory, move file storage to S3-compatible object storage before production use.

## 7. Module data-flow and acceptance matrix

| Module | Main API check | Primary persistence | Required acceptance |
|---|---|---|---|
| Authentication | `/api/auth/login` | `v2_users`, roles, permissions, audit | Correct role, JWT, school and permissions |
| Dashboard | `/api/dashboard` | students, events, fees, certificates | Real counts; zero when empty |
| Super Admin | `/api/admin/overview` | all school-scoped tables | All campuses visible and selectable |
| Students | `/api/students` | students, admissions, guardians, addresses | Create, edit, search, status and restore |
| Academic setup | `/api/academic/setup` | years, boards, classes, sections | School-specific master data |
| Imports | `/api/imports` | import batches and rows | Upload, validate, approve, reject, rollback |
| Documents | `/api/documents/categories` | documents, versions, shares, files | Upload, preview, replace, archive, restore |
| Certificates | `/api/certificates` | certificates, templates, audit | Generate, preview, download, cancel/regenerate |
| Fees/accounts | `/api/accounts/dashboard` | fee and accounting tables | Payments, receipts, reports and audit |
| Events | `/api/events/dashboard` | events, participants, media, budgets | Create, publish, attendance and media |
| Reports | `/api/reports/dashboard` | read models and saved reports | Filters and exports use real data |
| Staff/roles | `/api/users` | users and school roles | Role rules and school isolation |
| Settings | `/api/settings` | settings, academic masters, logos | Branding and configuration persist |

## 8. Security and school isolation

- JWT signature and expiration are validated on protected requests.
- School Admin always uses the school stored in the JWT.
- A forged `X-School-ID` for another school returns `403`.
- Group Super Admin may select any active school.
- School Admin cannot create or manage Group Super Admin accounts.
- SQL uses parameterized queries.
- Aadhaar and bank values are encrypted with `DATA_ENCRYPTION_KEY`.
- Passwords use bcrypt hashes.
- CORS permits only the configured Vercel origin.
- Sensitive secrets never enter the frontend bundle.
- Mutations should insert audit records.

## 9. Deployment order

Always deploy in this order:

1. Back up Hostinger MySQL.
2. Confirm applied migrations have not been edited.
3. Deploy/redeploy the Hostinger backend.
4. Verify backend health and school directory.
5. Run the production smoke test.
6. Configure `VITE_API_URL` in Vercel.
7. Redeploy Vercel.
8. Test login and every module in the browser.
9. Test one safe create/update/delete lifecycle in a test school.
10. Test file persistence across a backend restart.

Do not point Vercel at an API URL until `/api/health` returns JSON with database `ok: true`.

## 10. Health verification

The following must return JSON:

```text
https://api-v2.montessorischools.in/health
https://api-v2.montessorischools.in/api/health
https://api-v2.montessorischools.in/api/schools
```

Expected database health:

```json
{
  "status": "ok",
  "mode": "database",
  "database": {
    "ok": true,
    "database": "u456094573_montessori_pro"
  }
}
```

Hostinger HTML titled `Default page`, `403 Forbidden`, or `404 Not Found` means traffic is not reaching Express.

## 11. Automated production smoke test

Run from `backend`:

```powershell
$env:API_URL="https://api-v2.montessorischools.in"
$env:TEST_SCHOOL_ID="1"
$env:TEST_EMAIL="<school-admin-email>"
$env:TEST_PASSWORD="<password>"
npm run smoke:production
Remove-Item Env:TEST_PASSWORD
```

Every row must show `PASS`. The script does not create business records; login does create the normal login audit event.

## 12. Manual business-function verification

Use a dedicated test school and test records:

1. Create a staff account and verify its role.
2. Create a student with guardian, address, identifiers, and photo.
3. Refresh the browser and confirm the student remains.
4. Upload and download a document.
5. Generate and download a certificate.
6. Create an event, add participants, record attendance, and upload media.
7. Create fee configuration and record a payment.
8. Confirm receipt and financial reports.
9. Edit school branding and confirm logo persistence.
10. Review the audit log for every mutation.
11. Archive/restore records where supported.
12. Delete only disposable test records.

## 13. Backup and recovery

Daily:

- Monitor Hostinger Node.js runtime and error logs.
- Monitor `/api/health`.
- Review failed login and application error events.

Before every release:

- Create a MySQL backup.
- Back up persistent uploaded files.
- Record the Git commit/deployment identifier.
- Run tests, build, and smoke checks.

Recovery:

1. Stop writes when corruption is suspected.
2. Restore MySQL and uploaded files from the same backup timestamp.
3. Confirm `DATA_ENCRYPTION_KEY` is unchanged.
4. Redeploy the last known-good backend.
5. Run health and smoke tests.
6. Redeploy the matching frontend when API contracts changed.

## 14. Troubleshooting

### Hostinger Default page

The hostname is connected to a static website rather than the Node.js Web App. Attach the domain to the Node app and redeploy.

### Hostinger 403 after deployment

Redeploy to regenerate the backend routing `.htaccess`. Confirm Hostinger placed backend build output in its Node.js application directory.

### Frontend displays no schools

- Confirm Vercel `VITE_API_URL`.
- Redeploy Vercel.
- Open `/api/schools` directly.
- Check CORS response headers.

### Database unavailable

- Verify DB hostname, username, password, database, SSL, and Remote MySQL permission.
- Verify the Hostinger Node application can reach the database.
- Check `/api/health` and Hostinger runtime logs.

### Login succeeds but dashboard fails

- Inspect the first protected request.
- Confirm role permissions exist in `v2_role_permissions`.
- Confirm dashboard tables exist.
- Confirm browser sends `Authorization: Bearer <token>`.

### Upload succeeds but later disappears

`UPLOAD_ROOT` is not persistent. Move it to a persistent Hostinger path or implement S3-compatible object storage.

## 15. Production completion definition

Production is complete only when:

- the three health URLs return Express JSON;
- the production smoke test passes against `api-v2`;
- Vercel loads all schools from `api-v2`;
- School Admin and Super Admin login work;
- every module reads real Hostinger data;
- representative create/update/delete operations persist after refresh;
- files persist after backend restart and redeployment;
- backups and restore have been tested;
- no secret is committed or visible in the browser bundle.
