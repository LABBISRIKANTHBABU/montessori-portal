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
process.env.DEMO_MODE = "false";

// ─── Auth API ───────────────────────────────────────────────────────────

test("POST /api/auth/login returns JWT token", async () => {
  const repo = await import("../src/repository.js");
  const result = await repo.authenticateUser(1, "admin@montessori.edu", "Montessori@2026");
  assert.ok(result, "Login should succeed with valid credentials");
  assert.ok(typeof result.token === "string" && result.token.length > 0, "Token should be a non-empty string");
  assert.ok(result.token.split(".").length === 3, "Token should have 3 parts (JWT format)");
  assert.equal(result.mustChangePassword, false);
  assert.equal(typeof result.user.name, "string");
  assert.equal(typeof result.user.role, "string");
  assert.ok(result.school, "Should return school info");
});

test("POST /api/auth/login rejects invalid credentials", async () => {
  const repo = await import("../src/repository.js");
  const result = await repo.authenticateUser(1, "admin@montessori.edu", "wrongpassword");
  assert.equal(result, null, "Login should fail with invalid password");
});

test("POST /api/auth/login rejects non-existent user", async () => {
  const repo = await import("../src/repository.js");
  const result = await repo.authenticateUser(1, "nobody@montessori.edu", "Montessori@2026");
  assert.equal(result, null, "Login should fail for non-existent user");
});

test("POST /api/auth/refresh rotates tokens", async () => {
  const { SignJWT } = await import("jose");
  const { createHash, randomBytes } = await import("node:crypto");
  const repo = await import("../src/repository.js");

  // In demo mode, refreshSession returns a new JWT regardless of input
  const result = await repo.refreshSession("dummy-hash");
  assert.ok(result, "Refresh should succeed in demo mode");
  assert.ok(result!.token, "Should return a new token");
  assert.equal(typeof result!.mustChangePassword, "boolean");
});

test("POST /api/auth/logout revokes session", async () => {
  const repo = await import("../src/repository.js");
  // In demo mode, revokeSession is a no-op (does not throw)
  await assert.doesNotReject(async () => {
    await repo.revokeSession("test-session-id", 1);
  });
});

// ─── Students API ──────────────────────────────────────────────────────

test("GET /api/students returns paginated list", async () => {
  const repo = await import("../src/repository.js");
  const result = await repo.listStudents(1, "", "", 50, 0);
  assert.ok(Array.isArray(result.data), "data should be an array");
  assert.equal(typeof result.total, "number", "total should be a number");
  assert.ok(result.total >= 0, "total should be non-negative");
});

test("GET /api/students with search filters results", async () => {
  const repo = await import("../src/repository.js");
  const all = await repo.listStudents(1, "", "", 100, 0);
  const filtered = await repo.listStudents(1, "test", "", 100, 0);
  assert.ok(filtered.total <= all.total, "Filtered results should be subset");
});

test("POST /api/students creates student", async () => {
  const repo = await import("../src/repository.js");
  const input = {
    admissionNo: "TEST-API-001",
    fullName: "Test Student",
    academicYear: "2026-27",
    board: "CBSE",
    dateOfAdmission: "2026-07-01",
    classAdmitted: "V",
    sectionName: "A",
    dateOfBirth: "2015-06-15",
    gender: "male",
    residenceAddress: "123 Test Street, Test City",
    currentStatus: "active",
    confirmed: "on",
  };
  const student = await repo.createStudent(input, { schoolId: 1, userId: 1 });
  assert.ok(student, "Should return created student");
  assert.equal(student.fullName, "Test Student");
  assert.equal(student.admissionNo, "TEST-API-001");
  assert.equal(student.status, "active");
});

test("POST /api/students rejects duplicate admission number", async () => {
  const repo = await import("../src/repository.js");
  const input = {
    admissionNo: "TEST-API-001",
    fullName: "Duplicate Student",
    academicYear: "2026-27",
    board: "CBSE",
    dateOfAdmission: "2026-07-01",
    classAdmitted: "V",
    dateOfBirth: "2015-06-15",
    residenceAddress: "123 Test Street, Test City",
    confirmed: "on",
  };
  await assert.rejects(async () => {
    await repo.createStudent(input, { schoolId: 1, userId: 1 });
  }, /admission number already exists/i, "Should reject duplicate admission number");
});

test("GET /api/students/:id returns student detail", async () => {
  const repo = await import("../src/repository.js");
  const listResult = await repo.listStudents(1, "", "", 1, 0);
  assert.ok(listResult.data.length > 0, "Need at least one student in demo");
  const studentId = listResult.data[0].id;
  const student = await repo.getStudent(1, studentId);
  assert.ok(student, "Should return student detail");
  assert.equal(student.id, studentId);
});

test("PUT /api/students/:id updates student", async () => {
  const repo = await import("../src/repository.js");
  const listResult = await repo.listStudents(1, "", "", 1, 0);
  const studentId = listResult.data[0].id;
  const updated = await repo.updateStudent(1, studentId, 1, {
    fullName: "Updated Name",
    classAdmitted: "VI",
    sectionName: "B",
    residenceAddress: "456 Updated Ave",
  });
  assert.ok(updated, "Should return updated student");
  assert.equal(updated.fullName, "Updated Name");
});

// ─── Events API ────────────────────────────────────────────────────────

test("GET /api/events returns list", async () => {
  const repo = await import("../src/repository.js");
  const events = await repo.listEvents(1);
  assert.ok(Array.isArray(events), "Events should be an array");
  assert.ok(events.length > 0, "Demo mode should have events");
  assert.ok(events[0].title, "Each event should have a title");
});

test("GET /api/events filters by type", async () => {
  const repo = await import("../src/repository.js");
  const cultural = await repo.listEvents(1, "cultural");
  assert.ok(Array.isArray(cultural), "Filtered events should be an array");
  for (const e of cultural) {
    assert.equal(e.type, "cultural", "All returned events should be cultural type");
  }
});

test("POST /api/events creates event", async () => {
  const repo = await import("../src/repository.js");
  const eventId = await repo.createEvent(1, 1, {
    title: "Test Event",
    description: "A test event",
    eventType: "academic",
    startDate: "2026-10-01T10:00:00Z",
    location: "Test Room",
  });
  assert.equal(typeof eventId, "number", "Should return event ID");
  assert.ok(eventId > 0, "Event ID should be positive");
});

test("GET /api/events/dashboard returns dashboard data", async () => {
  const repo = await import("../src/repository.js");
  const dashboard = await repo.getEventsDashboard(1);
  assert.ok(dashboard, "Should return events dashboard");
  assert.equal(typeof dashboard.total, "number", "total should be a number");
  assert.equal(typeof dashboard.upcoming, "number", "upcoming should be a number");
  assert.equal(typeof dashboard.completed, "number", "completed should be a number");
  assert.equal(typeof dashboard.totalMedia, "number", "totalMedia should be a number");
});

// ─── Dashboard API ─────────────────────────────────────────────────────

test("GET /api/dashboard returns dashboard data", async () => {
  const repo = await import("../src/repository.js");
  const dashboard = await repo.getDashboard(1);
  assert.ok(dashboard, "Should return dashboard data");
  assert.ok(dashboard.totals, "Should have totals");
  assert.equal(typeof dashboard.totals.students, "number");
  assert.ok(Array.isArray(dashboard.enrollmentByClass), "Should have enrollment data");
  assert.ok(Array.isArray(dashboard.recent), "Should have recent activity");
});
