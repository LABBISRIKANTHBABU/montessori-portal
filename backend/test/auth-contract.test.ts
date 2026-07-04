import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DB_HOST = "db.test.invalid";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "test";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

test("access token preserves identity, school, role and permissions", async () => {
  const { createAccessToken, verifyAccessToken } = await import("../src/security/accessToken.js");
  const token = await createAccessToken({
    userId: 42,
    schoolId: 7,
    role: "school_admin",
    permissions: ["dashboard.view", "student.view"],
  });
  const payload = await verifyAccessToken(token);
  assert.equal(payload.sub, "42");
  assert.equal(payload.schoolId, 7);
  assert.equal(payload.role, "school_admin");
  assert.deepEqual(payload.permissions, ["dashboard.view", "student.view"]);
});

test("access token expires after seven days", async () => {
  const { ACCESS_TOKEN_LIFETIME_SECONDS, createAccessToken, verifyAccessToken } = await import("../src/security/accessToken.js");
  const payload = await verifyAccessToken(await createAccessToken({
    userId: 1,
    schoolId: 1,
    role: "principal",
    permissions: ["dashboard.view"],
  }));
  assert.equal((payload.exp || 0) - (payload.iat || 0), ACCESS_TOKEN_LIFETIME_SECONDS);
});

test("tampered access token is rejected", async () => {
  const { createAccessToken, verifyAccessToken } = await import("../src/security/accessToken.js");
  const token = await createAccessToken({
    userId: 1,
    schoolId: 1,
    role: "accountant",
    permissions: ["dashboard.view"],
  });
  await assert.rejects(() => verifyAccessToken(`${token.slice(0, -1)}x`));
});
