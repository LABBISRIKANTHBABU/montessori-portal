# Production Deployment: Vercel + Hostinger

## Current deployment diagnosis

Frontend: `https://montessori-portal-frontend.vercel.app`

Intended API: `https://api-v2.montessorischools.in`

At the time of verification:

- The Vercel frontend returned `200`.
- Vercel `/api/health` and `/api/schools` returned `404`.
- `api-v2.montessorischools.in` resolves to Hostinger but currently serves Hostinger's Default page.
- Hostinger returned its default `403/404`, proving that the Express application was not running on that hostname.

The frontend and database cannot communicate directly. The required production path is:

```text
Vercel frontend
    -> HTTPS api-v2.montessorischools.in
    -> Express backend on Hostinger
    -> Hostinger MySQL
```

## 1. Deploy the backend in Hostinger

Hostinger managed Node.js applications require a Business or Cloud plan. A VPS is also supported but requires process-manager and reverse-proxy administration.

In hPanel:

1. Open **Websites → Add Website → Node.js Web App**.
2. Import `LABBISRIKANTHBABU/montessori-portal` from GitHub.
3. Select Express or Other.
4. Configure the application directory as `backend`.
5. Use Node.js 22 or 24.
6. Build command: `npm run build`.
7. Start command: `npm start`.
8. Entry file, when requested: `dist/server.js`.
9. Connect the custom domain `api-v2.montessorischools.in` to the Node.js Web App, replacing the current static Default page.
10. Enable SSL and wait until the certificate is active.

If Hostinger cannot use a monorepo subdirectory, deploy a backend-only repository or ZIP containing:

- `backend/package.json`
- `backend/src`
- `backend/scripts`
- `database`
- the root lockfile when supported

## 2. Hostinger backend environment variables

Configure these in hPanel. Never commit their real values.

```env
NODE_ENV=production
JWT_SECRET=<at-least-32-random-characters>
DATA_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
DB_HOST=<Hostinger MySQL hostname>
DB_PORT=3306
DB_USER=<database username>
DB_PASSWORD=<database password>
DB_NAME=u456094573_montessori_pro
DB_CONNECTION_LIMIT=10
DB_SSL=true
UPLOAD_ROOT=<absolute persistent directory supplied by Hostinger>
FRONTEND_ORIGIN=https://montessori-portal-frontend.vercel.app
ALLOW_PRODUCTION_MIGRATIONS=false
```

Do not manually set `PORT` if Hostinger supplies it. Otherwise use the port configured for the Node.js application.

The encryption key must remain identical across every deployment. Changing it makes existing encrypted Aadhaar and bank values unreadable.

## 3. Database preparation

The current production database already contains the application tables. Do not edit an applied migration and do not automatically execute migrations during application startup.

Before a future migration:

1. Create a Hostinger database backup.
2. Run `npm run migrate:status`.
3. Run `npm run migrate:dry-run`.
4. Temporarily set `ALLOW_PRODUCTION_MIGRATIONS=true`.
5. Run `npm run migrate:up` once.
6. Restore `ALLOW_PRODUCTION_MIGRATIONS=false`.

## 4. Verify the backend before touching Vercel

These URLs must return JSON, not Hostinger HTML:

```text
https://api-v2.montessorischools.in/health
https://api-v2.montessorischools.in/api/health
https://api-v2.montessorischools.in/api/schools
```

Expected health result:

```json
{
  "status": "ok",
  "mode": "database",
  "database": {
    "ok": true
  }
}
```

## 5. Configure Vercel

The Vercel project must use:

- Root Directory: `frontend`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Set this Vercel environment variable for Production and Preview:

```env
VITE_API_URL=https://api-v2.montessorischools.in
```

`VITE_API_URL` is compiled into the browser bundle, so changing it requires a new Vercel deployment.

The repository also contains `frontend/.env.production` with the intended public API URL. The Vercel project variable remains the authoritative deployment setting.

## 6. Production smoke test

From `backend`:

```powershell
$env:API_URL="https://api-v2.montessorischools.in"
$env:TEST_SCHOOL_ID="1"
$env:TEST_EMAIL="<school-admin-email>"
$env:TEST_PASSWORD="<password>"
npm run smoke:production
```

The script checks:

- API and database health
- School directory
- Authentication
- Dashboard
- Students
- Academic setup
- Imports
- Documents
- Certificates
- Fees and accounts
- Events
- Reports
- Staff and roles
- School settings

Do not paste the smoke-test password into documentation, Git, Vercel, or Hostinger logs.

## 7. Release acceptance criteria

- All smoke-test rows show `PASS`.
- Browser requests target `https://api-v2.montessorischools.in/api/...`.
- Responses include `Access-Control-Allow-Origin: https://montessori-portal-frontend.vercel.app`.
- School Admin cross-campus requests return `403`.
- Super Admin can select and operate all active campuses.
- Refreshing `/dashboard`, `/students`, and `/super-admin` does not produce a Vercel `404`.
- Uploads remain available after a backend restart and redeployment.
- No production secret exists in the frontend bundle or Git repository.

## Official platform references

- Hostinger Node.js deployment: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Hostinger Node.js options: https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/
- Vercel Vite deployment: https://vercel.com/docs/frameworks/frontend/vite
- Vercel environment variables: https://vercel.com/docs/environment-variables
