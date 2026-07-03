# Production Database Runbook

## Safety boundary

The application uses the configured `DB_NAME` only. Migration status and dry-run commands are read-only. Migration application is locked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_MIGRATIONS=true`.

Never use the production database as the first migration target.

## Required environment values

- `DEMO_MODE=false`
- `JWT_SECRET`: at least 32 random characters
- `DATA_ENCRYPTION_KEY`: a base64-encoded 32-byte key
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL=true`
- `DB_CONNECTION_LIMIT=10`
- `ALLOW_PRODUCTION_MIGRATIONS=false`

Generate the encryption key locally and store it in the deployment secret manager:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Losing this key makes encrypted Aadhaar and bank values unrecoverable. Do not commit or send it through chat.

## Staging procedure

1. Create a fresh staging clone from the latest production backup.
2. Confirm that the backup can be restored.
3. Point `.env` to staging.
4. Run:

```powershell
cd E:\montessori-portal\backend
npm run migrate:status
npm run migrate:dry-run
npm run migrate:up
```

5. Confirm `GET /api/health` returns `mode: database` and `database.ok: true`.
6. Create a fresh bcrypt-hashed administrator:

```powershell
npm run user:provision-admin -- --name "Administrator Name" --email "admin@example.com" --school-code MEMHSVNK
```

The command generates a one-time password, stores only its bcrypt hash, assigns `school_admin`, and writes an audit event.
7. Test login, tenant isolation, student creation, duplicate rejection, rollback and encrypted-field storage.
8. Compare legacy and v2 record counts. Obtain approval before production.

## Production procedure

1. Schedule a maintenance window.
2. Capture and verify a new restorable backup.
3. Deploy the already-tested application build.
4. Run `npm run migrate:status` and verify the displayed database name and exact pending filenames.
5. Temporarily set `ALLOW_PRODUCTION_MIGRATIONS=true`.
6. Run `npm run migrate:up` once.
7. Immediately restore `ALLOW_PRODUCTION_MIGRATIONS=false`.
8. Check health, login and one non-sensitive school-scoped query.
9. Monitor API errors, database connections and slow queries.
10. Keep the legacy application available until reconciliation and client sign-off.

## Implemented protections

- Pooled MySQL connections with bounded concurrency
- Migration checksums and advisory locking
- Read-only migration status and dry-run
- Production migration lock
- Transactional student creation and rollback
- School-scoped duplicate checking
- AES-256-GCM encryption for Aadhaar and bank values
- Database-backed production permissions
- Redacted audit events
- Private photo path storage and failed-upload cleanup
- Database health check without credential disclosure
