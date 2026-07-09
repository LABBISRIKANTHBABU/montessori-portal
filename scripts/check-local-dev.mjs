const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";

async function readJson(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function printResult(label, result) {
  if (!result.ok) {
    console.log(`[FAIL] ${label}: ${result.error}`);
    return;
  }
  const status = result.status;
  const database = result.body?.checks?.database;
  const code = result.body?.database?.code || result.body?.code || "";
  const message = result.body?.message || "";
  console.log(`[${status < 400 ? "OK" : "WARN"}] ${label}: HTTP ${status}${database === false ? " database=false" : ""}${code ? ` code=${code}` : ""}${message ? ` message=${message}` : ""}`);
}

const checks = [
  ["Backend app health", `${backendUrl}/health`],
  ["Backend database health", `${backendUrl}/api/health`],
  ["Frontend proxied database health", `${frontendUrl}/api/health`],
];

console.log("Montessori local development check");
console.log(`Frontend: ${frontendUrl}`);
console.log(`Backend:  ${backendUrl}`);
console.log("");

const results = [];
for (const [label, url] of checks) {
  const result = await readJson(url);
  results.push([label, result]);
  printResult(label, result);
}

const backendApp = results[0][1];
const backendDb = results[1][1];
const frontendProxy = results[2][1];

console.log("");
if (!backendApp.ok) {
  console.log("Next step: start the backend with `npm run dev -w backend` or run both apps with `npm run dev` from the project root.");
  process.exitCode = 1;
} else if (backendDb.ok && backendDb.status === 503) {
  console.log("Backend is running, but the database is unavailable. Check backend/.env DB_USER, DB_PASSWORD, DB_HOST, DB_NAME, DB_SSL and Hostinger remote MySQL permissions.");
  process.exitCode = 1;
} else if (!frontendProxy.ok) {
  console.log("Backend is running, but frontend proxy is not reachable. Start the frontend with `npm run dev -w frontend` or run `npm run dev` from the project root.");
  process.exitCode = 1;
} else {
  console.log("Local wiring is reachable. If login still fails, inspect the API response body in the browser Network tab.");
}
