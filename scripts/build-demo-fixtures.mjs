/**
 * Builds the demo fixture bundle the static site answers its own API calls
 * from.
 *
 * Input is `src/mocks/fixtures.full.json` — the untouched capture produced by
 * scripts/capture-demo-fixtures.mjs in the makerspace-local folder, which is
 * deliberately NOT committed. Output is `src/mocks/fixtures.json`, which is,
 * and which therefore has to be safe to publish: this repository is public and
 * the built site is served to anyone.
 *
 * Two privacy decisions are applied here rather than at capture time, so they
 * stay visible and can be changed by editing one constant and re-running:
 *
 *   - Student records are replaced with stable synthetic identities. Enrolment
 *     numbers in particular are not directory information and must not ship.
 *   - Faculty email addresses are masked by default. The names stay in full —
 *     showing the real directory is the point of the demo — but the addresses
 *     came from an internal division spreadsheet, and a public repository is a
 *     scrapeable place to leave 400 of them. Set MASK_FACULTY_EMAILS to false
 *     if the department is happy for them to be published verbatim.
 *
 * Usage:  node scripts/build-demo-fixtures.mjs
 */
import fs from "node:fs";

const MASK_FACULTY_EMAILS = true;

/** Paths whose pages are merged into one collection and re-paginated at runtime. */
const PAGED = new Set([
  "/admin/faculty",
  "/users",
  "/users/search/faculty-mentors",
  "/equipment",
]);

const source = new URL("../src/mocks/fixtures.full.json", import.meta.url);
const target = new URL("../src/mocks/fixtures.json", import.meta.url);

if (!fs.existsSync(source)) {
  console.error(
    "src/mocks/fixtures.full.json is missing.\n" +
      "It is the raw capture and is not committed. Re-create it with\n" +
      "scripts/capture-demo-fixtures.mjs in the makerspace-local folder,\n" +
      "which replays the real API against the local seed.",
  );
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(source, "utf8"));
const LAB = raw.labId;

// ─── shape the bundle ──────────────────────────────────────────────────────

const responses = {};
const collections = {};

/**
 * Query parameters sorted into a stable order, so a lookup matches however the
 * caller happened to order them. Pagination is deliberately dropped: pages are
 * merged into a collection and re-paginated at runtime.
 */
function key(path) {
  const [bare, query] = path.split("?");
  const base = bare.replace(LAB, ":labId");
  if (!query) return base;
  const params = new URLSearchParams(query);
  params.delete("page");
  params.delete("limit");
  const rest = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return rest.length ? `${base}?${new URLSearchParams(rest).toString()}` : base;
}

for (const { role, path, status, body } of raw.captured) {
  if (body == null) continue;
  responses[role] ??= {};
  collections[role] ??= {};

  const base = path.split("?")[0].replace(LAB, ":labId");

  if (status === 200 && PAGED.has(base) && Array.isArray(body.data)) {
    (collections[role][base] ??= []).push(...body.data);
    continue;
  }

  // Stored twice: once under the full query, which is what a date-driven
  // screen like slot booking asks for, and once under the bare path as the
  // fallback for a query this capture never saw. First write wins, so page 1
  // of a list is not clobbered by page 2.
  const full = key(path);
  responses[role][full] ??= { status, body };
  if (full !== base) responses[role][base] ??= { status, body };
}

// ─── filter what is not safe to publish ────────────────────────────────────

let prns = 0;
let students = 0;
let masked = 0;

const FIRST = [
  "Aarav", "Diya", "Kabir", "Meera", "Rohan",
  "Sana", "Arjun", "Isha", "Vihaan", "Tara",
];
const LAST = [
  "Apte", "Bhave", "Chavan", "Deshpande", "Gokhale",
  "Joshi", "Kulkarni", "Nene", "Patil", "Ranade",
];

/** A stable synthetic identity, so one account reads the same everywhere. */
function alias(seed) {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  // Both shifts are unsigned. `>>` is signed, so any hash above 2^31 went
  // negative, indexed off the end of the array and produced names like
  // "Aarav undefined" — which then showed up in the profile and the sidebar.
  const name = `${FIRST[hash % FIRST.length]} ${LAST[(hash >>> 5) % LAST.length]}`;
  return {
    name,
    email: `${name.toLowerCase().replace(" ", ".")}${hash % 97}@mitwpu.edu.in`,
    prn: `10${String(hash % 100000000).padStart(8, "0")}`,
  };
}

/**
 * `anita.deshmukh@mitwpu.edu.in` → `a•••••@mitwpu.edu.in`.
 *
 * Enough shape survives that the column still looks like a directory and
 * search-by-email still narrows sensibly, without publishing the address.
 */
function mask(email) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${"•".repeat(Math.max(3, Math.min(6, local.length - 1)))}@${domain}`;
}

const isStudent = (node) =>
  Array.isArray(node.roles) && node.roles.length > 0 && node.roles.every((r) => r === "STUDENT");

function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;

  if (typeof node.prn === "string") {
    node.prn = alias(node.prn).prn;
    prns += 1;
  }

  if (typeof node.email === "string") {
    if (isStudent(node)) {
      const fake = alias(node.id ?? node.email);
      node.email = fake.email;
      if (typeof node.name === "string") node.name = fake.name;
      students += 1;
    } else if (MASK_FACULTY_EMAILS && node.email.endsWith("@mitwpu.edu.in")) {
      node.email = mask(node.email);
      masked += 1;
    }
  }

  for (const value of Object.values(node)) walk(value);
}

const bundle = { labId: LAB, responses, collections };
walk(bundle);
fs.writeFileSync(target, JSON.stringify(bundle));

// ─── report ────────────────────────────────────────────────────────────────

const kb = Math.round(fs.statSync(target).size / 1024);
for (const role of Object.keys(responses)) {
  const paths = Object.keys(responses[role]).length;
  const cols = Object.entries(collections[role] ?? {})
    .map(([k, v]) => `${k}=${v.length}`)
    .join(" ");
  console.log(`${role.padEnd(13)} ${String(paths).padStart(4)} paths   ${cols}`);
}
console.log(
  `\nwrote src/mocks/fixtures.json (${kb} KB): ` +
    `${students} student records replaced, ${prns} PRNs replaced, ${masked} emails masked`,
);
