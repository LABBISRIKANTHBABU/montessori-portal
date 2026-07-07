# Production Connectivity Audit — 2026-07-07

## Current result

Live API target:

```text
https://api-v2.montessorischools.in
```

Observed status:

| URL | Current result | Meaning |
| --- | --- | --- |
| `https://api-v2.montessorischools.in/` | Hostinger default HTML page | Domain is not routed to the Express Node.js app. |
| `https://api-v2.montessorischools.in/health` | `404 Not Found` | Express app is not serving this hostname. |
| `https://api-v2.montessorischools.in/api/health` | `404 Not Found` | Express app is not serving this hostname. |

This means the frontend/backend/database code should not be changed randomly. The first production blocker is Hostinger routing.

## What must happen in Hostinger

1. Open Hostinger hPanel.
2. Go to the Node.js application / web app section.
3. Confirm the backend app is deployed from the backend package, not the frontend package.
4. Confirm the app start command is:

```text
npm start
```

5. Confirm the backend build has been created:

```text
npm install
npm run build
```

6. Attach this custom domain to the Node.js app:

```text
api-v2.montessorischools.in
```

7. Redeploy/restart the Node.js app after environment-variable changes.
8. Verify the domain no longer shows Hostinger default HTML.

## Required backend environment variables

Configure these only in Hostinger backend environment settings:

```text
NODE_ENV=production
JWT_SECRET=<32+ character secret>
DATA_ENCRYPTION_KEY=<base64 32-byte key>
DB_HOST=<Hostinger MySQL host>
DB_PORT=3306
DB_USER=<Hostinger MySQL user>
DB_PASSWORD=<Hostinger MySQL password>
DB_NAME=<Hostinger MySQL database>
DB_CONNECTION_LIMIT=10
DB_SSL=true
UPLOAD_ROOT=<persistent Hostinger upload directory>
FRONTEND_ORIGIN=https://montessori-portal-frontend.vercel.app
ALLOW_PRODUCTION_MIGRATIONS=false
```

If the final public frontend domain is also used, add it to `FRONTEND_ORIGIN` as a comma-separated value:

```text
FRONTEND_ORIGIN=https://montessori-portal-frontend.vercel.app,https://www.montessorischools.in
```

## Required Vercel frontend variable

Configure this in Vercel and redeploy:

```text
VITE_API_URL=https://api-v2.montessorischools.in
```

Do not include `/api` at the end.

## New application diagnostics added

When Hostinger routes correctly, these URLs should return JSON:

```text
https://api-v2.montessorischools.in/
https://api-v2.montessorischools.in/health
https://api-v2.montessorischools.in/api
https://api-v2.montessorischools.in/api/health
https://api-v2.montessorischools.in/api/schools
```

Expected behavior:

- `/` confirms Express is serving the Montessori API.
- `/health` confirms the app process is alive.
- `/api` confirms the API base path is alive.
- `/api/health` confirms MySQL connectivity.
- `/api/schools` confirms public data routes are working.

## Commands to run locally

From `E:\montessori-portal`:

```powershell
npm run diagnose:production -w backend
```

Optional authenticated smoke test after `/api/health` is healthy:

```powershell
$env:API_URL="https://api-v2.montessorischools.in"
$env:TEST_SCHOOL_ID="<school id>"
$env:TEST_EMAIL="<login email>"
$env:TEST_PASSWORD="<login password>"
npm run smoke:production -w backend
```

## Frontend behavior added

The frontend now shows an API connection indicator on the school selection and login screens.

If Hostinger is still misrouted, it will explain that the backend is not reachable instead of only showing:

```text
Failed to fetch
```

## Completion condition

Production connectivity is complete only when:

1. `https://api-v2.montessorischools.in/` returns Montessori API JSON.
2. `https://api-v2.montessorischools.in/api/health` returns JSON with database health.
3. Vercel requests go to `https://api-v2.montessorischools.in/api/...`.
4. School list loads from the database.
5. Login redirects to dashboard.
6. Students, certificates, accounts, documents, events, reports, users and settings load without fake data.
