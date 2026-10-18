/**
 * Builds the demo fixture bundle the static site answers its own API calls
 * from.
 *
 * Input is `src/mocks/fixtures.full.json` — the untouched capture from the
 * production API, which is deliberately NOT committed. Output is
 * `src/mocks/fixtures.json`, which is, and which therefore has to be safe to
 * publish: this repository is public and the built site is served to anyone.
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

const bundle = JSON.parse(fs.readFileSync(source, "utf8"));

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
  const name = `${FIRST[hash % FIRST.length]} ${LAST[(hash >> 5) % LAST.length]}`;
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

walk(bundle);
fs.writeFileSync(target, JSON.stringify(bundle));

const kb = Math.round(fs.statSync(target).size / 1024);
console.log(
  `wrote src/mocks/fixtures.json (${kb} KB): ` +
    `${students} student records replaced, ${prns} PRNs replaced, ${masked} emails masked`,
);
