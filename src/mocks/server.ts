/**
 * An in-browser stand-in for the API, used by the static build.
 *
 * `makerspace.ignisia.tech` is served as plain files with no server behind it,
 * so every call the app makes has to be answered locally. Rather than
 * reimplement the backend, this intercepts `fetch` and replays responses that
 * were captured from the real API running against the production seed — the
 * same 402 faculty, 53 machines, 150 materials and 5 domains. Shapes therefore
 * match the real thing exactly, because they *are* the real thing.
 *
 * Writes are kept in memory for the length of the visit. They are visible
 * immediately and discarded on reload, which is the honest behaviour for a
 * demo: nothing a visitor does can corrupt anything, and the next visitor
 * starts from the same clean state.
 */
import bundle from "./fixtures.json";

type Role = "student" | "labAssistant" | "superAdmin";

type Captured = { status: number; body: unknown };

type Bundle = {
  labId: string;
  responses: Record<Role, Record<string, Captured>>;
  collections: Record<Role, Record<string, unknown[]>>;
};

const data = bundle as unknown as Bundle;

const PERSONA_KEY = "ums_demo_persona";
const DEFAULT_ROLE: Role = "student";

export const personas: { role: Role; label: string; description: string }[] = [
  { role: "student", label: "Student", description: "Create projects, book slots, claim materials" },
  { role: "labAssistant", label: "Lab Assistant", description: "Run the console, manage equipment" },
  { role: "superAdmin", label: "Super Admin", description: "Everything, plus people and reference data" },
];

function currentRole(): Role {
  try {
    const stored = window.localStorage.getItem(PERSONA_KEY);
    if (stored && stored in data.responses) return stored as Role;
  } catch {
    // Storage can be unavailable in a private window; fall through.
  }
  return DEFAULT_ROLE;
}

function setRole(role: Role) {
  try {
    window.localStorage.setItem(PERSONA_KEY, role);
  } catch {
    // The persona then lasts only as long as the page, which is acceptable.
  }
}

function clearRole() {
  try {
    window.localStorage.removeItem(PERSONA_KEY);
  } catch {
    // Nothing to clean up.
  }
}

// ─── mutable overlay ───────────────────────────────────────────────────────
//
// Captured collections are frozen fixtures. Anything a visitor creates or
// edits lands here instead, and reads merge the two. Keyed by the normalised
// path a collection is read from.

const created = new Map<string, unknown[]>();
const patched = new Map<string, Record<string, unknown>>();
const removed = new Set<string>();

function overlayFor(path: string): unknown[] {
  return created.get(path) ?? [];
}

function applyOverlay(path: string, rows: unknown[]): unknown[] {
  const merged = [...overlayFor(path), ...rows];
  return merged
    .filter((row) => {
      const id = (row as { id?: string }).id;
      return !(id && removed.has(id));
    })
    .map((row) => {
      const id = (row as { id?: string }).id;
      const patch = id ? patched.get(id) : undefined;
      return patch ? { ...(row as object), ...patch } : row;
    });
}

// ─── helpers ───────────────────────────────────────────────────────────────

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function envelope(payload: unknown, meta?: unknown) {
  return { success: true, message: "OK", data: payload, ...(meta ? { meta } : {}) };
}

function failure(status: number, code: string, message: string) {
  return ok({ success: false, message, error: { code, details: [] } }, status);
}

function uuid() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `mock-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

/** Collapses the concrete lab id back to the placeholder the bundle is keyed by. */
function normalise(pathname: string) {
  return pathname.replace(data.labId, ":labId");
}

function searchable(row: unknown) {
  const r = row as Record<string, unknown>;
  return [r["name"], r["email"], r["title"], r["code"]]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
}

function paginate(rows: unknown[], params: URLSearchParams) {
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const filtered = search ? rows.filter((row) => searchable(row).includes(search)) : rows;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const limit = Math.max(1, Number(params.get("limit") ?? 50) || 50);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    rows: filtered.slice(start, start + limit),
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * What this role recorded for this path, and nothing else.
 *
 * Deliberately strict. An earlier version fell back to the Super Admin's
 * capture whenever a role had no entry of its own, which quietly handed a
 * Student the faculty administration list and every user account — the real
 * API answers 403 there, and the demo has to refuse where the real system
 * refuses. The capture covers every list path for every role, so a miss here
 * means a genuine gap rather than a permission to borrow.
 */
function captured(role: Role, path: string): Captured | undefined {
  return data.responses[role]?.[path];
}

/**
 * The bundle key for a request, matching how the builder wrote it: parameters
 * sorted so order does not matter, and pagination dropped because pages are
 * merged into a collection and re-paginated here.
 *
 * Slot booking depends on this. Its screens differ only by `date` and
 * `projectId`, so keying on the bare path would answer every day with
 * whichever day happened to be captured first.
 */
function keyFor(path: string, params: URLSearchParams): string {
  const rest = [...params.entries()]
    .filter(([name]) => name !== "page" && name !== "limit")
    .sort(([a], [b]) => a.localeCompare(b));
  return rest.length ? `${path}?${new URLSearchParams(rest).toString()}` : path;
}

function collection(role: Role, path: string): unknown[] | undefined {
  return data.collections[role]?.[path];
}

// ─── request handling ──────────────────────────────────────────────────────

/**
 * Finds a row by id anywhere the bundle holds one — the overlay first, then
 * the collections, then the body of any captured list.
 *
 * This is what answers a detail route for something created during the visit,
 * which by definition has no captured response of its own.
 */
function findRowById(role: Role, id: string): unknown {
  for (const rows of created.values()) {
    const hit = rows.find((row) => (row as { id?: string }).id === id);
    if (hit) return hit;
  }
  for (const rows of Object.values(data.collections[role] ?? {})) {
    const hit = rows.find((row) => (row as { id?: string }).id === id);
    if (hit) return hit;
  }
  for (const entry of Object.values(data.responses[role] ?? {})) {
    const rows = (entry.body as { data?: unknown })?.data;
    if (!Array.isArray(rows)) continue;
    const hit = rows.find((row) => (row as { id?: string }).id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Whether a captured list body is a collection of rows. */
function listBody(entry: Captured | undefined) {
  const rows = (entry?.body as { data?: unknown })?.data;
  return Array.isArray(rows) ? rows : null;
}

function handleGet(role: Role, path: string, params: URLSearchParams): Response {
  // The query-specific capture first, then the bare path as the fallback for a
  // combination the capture never saw.
  const hit = captured(role, keyFor(path, params)) ?? captured(role, path);

  // 1. A refusal this role actually received. Checked before anything else so
  //    the demo denies exactly where the real system denies, rather than
  //    finding the data by another route.
  if (hit && hit.status !== 200) return ok(hit.body, hit.status);

  // 2. A merged, re-paginated collection: /equipment, /admin/faculty, …
  const rows = collection(role, path);
  if (rows) {
    const { rows: pageRows, meta } = paginate(applyOverlay(path, rows), params);
    return ok(envelope(pageRows, meta));
  }

  // 3. An exactly captured response. Detail routes land here, because the
  //    capture walked every id the lists mentioned.
  if (hit) {
    const body = hit.body as { data?: unknown };
    const id = trailingId(path);
    if (Array.isArray(body.data)) {
      return ok({ ...body, data: applyOverlay(path, body.data) });
    }
    // Replay a single record with any edits made during this visit applied.
    const patch = id ? patched.get(id) : undefined;
    if (patch && body.data && typeof body.data === "object") {
      return ok({ ...body, data: { ...(body.data as object), ...patch } });
    }
    return ok(body);
  }

  // 4. A detail route for a row created or edited during this visit.
  const id = trailingId(path);
  if (id) {
    if (removed.has(id)) return failure(404, "NOT_FOUND", "That record no longer exists.");
    const row = findRowById(role, id);
    if (row) {
      const patch = patched.get(id);
      return ok(envelope(patch ? { ...(row as object), ...patch } : row));
    }
  }

  // 5. Nothing captured. Answer with the empty shape the caller expects rather
  //    than a 404: an unanswered query leaves a screen on "Loading…" forever,
  //    and an empty list or record renders as "nothing here yet", which is
  //    honest and costs the demo nothing. The warning is for whoever extends
  //    the capture next.
  console.warn(`[mock api] no fixture for ${path} — answering empty`);
  const sibling = captured(role, collectionPathFor(path));
  if (listBody(sibling) || !trailingId(path)) {
    return ok(envelope([], { page: 1, limit: 50, total: 0, totalPages: 1, hasNext: false, hasPrev: false }));
  }
  return ok(envelope(null));
}

/** The id at the end of a path, when there is one. */
function trailingId(path: string) {
  const last = path.split("/").pop() ?? "";
  return /^[0-9a-f-]{8,}$/i.test(last) || last.startsWith("mock-") ? last : null;
}

/** The collection a write should land in, derived from the path. */
function collectionPathFor(path: string) {
  const segments = path.split("/").filter(Boolean);
  // Drop a trailing id and any action verb after it: /projects/:id/archive
  const kept: string[] = [];
  for (const segment of segments) {
    if (/^[0-9a-f-]{8,}$/i.test(segment) || segment.startsWith("mock-")) break;
    kept.push(segment);
  }
  return "/" + kept.join("/");
}

async function handleWrite(
  method: string,
  role: Role,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const body = (() => {
    try {
      return init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  })();

  const base = collectionPathFor(path);
  const id = trailingId(path);

  if (method === "DELETE") {
    if (id) removed.add(id);
    return new Response(null, { status: 204 });
  }

  if (method === "POST" && !id) {
    const row = {
      id: uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "PENDING",
      ...body,
    };
    created.set(base, [row, ...overlayFor(base)]);
    return ok(envelope(row), 201);
  }

  if (id) {
    // Covers PATCH/PUT and the action endpoints (/archive, /cancel, /complete,
    // /decision, …), whose final segment names the new state.
    const action = path.split("/").pop();
    const stateFromAction: Record<string, string> = {
      archive: "ARCHIVED",
      cancel: "CANCELLED",
      complete: "COMPLETED",
      "check-out": "COMPLETED",
      read: "READ",
    };
    const patch: Record<string, unknown> = {
      ...body,
      ...(action && stateFromAction[action] ? { status: stateFromAction[action] } : {}),
      updatedAt: new Date().toISOString(),
    };
    patched.set(id, { ...(patched.get(id) ?? {}), ...patch });
    return ok(envelope({ id, ...patch }));
  }

  return ok(envelope({ ...body, id: uuid() }));
}

function handleAuth(path: string, method: string, init: RequestInit): Response | null {
  if (path === "/auth/google/config") {
    const hit = captured(currentRole(), path);
    return hit ? ok(hit.body) : ok(envelope({ clientId: "demo", hostedDomain: "mitwpu.edu.in" }));
  }

  if (path === "/auth/google/csrf") {
    return ok(envelope({ csrfToken: "demo-csrf" }));
  }

  if (path === "/auth/google" && method === "POST") {
    const parsed = (() => {
      try {
        return JSON.parse(String(init.body)) as { credential?: string };
      } catch {
        return {};
      }
    })();
    const credential = parsed.credential ?? "";
    const role: Role = credential.startsWith("demo:")
      ? ((credential.slice(5) as Role) ?? DEFAULT_ROLE)
      : DEFAULT_ROLE;
    const chosen = role in data.responses ? role : DEFAULT_ROLE;
    setRole(chosen);
    const me = captured(chosen, "/auth/me")?.body as
      | { data?: { user?: unknown; permissions?: string[] } }
      | undefined;
    return ok(
      envelope({
        user: me?.data?.user,
        permissions: me?.data?.permissions ?? [],
        accessToken: "demo-access-token",
        next: "dashboard",
      }),
    );
  }

  if (path === "/auth/refresh") {
    let signedIn = false;
    try {
      signedIn = window.localStorage.getItem(PERSONA_KEY) !== null;
    } catch {
      signedIn = false;
    }
    return signedIn
      ? ok(envelope({ accessToken: "demo-access-token" }))
      : failure(401, "UNAUTHENTICATED", "Not signed in");
  }

  if (path === "/auth/logout") {
    clearRole();
    return ok(envelope({}));
  }

  if (path === "/auth/me") {
    let signedIn = false;
    try {
      signedIn = window.localStorage.getItem(PERSONA_KEY) !== null;
    } catch {
      signedIn = false;
    }
    if (!signedIn) return failure(401, "UNAUTHENTICATED", "Not signed in");
    const hit = captured(currentRole(), "/auth/me");
    return hit ? ok(hit.body) : failure(401, "UNAUTHENTICATED", "Not signed in");
  }

  return null;
}

async function respond(url: URL, method: string, init: RequestInit): Promise<Response> {
  const path = normalise(url.pathname.replace(/^\/api\/v1/, ""));
  const role = currentRole();

  const auth = handleAuth(path, method, init);
  if (auth) return auth;

  if (path === "/uploads" || path.startsWith("/uploads")) {
    // No image host in the static build; hand back a placeholder so the
    // upload path completes rather than failing.
    return ok(envelope({ id: uuid(), url: "/placeholder.svg", secureUrl: "/placeholder.svg" }));
  }

  if (method === "GET") return handleGet(role, path, url.searchParams);
  return handleWrite(method, role, path, init);
}

let installed = false;

export function installMockApi() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const real = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const href =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const url = new URL(href, window.location.origin);

    if (!url.pathname.startsWith("/api/v1")) return real(input as RequestInfo, init);

    const method = (
      init.method ??
      (typeof input === "object" && "method" in input ? (input as Request).method : "GET")
    ).toUpperCase();

    // A little latency keeps loading states visible, so the demo looks like
    // the real system rather than an instant snapshot.
    await new Promise((resolve) => setTimeout(resolve, 120));

    try {
      return await respond(url, method, init);
    } catch (error) {
      console.error("[mock api]", error);
      return failure(500, "MOCK_ERROR", "The demo data could not answer that request.");
    }
  };

  // Lets the persona be switched from the console during a demo.
  (window as unknown as Record<string, unknown>)["__umsDemoSignIn"] = (role: Role) => {
    setRole(role);
    window.location.href = "/";
  };
}

/**
 * Whether this build is the public demo. The single source of truth — the
 * sign-in control and the landing copy both read it, so they cannot disagree
 * about whether there is a real backend behind the page.
 *
 * On by default: this branch exists only to be the demo, and it is deployed by
 * Cloudflare, which reads neither netlify.toml nor vercel.json. Depending on a
 * build variable meant an unset one shipped the genuine Google button to a
 * site with no API behind it. Set `VITE_DEMO_MODE=false` for the real flow.
 */
export const demoMode = import.meta.env["VITE_DEMO_MODE"] !== "false";
