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

test("sensitive fields round-trip through authenticated encryption", async () => {
  const { encryptField, decryptField } = await import("../src/security/fieldEncryption.js");
  const encrypted = encryptField("123456789012");
  assert.ok(encrypted);
  assert.notEqual(encrypted.toString("utf8"), "123456789012");
  assert.equal(decryptField(encrypted), "123456789012");
});

test("encrypted field detects tampering", async () => {
  const { encryptField, decryptField } = await import("../src/security/fieldEncryption.js");
  const encrypted = encryptField("987654321098")!;
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptField(encrypted));
});

test("school admin permissions exclude sensitive identifier access", async () => {
  const { rolePermissions } = await import("../src/security/permissions.js");
  assert.ok(rolePermissions["school_admin"].includes("student.create"));
  assert.equal(rolePermissions["school_admin"].includes("student.identifier.view_sensitive"), false);
});

test("all operational roles can load the dashboard", async () => {
  const { rolePermissions } = await import("../src/security/permissions.js");
  for (const role of ["group_super_admin", "school_admin", "principal", "accountant", "office_staff"]) {
    assert.ok(rolePermissions[role]?.includes("dashboard.view"), `${role} must be able to view the dashboard`);
  }
});
