# Montessori ERP — Setup Guide

## Architecture

```
React Frontend → Node.js + Express API → Hostinger MySQL → Hostinger File Storage
```

---

## Prerequisites

- Node.js 20+ installed
- MySQL database (Hostinger)
- Domain pointing to your hosting

---

## 1. Clone & Install

```bash
git clone https://github.com/LABBISRIKANTHBABU/montessori-portal.git
cd montessori-portal

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 2. Configure Environment

Create `backend/.env`:

```env
PORT=4000
NODE_ENV=production
JWT_SECRET=your-32-char-random-secret-here-change-this
DATA_ENCRYPTION_KEY=base64-encoded-32-byte-key
DB_HOST=your-hostinger-mysql-host
DB_PORT=3306
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=your-database-name
DB_CONNECTION_LIMIT=10
DB_SSL=true
FRONTEND_ORIGIN=https://montessorischools.in
ALLOW_PRODUCTION_MIGRATIONS=true
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate DATA_ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 3. Run Database Migrations

```bash
cd backend
npm run migrate
```

This creates all required tables automatically.

---

## 4. Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

**Demo Login:**
- Email: `admin@montessori.edu`
- Password: `Montessori@2026`

---

## 5. Production Build

```bash
# Build frontend
cd frontend
npm run build

# The built files are in frontend/dist/
```

---

## 6. Deploy to Hostinger

### Frontend (Static Files)

1. Build the frontend: `npm run build`
2. Upload `frontend/dist/` contents to your Hostinger public_html folder
3. Create `.htaccess` in public_html for SPA routing:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

### Backend (Node.js)

1. Upload the entire `backend/` folder to your Hostinger server
2. Run `npm install --production` on the server
3. Run `npm run migrate` on the server
4. Start with PM2:

```bash
pm2 start dist/server.js --name montessori-api
pm2 save
pm2 startup
```

If Hostinger doesn't support Node.js, you'll need a VPS (like DigitalOcean, Linode, or Hostinger VPS) for the backend.

### Database

1. Import `database/*.sql` files into your Hostinger MySQL database, OR
2. Run `npm run migrate` which handles this automatically

### File Storage

Create these folders with write permissions:
```
uploads/
uploads/students/
uploads/events/
uploads/documents/
uploads/certificates/
uploads/settings/
```

---

## 7. Update Frontend API URL

In `frontend/src/api.ts`, update the API base URL:

```typescript
const API_BASE = process.env.NODE_ENV === "production"
  ? "https://api.montessorischools.in"
  : "";
```

Then rebuild: `npm run build`

---

## 8. SSL Certificate

Enable SSL in Hostinger control panel for:
- `montessorischools.in`
- `api.montessorischools.in`

---

## 9. Verify Deployment

1. Open https://montessorischools.in
2. Login with admin credentials
3. Test each module:
   - Students (add, edit, view)
   - Events (create, upload media)
   - Fees (collect payment, generate receipt)
   - Certificates (generate, download PDF)
   - Reports (view charts, export CSV)
   - Settings (update school info)

---

## Default Accounts

| Role | Email | Password |
|------|-------|----------|
| School Admin | admin@montessori.edu | Montessori@2026 |
| Super Admin | superadmin@montessori.edu | Montessori@2026 |

**Change these passwords after first login!**

---

## Troubleshooting

### "Cannot connect to database"
- Check DB_HOST, DB_USER, DB_PASSWORD in .env
- Ensure database exists on Hostinger
- Check DB_SSL is set to true

### "JWT secret not set"
- Generate a new JWT_SECRET (see step 2)

### "File upload fails"
- Check uploads/ folder permissions (755 or 777)
- Check PHP/node process has write access

### Frontend shows "Network Error"
- Check CORS settings in backend
- Ensure FRONTEND_ORIGIN matches your domain

---

## Support

For issues, check:
1. Backend logs: `pm2 logs montessori-api`
2. Browser console for frontend errors
3. Hostinger control panel for PHP/Node errors
