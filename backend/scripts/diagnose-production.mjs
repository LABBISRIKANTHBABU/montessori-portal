const apiUrl = String(process.env.API_URL || "https://api-v2.montessorischools.in").replace(/\/+$/, "");

const checks = [
  ["/", "API root should return Montessori JSON, not Hostinger HTML."],
  ["/health", "App health should return JSON without touching MySQL."],
  ["/api", "API base should return JSON route information."],
  ["/api/health", "Database health should return JSON and database.ok=true."],
  ["/api/schools", "Public school directory should return JSON data."],
];

function classify(contentType, body, status) {
  const text = String(body || "");
  if (/hostinger/i.test(text) && /default page/i.test(text)) {
    return "Hostinger default page: the domain is not routed to the Node.js app.";
  }
  if (/^\s*</.test(text) || /text\/html/i.test(contentType || "")) {
    return "HTML response: traffic is not reaching the Express JSON API.";
  }
  if (status === 404) return "404: route missing or request is reaching the wrong app.";
  if (status >= 500) return "5xx: Express is likely running but failing internally.";
  return "JSON/API response detected.";
}

async function probe(path, note) {
  const url = `${apiUrl}${path}`;
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const contentType = response.headers.get("content-type") || "";
    const bodyText = await response.text();
    let json;
    try { json = JSON.parse(bodyText); } catch { json = undefined; }
    const diagnosis = classify(contentType, bodyText, response.status);
    return {
      url,
      status: response.status,
      ok: response.ok && Boolean(json),
      milliseconds: Date.now() - started,
      diagnosis,
      note,
      body: json || bodyText.slice(0, 160).replace(/\s+/g, " ").trim(),
    };
  } catch (error) {
    return {
      url,
      status: "NETWORK_ERROR",
      ok: false,
      milliseconds: Date.now() - started,
      diagnosis: error instanceof Error ? error.message : String(error),
      note,
      body: "",
    };
  }
}

const results = [];
for (const [path, note] of checks) {
  results.push(await probe(path, note));
}

console.table(results.map(({ url, status, ok, milliseconds, diagnosis }) => ({ url, status, ok, milliseconds, diagnosis })));
console.log("\nDetails:");
for (const result of results) {
  console.log(`\n${result.url}`);
  console.log(`Expected: ${result.note}`);
  console.log("Response:", result.body);
}

if (results.some(result => !result.ok)) process.exit(1);
