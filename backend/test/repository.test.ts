import test from "node:test";
import assert from "node:assert/strict";

process.env.DEMO_MODE = "true";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DB_HOST = "db.test.invalid";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "test";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";

// ─── Student Repository ────────────────────────────────────────────────

test("listStudents returns filtered results by search", async () => {
  const repo = await import("../src/repository.js");
  // Create students first since demo mockStudents starts empty
  await repo.createStudent({
    admissionNo: "SEARCH-TEST-1", fullName: "Alpha Student",
    classAdmitted: "III", dateOfBirth: "2016-01-15", residenceAddress: "123 Street", confirmed: "on",
  }, { schoolId: 1, userId: 1 });
  await repo.createStudent({
    admissionNo: "SEARCH-TEST-2", fullName: "Beta Student",
    classAdmitted: "IV", dateOfBirth: "2015-06-20", residenceAddress: "456 Ave", confirmed: "on",
  }, { schoolId: 1, userId: 1 });

  const all = await repo.listStudents(1, "", "", 200, 0);
  assert.ok(all.data.length >= 2, "Should have at least 2 students");

  const searchResult = await repo.listStudents(1, "alpha", "", 200, 0);
  assert.ok(searchResult.data.length > 0, "Search filter should find matching students");
  assert.ok(searchResult.total <= all.total, "Filtered total should be <= unfiltered");
});

test("listStudents filters by status", async () => {
  const repo = await import("../src/repository.js");
  const activeOnly = await repo.listStudents(1, "", "active", 200, 0);
  for (const s of activeOnly.data) {
    assert.equal(s.status, "active", "All returned students should have active status");
  }
});

test("listStudents respects pagination", async () => {
  const repo = await import("../src/repository.js");
  const page1 = await repo.listStudents(1, "", "", 2, 0);
  const page2 = await repo.listStudents(1, "", "", 2, 2);
  assert.ok(page1.data.length <= 2, "Page 1 should have at most 2 items");
  assert.equal(typeof page1.total, "number", "Total should be provided");
  if (page2.data.length > 0) {
    assert.notEqual(page1.data[0]?.id, page2.data[0]?.id, "Pages should have different items");
  }
});

test("createStudent in demo mode populates mockStudents", async () => {
  const repo = await import("../src/repository.js");
  const before = await repo.listStudents(1, "", "", 200, 0);
  await repo.createStudent({
    admissionNo: "VALIDATION-TEST-1", fullName: "Validation Student",
    classAdmitted: "V", dateOfBirth: "2015-08-10", residenceAddress: "789 Blvd", confirmed: "on",
  }, { schoolId: 1, userId: 1 });
  const after = await repo.listStudents(1, "", "", 200, 0);
  assert.ok(after.total > before.total, "Should have more students after creation");
});

test("createStudent assigns unique admission numbers", async () => {
  const repo = await import("../src/repository.js");
  const s1 = await repo.createStudent({
    admissionNo: "UNIQUE-TEST-A",
    fullName: "Student A",
    classAdmitted: "III",
    dateOfBirth: "2016-03-15",
    residenceAddress: "123 Street",
    confirmed: "on",
  }, { schoolId: 1, userId: 1 });

  const s2 = await repo.createStudent({
    admissionNo: "UNIQUE-TEST-B",
    fullName: "Student B",
    classAdmitted: "III",
    dateOfBirth: "2016-05-20",
    residenceAddress: "456 Avenue",
    confirmed: "on",
  }, { schoolId: 1, userId: 1 });

  assert.notEqual(s1.admissionNo, s2.admissionNo, "Admission numbers should be unique");
});

test("createStudent rejects duplicate admission number in same school", async () => {
  const repo = await import("../src/repository.js");
  await assert.rejects(async () => {
    await repo.createStudent({
      admissionNo: "UNIQUE-TEST-A",
      fullName: "Duplicate",
      classAdmitted: "III",
      dateOfBirth: "2016-03-15",
      residenceAddress: "123 Street",
      confirmed: "on",
    }, { schoolId: 1, userId: 1 });
  }, /already exists/i, "Should reject duplicate admission number");
});

// ─── Dashboard Repository ──────────────────────────────────────────────

test("getDashboard returns correct counts and structure", async () => {
  const repo = await import("../src/repository.js");
  const dashboard = await repo.getDashboard(1);

  assert.equal(typeof dashboard.totals.students, "number", "students count should be a number");
  assert.equal(typeof dashboard.totals.active, "number", "active count should be a number");
  assert.equal(typeof dashboard.totals.schools, "number", "schools count should be a number");
  assert.ok(dashboard.totals.students > 0, "Should have at least 1 student in demo");
  assert.ok(Array.isArray(dashboard.enrollmentByClass), "enrollmentByClass should be an array");
  assert.ok(dashboard.enrollmentByClass.length > 0, "Should have enrollment data");
  assert.ok(Array.isArray(dashboard.recent), "recent activity should be an array");
});

// ─── Academic Setup Repository ─────────────────────────────────────────

test("getAcademicSetup returns academic configuration", async () => {
  const repo = await import("../src/repository.js");
  const setup = await repo.getAcademicSetup(1);
  assert.ok(Array.isArray(setup.academicYears), "academicYears should be an array");
  assert.ok(Array.isArray(setup.boards), "boards should be an array");
  assert.ok(Array.isArray(setup.classes), "classes should be an array");
  assert.ok(setup.academicYears.length > 0, "Should have at least one academic year");
  assert.ok(setup.boards.includes("CBSE"), "Should include CBSE board");
});

// ─── Fee Repository ────────────────────────────────────────────────────

test("listFeeCategories returns fee categories", async () => {
  const repo = await import("../src/repository.js");
  const categories = await repo.listFeeCategories(1);
  assert.ok(Array.isArray(categories), "Categories should be an array");
  assert.ok(categories.length > 0, "Should have at least one fee category");
  assert.ok(categories[0].name, "Each category should have a name");
});

test("listFeeStructures returns fee structures", async () => {
  const repo = await import("../src/repository.js");
  const structures = await repo.listFeeStructures(1);
  assert.ok(Array.isArray(structures), "Structures should be an array");
  assert.ok(structures.length > 0, "Should have at least one fee structure");
  assert.equal(typeof structures[0].amount, "number", "Amount should be a number");
});

test("getStudentFeeSummary returns fee summary for student", async () => {
  const repo = await import("../src/repository.js");
  const summary = await repo.getStudentFeeSummary(1, 1, "2026-27");
  assert.ok(summary, "Should return fee summary");
  assert.ok(Array.isArray(summary.summary), "summary should be an array");
  assert.equal(typeof summary.totalPending, "number", "totalPending should be a number");
  assert.equal(summary.academicYear, "2026-27");
});

// ─── Events Repository ─────────────────────────────────────────────────

test("listEvents returns event list", async () => {
  const repo = await import("../src/repository.js");
  const events = await repo.listEvents(1);
  assert.ok(Array.isArray(events), "Events should be an array");
  assert.ok(events.length > 0, "Demo mode should have events");
  assert.ok(events[0].title, "Event should have a title");
  assert.ok(events[0].status, "Event should have a status");
});

test("createEvent creates event with required fields", async () => {
  const repo = await import("../src/repository.js");
  const eventId = await repo.createEvent(1, 1, {
    title: "Repository Test Event",
    description: "Testing repository layer",
    eventType: "academic",
    startDate: "2026-11-01T09:00:00Z",
    location: "Room 101",
  });
  assert.equal(typeof eventId, "number", "Should return event ID");
  assert.ok(eventId > 0, "Event ID should be positive");
});
