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

type Role = "student" | "faculty" | "labAssistant" | "superAdmin";

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
  {
    role: "faculty",
    label: "Faculty Mentor — Jyoti Mante",
    description: "Approve mentor requests and watch your students' projects",
  },
  { role: "labAssistant", label: "Lab Assistant", description: "Run the console, manage equipment" },
  {
    role: "superAdmin",
    label: "Super Admin",
    description: "Everything, plus people and reference data",
  },
];

/** The signed-in account for a persona, read from its captured /auth/me. */
function viewerFor(role: Role): { id: string; name: string; email: string } {
  const me = data.responses[role]?.["/auth/me"]?.body as
    | { data?: { user?: { id?: string; name?: string; email?: string } } }
    | undefined;
  const user = me?.data?.user;
  return {
    id: user?.id ?? role,
    name: user?.name ?? "Demo user",
    email: user?.email ?? "demo@mitwpu.edu.in",
  };
}

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
// edits lands here instead, and reads merge the two.
//
// It lives in localStorage rather than in memory, which is what makes the
// interesting demo possible: a student creates a project and requests a mentor
// in one tab, and the faculty tab — same origin, same storage — sees the
// request waiting. TanStack Query refetches on window focus, so simply
// switching tabs is enough to pick the change up.

const STORE_KEY = "ums_demo_store";

type Store = {
  created: Record<string, unknown[]>;
  patched: Record<string, Record<string, unknown>>;
  removed: string[];
};

const empty = (): Store => ({ created: {}, patched: {}, removed: [] });

function load(): Store {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      created: parsed.created ?? {},
      patched: parsed.patched ?? {},
      removed: parsed.removed ?? [],
    };
  } catch {
    // Unreadable or unavailable storage just means a fresh demo.
    return empty();
  }
}

/**
 * Read fresh on every request rather than cached in a module variable.
 *
 * Two tabs run two copies of this file. A cached copy would answer the faculty
 * tab from the state it held when that tab loaded, and the student's new
 * project would never appear.
 */
function store(): Store {
  return load();
}

function save(next: Store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Over quota or blocked: the visit continues, it just will not persist.
  }
}

function mutate(change: (draft: Store) => void) {
  const draft = store();
  change(draft);
  save(draft);
}

export function resetDemoState() {
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing to clear.
  }
}

function overlayFor(path: string): unknown[] {
  return store().created[path] ?? [];
}

function applyOverlay(path: string, rows: unknown[]): unknown[] {
  const { created, patched, removed } = store();
  const merged = [...(created[path] ?? []), ...rows];
  return merged
    .filter((row) => {
      const id = (row as { id?: string }).id;
      return !(id && removed.includes(id));
    })
    .map((row) => {
      const id = (row as { id?: string }).id;
      const patch = id ? patched[id] : undefined;
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
 * Finds a row by id, searching only the collection the path names.
 *
 * The scoping matters. An earlier version searched every collection the bundle
 * held, so /bookings/<some-project-id> cheerfully returned a project; the
 * booking page then formatted a `startsAt` that was not there and the whole
 * route died with "Invalid time value". A detail route must answer with its
 * own kind of record or with nothing.
 */
function findRowById(role: Role, collectionPath: string, id: string): unknown {
  const matches = (row: unknown) => (row as { id?: string }).id === id;

  const overlay = store().created[collectionPath];
  const fromOverlay = overlay?.find(matches);
  if (fromOverlay) return fromOverlay;

  const fromCollection = data.collections[role]?.[collectionPath]?.find(matches);
  if (fromCollection) return fromCollection;

  const rows = (data.responses[role]?.[collectionPath]?.body as { data?: unknown })?.data;
  return Array.isArray(rows) ? rows.find(matches) : undefined;
}

function handleGet(role: Role, path: string, params: URLSearchParams): Response {
  // The query-specific capture first, then the bare path as the fallback for a
  // combination the capture never saw.
  const hit = captured(role, keyFor(path, params)) ?? captured(role, path);

  // 1. A refusal this role actually received. Checked before anything else so
  //    the demo denies exactly where the real system denies, rather than
  //    finding the data by another route.
  if (hit && hit.status !== 200) return ok(hit.body, hit.status);

  // 2. Projects are scoped to the viewer rather than merged blindly, so the
  //    mentor's tab shows the request waiting for them and not every project
  //    in the lab.
  if (path === PROJECTS) {
    const { rows: pageRows, meta } = paginate(projectsFor(role), params);
    return ok(envelope(pageRows, meta));
  }
  if (path.startsWith(`${PROJECTS}/`)) {
    const projectId = path.split("/")[2] ?? "";
    const project = projectsFor(role).find((p) => p.id === projectId);
    if (project) {
      if (path.endsWith("/mentor-requests")) return ok(envelope(project.mentorRequests));
      if (path === `${PROJECTS}/${projectId}`) return ok(envelope(project));
    }
  }

  // 3. A merged, re-paginated collection: /equipment, /admin/faculty, …
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
    const patch = id ? store().patched[id] : undefined;
    if (patch && body.data && typeof body.data === "object") {
      return ok({ ...body, data: { ...(body.data as object), ...patch } });
    }
    return ok(body);
  }

  // 4. A detail route for a row created or edited during this visit.
  const id = trailingId(path);
  if (id) {
    const { patched, removed } = store();
    if (removed.includes(id)) return failure(404, "NOT_FOUND", "That record no longer exists.");
    const row = findRowById(role, collectionPathFor(path), id);
    if (row) {
      const patch = patched[id];
      return ok(envelope(patch ? { ...(row as object), ...patch } : row));
    }
    // A detail route with nothing behind it answers 404, not an empty body.
    // Every one of these screens renders a "not available" state for a 404,
    // but formats dates and names straight off the record it is handed — so
    // an empty stand-in crashes the route instead of degrading it.
    return failure(404, "NOT_FOUND", "That record could not be found.");
  }

  // 5. A collection with nothing captured answers empty rather than 404: a
  //    query that never resolves leaves a screen on "Loading…" forever, while
  //    an empty list reads as "nothing here yet". The warning is for whoever
  //    extends the capture next.
  console.warn(`[mock api] no fixture for ${path} — answering empty`);
  return ok(
    envelope([], { page: 1, limit: 50, total: 0, totalPages: 1, hasNext: false, hasPrev: false }),
  );
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

// ─── projects: the demo's story ────────────────────────────────────────────
//
// A student creates a project naming a mentor; the mentor sees the request in
// their own tab and approves or declines it. Everything lives in the shared
// store, so the two tabs are looking at the same records.

const PROJECTS = "/projects";

type MentorRequest = {
  id: string;
  faculty: { id: string; name: string; email: string };
  status: string;
  reason: string | null;
  requestedAt: string;
  respondedAt: string | null;
};

type DemoProject = {
  id: string;
  labId: string;
  title: string;
  description: string;
  status: string;
  creatorId: string;
  leader: { id: string; name: string; email: string };
  mentor: { id: string; name: string; email: string } | null;
  memberCount: number;
  pendingMemberCount: number;
  declinedMemberCount: number;
  mentorRequestStatus: string | null;
  statusMessage: string;
  viewerRelationship: "LEADER" | "MEMBER" | "MENTOR" | "OVERSIGHT";
  viewerMemberStatus: string | null;
  nextBooking: null;
  createdAt: string;
  updatedAt: string;
  domain: string | null;
  tags: string[];
  rejectionReason: string | null;
  submittedAt: string | null;
  members: Array<Record<string, unknown>>;
  mentorRequests: MentorRequest[];
  equipment: Array<{ id: string; name: string; category: string; status: string }>;
  consumables: Array<Record<string, unknown>>;
  // The detail screen reads `bookings.length` unguarded, so this is never
  // optional — omitting it took the whole route down.
  bookings: Array<{ id: string; status: string; startsAt: string; endsAt: string; canView: boolean }>;
};

function storedProjects(): DemoProject[] {
  return (store().created[PROJECTS] ?? []) as DemoProject[];
}

function putProject(next: DemoProject) {
  mutate((s) => {
    const rows = (s.created[PROJECTS] ?? []) as DemoProject[];
    const at = rows.findIndex((p) => p.id === next.id);
    if (at === -1) rows.unshift(next);
    else rows[at] = next;
    s.created[PROJECTS] = rows;
  });
}

/** Looks a person up in the faculty directory. */
function facultyById(id: string) {
  for (const role of Object.keys(data.collections) as Role[]) {
    const rows = data.collections[role]?.["/users/search/faculty-mentors"] ?? [];
    const hit = rows.find((row) => (row as { id?: string }).id === id) as
      | { id: string; name: string; email: string }
      | undefined;
    if (hit) return { id: hit.id, name: hit.name, email: hit.email };
  }
  return { id, name: "Faculty mentor", email: "" };
}

/**
 * Expands the material plan the form posts — ids and quantities — into the
 * named records the project screens render.
 */
function consumablesFrom(entries: Array<Record<string, unknown>>) {
  const catalogue = (
    (data.responses.student?.[`/reference-data/project-resources?labId=${data.labId}`]?.body as {
      data?: { consumables?: unknown[] };
    })?.data?.consumables ?? []
  ) as Array<{ id: string; name: string; unit: string; category?: { name?: string } }>;

  return entries.map((entry) => {
    const id = String(entry["consumableId"] ?? entry["id"] ?? "");
    const match = catalogue.find((c) => c.id === id);
    return {
      id,
      name: match?.name ?? "Material",
      category: match?.category?.name ?? "Materials",
      unit: match?.unit ?? "piece",
      quantity: Number(entry["quantity"] ?? 1),
      variant: entry["variant"] == null ? null : String(entry["variant"]),
    };
  });
}

/** The bookings held against a project, for its detail screen. */
function bookingsForProject(projectId: string) {
  return ((store().created[BOOKINGS] ?? []) as Array<Record<string, unknown>>)
    .filter((b) => b["projectId"] === projectId)
    .map((b) => ({
      id: String(b["id"]),
      status: String(b["status"]),
      startsAt: String(b["startsAt"]),
      endsAt: String(b["endsAt"]),
      canView: true,
    }));
}

function equipmentById(ids: string[]) {
  const rows = data.collections.superAdmin?.["/equipment"] ?? [];
  return ids
    .map((id) => rows.find((row) => (row as { id?: string }).id === id))
    .filter(Boolean)
    .map((row) => {
      const e = row as { id: string; name: string; category?: { name?: string }; status?: string };
      return {
        id: e.id,
        name: e.name,
        category: e.category?.name ?? "Equipment",
        status: e.status ?? "AVAILABLE",
      };
    });
}

/** What this viewer is to this project, or null when they cannot see it. */
function relationshipTo(project: DemoProject, viewerId: string, role: Role) {
  if (project.creatorId === viewerId) return "LEADER" as const;
  if (project.mentorRequests.some((r) => r.faculty.id === viewerId)) return "MENTOR" as const;
  if (role === "labAssistant" || role === "superAdmin") return "OVERSIGHT" as const;
  return null;
}

/** The stored projects this viewer may see, stamped with their relationship. */
function projectsFor(role: Role): DemoProject[] {
  const viewer = viewerFor(role);
  const visible: DemoProject[] = [];
  for (const project of storedProjects()) {
    const relationship = relationshipTo(project, viewer.id, role);
    if (!relationship) continue;
    // Bookings are joined on read rather than written into the project, so a
    // slot booked after the project was created still shows up on it.
    visible.push({
      ...project,
      viewerRelationship: relationship,
      bookings: bookingsForProject(project.id),
    });
  }
  return visible;
}

function statusMessageFor(status: string, mentorStatus: string | null) {
  if (status === "VERIFIED") return "Project verified";
  if (mentorStatus === "REJECTED") return "Mentor declined — choose another mentor";
  return "Waiting for your mentor to approve this project";
}

function handleProjectWrite(
  method: string,
  role: Role,
  path: string,
  body: Record<string, unknown>,
): Response | null {
  if (method !== "POST" || !path.startsWith("/projects")) return null;

  const viewer = viewerFor(role);
  const now = new Date().toISOString();
  const segments = path.split("/").filter(Boolean);
  const id = segments[1];
  const action = segments[2];

  // POST /projects — create
  if (!id) {
    const mentorId = String(body["mentorId"] ?? "");
    const faculty = facultyById(mentorId);
    const emails = Array.isArray(body["teamMemberEmails"])
      ? (body["teamMemberEmails"] as string[])
      : [];
    const equipmentIds = Array.isArray(body["equipmentIds"])
      ? (body["equipmentIds"] as string[])
      : [];

    const project: DemoProject = {
      id: uuid(),
      labId: String(body["labId"] ?? data.labId),
      title: String(body["title"] ?? "Untitled project"),
      description: String(body["description"] ?? ""),
      status: "PENDING_MENTOR",
      creatorId: viewer.id,
      leader: viewer,
      mentor: null,
      memberCount: 1,
      pendingMemberCount: emails.length,
      declinedMemberCount: 0,
      mentorRequestStatus: "PENDING",
      statusMessage: statusMessageFor("PENDING_MENTOR", "PENDING"),
      viewerRelationship: "LEADER",
      viewerMemberStatus: "ACCEPTED",
      nextBooking: null,
      createdAt: now,
      updatedAt: now,
      domain: null,
      tags: [],
      rejectionReason: null,
      submittedAt: now,
      members: [
        {
          id: uuid(),
          userId: viewer.id,
          email: viewer.email,
          role: "LEADER",
          status: "ACCEPTED",
          name: viewer.name,
        },
        ...emails.map((email) => ({
          id: uuid(),
          userId: null,
          email,
          role: "MEMBER",
          status: "INVITED",
          name: email.split("@")[0],
        })),
      ],
      mentorRequests: [
        {
          id: uuid(),
          faculty,
          status: "PENDING",
          reason: null,
          requestedAt: now,
          respondedAt: null,
        },
      ],
      equipment: equipmentById(equipmentIds),
      consumables: consumablesFrom(
        Array.isArray(body["consumables"])
          ? (body["consumables"] as Array<Record<string, unknown>>)
          : [],
      ),
      bookings: [],
    };

    putProject(project);
    return ok(envelope(project), 201);
  }

  const project = storedProjects().find((p) => p.id === id);
  if (!project) return null;

  // POST /projects/:id/mentor-requests — ask a different mentor
  if (action === "mentor-requests") {
    const faculty = facultyById(String(body["facultyId"] ?? ""));
    const next: DemoProject = {
      ...project,
      status: "PENDING_MENTOR",
      mentor: null,
      mentorRequestStatus: "PENDING",
      statusMessage: statusMessageFor("PENDING_MENTOR", "PENDING"),
      rejectionReason: null,
      updatedAt: now,
      mentorRequests: [
        { id: uuid(), faculty, status: "PENDING", reason: null, requestedAt: now, respondedAt: null },
        ...project.mentorRequests.map((r) =>
          r.status === "PENDING" ? { ...r, status: "SUPERSEDED", respondedAt: now } : r,
        ),
      ],
    };
    putProject(next);
    return ok(envelope(next));
  }

  // POST /projects/:id/mentor-decision — the mentor answers
  if (action === "mentor-decision") {
    const decision = String(body["decision"] ?? "APPROVED");
    const reason = body["reason"] == null ? null : String(body["reason"]);
    const approved = decision === "APPROVED";
    const next: DemoProject = {
      ...project,
      status: approved ? "VERIFIED" : "MENTOR_REJECTED",
      mentor: approved ? project.mentorRequests[0]?.faculty ?? null : null,
      mentorRequestStatus: decision,
      rejectionReason: approved ? null : reason,
      statusMessage: statusMessageFor(approved ? "VERIFIED" : "MENTOR_REJECTED", decision),
      updatedAt: now,
      mentorRequests: project.mentorRequests.map((r, index) =>
        index === 0 ? { ...r, status: decision, reason, respondedAt: now } : r,
      ),
    };
    putProject(next);
    return ok(envelope(next));
  }

  if (action === "archive") {
    const next = { ...project, status: "ARCHIVED", updatedAt: now };
    putProject(next);
    return ok(envelope(next));
  }

  return null;
}

// ─── bookings ──────────────────────────────────────────────────────────────

const BOOKINGS = "/bookings";

/** Finds a slot, and the lab it belongs to, in the captured availability. */
function slotById(role: Role, slotId: string) {
  for (const [key, entry] of Object.entries(data.responses[role] ?? {})) {
    if (!key.includes("/availability?")) continue;
    const day = entry.body as {
      data?: { lab?: { id?: string; name?: string; timeZone?: string }; slots?: unknown[] };
    };
    const slot = day.data?.slots?.find((s) => (s as { id?: string }).id === slotId) as
      | { id: string; startsAt: string; endsAt: string }
      | undefined;
    if (slot) return { slot, lab: day.data?.lab };
  }
  return null;
}

/**
 * Builds a booking the detail screen can actually render.
 *
 * The generic write handling stored whatever the form posted, which is a slot
 * id and a list of participants — no `startsAt`, no `endsAt`. Opening such a
 * booking formatted an absent date and took the whole route down with
 * "Invalid time value", so the record is assembled in full here.
 */
function handleBookingWrite(
  method: string,
  role: Role,
  path: string,
  body: Record<string, unknown>,
): Response | null {
  if (method !== "POST" || !path.startsWith(BOOKINGS)) return null;

  const viewer = viewerFor(role);
  const now = new Date().toISOString();
  const segments = path.split("/").filter(Boolean);
  const id = segments[1];
  const action = segments[2];

  if (!id) {
    const slotId = String(body["labSlotId"] ?? "");
    const found = slotById(role, slotId);
    if (!found) return null;

    const projectId = String(body["projectId"] ?? "");
    const project = storedProjects().find((p) => p.id === projectId);
    const equipmentIds = Array.isArray(body["equipmentIds"])
      ? (body["equipmentIds"] as string[])
      : [];
    const participantIds = Array.isArray(body["participantIds"])
      ? (body["participantIds"] as string[])
      : [viewer.id];

    const booking = {
      id: uuid(),
      labId: found.lab?.id ?? data.labId,
      labSlotId: slotId,
      projectId,
      createdById: viewer.id,
      projectTitle: project?.title ?? "Project",
      labName: found.lab?.name ?? "MakerSpace",
      timeZone: found.lab?.timeZone ?? "Asia/Kolkata",
      attendeeCount: participantIds.length,
      status: "CONFIRMED",
      statusLabel: "Confirmed",
      notes: body["notes"] == null ? null : String(body["notes"]),
      cancellationReason: null,
      cancellationSource: null,
      cancelledAt: null,
      startsAt: found.slot.startsAt,
      endsAt: found.slot.endsAt,
      participants: participantIds.map((userId) => ({
        userId,
        name: userId === viewer.id ? viewer.name : "Team member",
        email: userId === viewer.id ? viewer.email : undefined,
      })),
      equipment: equipmentById(equipmentIds).map((e) => ({
        equipmentId: e.id,
        name: e.name,
        quantity: 1,
      })),
      canCancel: true,
      canComplete: false,
      cancellationDeadline: found.slot.startsAt,
      createdAt: now,
      updatedAt: now,
    };

    mutate((s) => {
      s.created[BOOKINGS] = [booking, ...(s.created[BOOKINGS] ?? [])];
    });
    return ok(envelope({ booking, replayed: false }), 201);
  }

  const existing = (store().created[BOOKINGS] ?? []).find(
    (b) => (b as { id?: string }).id === id,
  ) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const patch =
    action === "cancel"
      ? {
          status: "CANCELLED",
          statusLabel: "Cancelled",
          cancelledAt: now,
          cancellationReason: body["reason"] == null ? null : String(body["reason"]),
          cancellationSource: role === "student" ? "STUDENT" : "LAB_ASSISTANT",
          canCancel: false,
          canComplete: false,
        }
      : action === "complete"
        ? { status: "COMPLETED", statusLabel: "Completed", canCancel: false, canComplete: false }
        : null;
  if (!patch) return null;

  const next = { ...existing, ...patch, updatedAt: now };
  mutate((s) => {
    s.created[BOOKINGS] = (s.created[BOOKINGS] ?? []).map((b) =>
      (b as { id?: string }).id === id ? next : b,
    );
  });
  return ok(envelope(next));
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

  // The project lifecycle is written out properly rather than left to the
  // generic handling below, because it is the demo's whole story: a student
  // creates a project and names a mentor, and the mentor approves it from
  // another tab.
  const project = handleProjectWrite(method, role, path, body);
  if (project) return project;

  const booking = handleBookingWrite(method, role, path, body);
  if (booking) return booking;

  if (method === "DELETE") {
    if (id) mutate((s) => void s.removed.push(id));
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
    mutate((s) => {
      s.created[base] = [row, ...(s.created[base] ?? [])];
    });
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
    mutate((s) => {
      s.patched[id] = { ...(s.patched[id] ?? {}), ...patch };
    });
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
