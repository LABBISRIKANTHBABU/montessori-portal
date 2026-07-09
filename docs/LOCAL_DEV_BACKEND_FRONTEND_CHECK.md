# Local Backend + Frontend Check

Use this when Vite prints errors like:

```text
[vite] http proxy error: /api/health
AggregateError [ECONNREFUSED]
```

That message means the frontend dev server is running, but it cannot reach the backend API target.

---

## Correct local startup

From the project root:

```powershell
cd E:\montessori-portal
npm run dev
```

This starts both services:

- Backend API: `http://127.0.0.1:4000`
- Frontend: `http://localhost:5173`

Do not start only the frontend if you need API-backed screens such as school selection, login, dashboard or students.

---

## Health check

In another terminal:

```powershell
cd E:\montessori-portal
npm run dev:check
```

Expected healthy wiring:

```text
Backend app health: HTTP 200
Backend database health: HTTP 200
Frontend proxied database health: HTTP 200
```

If backend app health is `HTTP 200` but database health is `HTTP 503`, the Node API is working and the remaining issue is database access.

---

## Current Hostinger database error meaning

This error:

```text
ER_ACCESS_DENIED_ERROR
Access denied for user '...'@'...' (using password: YES)
```

means the API reached MySQL, but MySQL rejected the credentials or remote access policy.

Check in `backend/.env` and Hostinger:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL`
- Remote MySQL access / allowed IP policy
- Whether the database user has privileges on the selected database

Do not commit `.env`; it contains production secrets.

---

## Production reminder

For Vercel, set:

```text
VITE_API_URL=https://api-v2.montessorischools.in
```

For Hostinger, the Node app must return JSON at:

```text
https://api-v2.montessorischools.in/health
https://api-v2.montessorischools.in/api/health
```

If those URLs show a Hostinger default page or 404, Hostinger is not routing the domain to the Express app yet.
