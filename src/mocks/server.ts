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

type Captured = { __status: number; body: unknown };

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

/** Finds a captured response, falling back to the most privileged persona. */
function captured(role: Role, path: string): Captured | undefined {
  return data.responses[role]?.[path] ?? data.responses.superAdmin?.[path];
}

function collection(role: Role, path: string): unknown[] | undefined {
  return data.collections[role]?.[path] ?? data.collections.superAdmin?.[path];
}

// ─── request handling ──────────────────────────────────────────────────────

function handleGet(role: Role, path: string, params: URLSearchParams): Response {
  const rows = collection(role, path);
  if (rows) {
    // `/equipment` is read unpaginated by some screens and paginated by
    // others; the meta is harmless when ignored.
    const { rows: pageRows, meta } = paginate(applyOverlay(path, rows), params);
    return ok(envelope(pageRows, meta));
  }

  const hit = captured(role, path);
  if (!hit) return failure(404, "NOT_FOUND", `No fixture captured for ${path}`);
  if (hit.__status !== 200) return ok(hit.body, hit.__status);

  const body = hit.body as { data?: unknown };
  if (Array.isArray(body.data)) {
    return ok({ ...body, data: applyOverlay(path, body.data) });
  }
  return ok(body);
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

export const demoMode = true;
