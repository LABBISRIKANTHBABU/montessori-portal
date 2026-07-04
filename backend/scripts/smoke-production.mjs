const apiUrl = String(process.env.API_URL || "").replace(/\/+$/, "");
const schoolId = Number(process.env.TEST_SCHOOL_ID || 0);
const email = process.env.TEST_EMAIL || "";
const password = process.env.TEST_PASSWORD || "";

if (!apiUrl || !schoolId || !email || !password) {
  console.error("Set API_URL, TEST_SCHOOL_ID, TEST_EMAIL, and TEST_PASSWORD.");
  process.exit(2);
}

async function call(path, token, schoolScope) {
  const response = await fetch(`${apiUrl}/api${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(schoolScope ? { "X-School-ID": String(schoolScope) } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${body.message || response.statusText}`);
  return body;
}

const checks = [];
async function check(name, operation) {
  const started = Date.now();
  try {
    await operation();
    checks.push({ module: name, status: "PASS", milliseconds: Date.now() - started });
  } catch (error) {
    checks.push({ module: name, status: "FAIL", error: error instanceof Error ? error.message : String(error) });
  }
}

let preflightReady = false;
await check("Health and database", async () => {
  const health = await call("/health");
  if (health.status !== "ok" || health.database?.ok !== true) {
    throw new Error("API did not report a healthy database.");
  }
  preflightReady = true;
});
await check("Public school directory", async () => {
  const schools = await call("/schools");
  if (!Array.isArray(schools.data)) throw new Error("School directory response is invalid.");
});

if (!preflightReady) {
  console.table(checks);
  console.error("Preflight failed. Credentials were not sent.");
  process.exit(1);
}

let login;
await check("Authentication", async () => {
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolId, email, password }),
    signal: AbortSignal.timeout(20_000),
  });
  login = await response.json().catch(() => ({}));
  if (!response.ok || !login.token) throw new Error(`${response.status} ${login.message || "Login failed"}`);
});

if (login?.token) {
  const token = login.token;
  const modules = [
    ["Dashboard", "/dashboard"],
    ["Students", "/students?page=1"],
    ["Academic setup", "/academic/setup"],
    ["Imports", "/imports"],
    ["Documents", "/documents/categories"],
    ["Certificates", "/certificates"],
    ["Fees and accounts", "/accounts/dashboard"],
    ["Events", "/events/dashboard"],
    ["Reports", "/reports/dashboard"],
    ["Staff and roles", "/users"],
    ["School settings", "/settings"],
  ];
  for (const [name, path] of modules) {
    await check(name, () => call(path, token, schoolId));
  }
}

console.table(checks);
if (checks.some(item => item.status === "FAIL")) process.exit(1);
