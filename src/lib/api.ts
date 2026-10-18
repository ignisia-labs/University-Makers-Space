/**
 * api.ts — Typed fetch wrapper for the UMS Express backend.
 *
 * All requests go to /api/v1/... which Vite dev-server proxies to
 * http://127.0.0.1:4000 during development. In production the same
 * path is served by the Express backend directly (or via a reverse proxy).
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *
 *   // GET
 *   const { data } = await api.get("/auth/me");
 *
 *   // POST
 *   const { data } = await api.post("/auth/google", { credential, csrfToken });
 *
 *   // With typed response
 *   const res = await api.get<{ user: User; permissions: string[] }>("/auth/me");
 */

/**
 * Where the API lives.
 *
 * In development this stays relative: Vite proxies `/api` to the Express server
 * on port 4000, so the browser sees one origin and cookies behave simply.
 *
 * In production the two halves are deployed separately — the app on a static
 * host, the API on its own service — so `VITE_API_BASE_URL` points at the API's
 * public URL. It is read at build time, which means changing it requires a
 * rebuild, not just a restart.
 *
 * A trailing slash is stripped so `https://api.example.com/` and
 * `https://api.example.com` behave identically; getting that wrong produces
 * `//api/v1/...` and a 404 that looks like a routing bug.
 */
const CONFIGURED_API = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.trim();
const BASE_URL = CONFIGURED_API ? `${CONFIGURED_API.replace(/\/+$/, "")}/api/v1` : "/api/v1";
const SESSION_HINT_KEY = "ums_session_present";

// ─── helpers ───────────────────────────────────────────────────────────────

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function storeAccessToken(token: string) {
  accessToken = token;
  try {
    window.localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // The token remains memory-only when storage is unavailable.
  }
}

export function clearAccessToken() {
  accessToken = null;
  try {
    window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

// ─── response type ─────────────────────────────────────────────────────────

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

/**
 * A message worth showing a person.
 *
 * Validation failures arrive as a generic "Invalid request data" plus a list of
 * field-level reasons. Showing only the envelope tells the user nothing about
 * what to change, so the specific reasons are folded in.
 */
export function readableError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  const reasons = error.details
    .map((detail) =>
      typeof detail === "object" && detail !== null && "message" in detail
        ? String((detail as { message: unknown }).message)
        : null,
    )
    .filter((reason): reason is string => Boolean(reason));
  if (!reasons.length) return error.message;
  // De-duplicate: the same rule can fail on several fields at once.
  return [...new Set(reasons)].join(" · ");
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── core fetch ────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestInit = {},
  retryAfterRefresh = true,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include", // send cookies (refresh token)
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...options,
  });

  // 204 No Content
  if (response.status === 204) {
    return { success: true, message: "OK", data: undefined as unknown as T };
  }

  const json = (await response.json().catch(() => ({
    success: false,
    message: response.statusText || "An unexpected error occurred",
  }))) as ApiResponse<T> & {
    error?: { code: string; details?: unknown[] };
  };

  if (!response.ok) {
    if (
      response.status === 401 &&
      retryAfterRefresh &&
      path !== "/auth/refresh" &&
      path !== "/auth/google"
    ) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) return request<T>(method, path, body, options, false);
    }
    throw new ApiError(
      response.status,
      json.error?.code ?? "UNKNOWN_ERROR",
      json.message ?? "An unexpected error occurred",
      json.error?.details ?? [],
    );
  }

  return json;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = request<{ accessToken: string }>("POST", "/auth/refresh", undefined, {}, false)
      .then(({ data }) => {
        storeAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        clearAccessToken();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * A raw fetch carrying the in-memory access token, transparently retrying once
 * after a refresh. Used for non-JSON responses such as CSV downloads, which
 * cannot go through `request()`.
 */
async function authorizedFetch(
  path: string,
  retryAfterRefresh = true,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    // Content-Type is deliberately not set for FormData: the browser has to add
    // it itself so it can include the multipart boundary.
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (response.status === 401 && retryAfterRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return authorizedFetch(path, false, init);
  }
  return response;
}

function filenameFrom(response: Response) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

export async function restoreAccessToken() {
  try {
    if (window.localStorage.getItem(SESSION_HINT_KEY) !== "1") return null;
  } catch {
    return null;
  }
  return refreshAccessToken();
}

// ─── public API ────────────────────────────────────────────────────────────

export const api = {
  get: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>("GET", path, undefined, options),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>("POST", path, body, options),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>("PATCH", path, body, options),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>("PUT", path, body, options),

  delete: <T = unknown>(path: string, options?: RequestInit) =>
    request<T>("DELETE", path, undefined, options),
};

// ─── convenience re-exports for common endpoints ───────────────────────────

export const authApi = {
  /** Returns Google Client ID and hosted domain for GSI button */
  googleConfig: () => api.get<{ clientId: string; hostedDomain: string }>("/auth/google/config"),

  /** Get a CSRF token before calling googleSignIn */
  loginCsrf: () => api.get<{ csrfToken: string }>("/auth/google/csrf"),

  /** Exchange Google credential for access + refresh tokens */
  googleSignIn: (credential: string, csrfToken: string) =>
    api.post<{
      user: UserDto;
      permissions: string[];
      accessToken: string;
      next: "dashboard" | "onboarding";
    }>("/auth/google", { credential, csrfToken }),

  /** Rotate the access token using the httpOnly refresh cookie */
  refresh: () => api.post<{ accessToken: string }>("/auth/refresh"),

  /** Revoke the current session */
  logout: () => api.post("/auth/logout"),

  /** Get the currently authenticated user */
  me: () => api.get<{ user: UserDto; permissions: string[] }>("/auth/me"),

  /** Complete student onboarding profile */
  onboarding: (data: OnboardingInput) => api.post("/auth/onboarding", data),

  /** Get PRN validation policy */
  studentProfileConfig: () =>
    api.get<{ prn: { pattern: string; hint: string; maxLength: number } }>(
      "/auth/student-profile/config",
    ),
};

export const referenceApi = {
  departments: () => api.get<Department[]>("/reference-data/departments"),
  programmes: (departmentId?: string) =>
    api.get<Programme[]>(
      `/reference-data/programmes${departmentId ? `?departmentId=${departmentId}` : ""}`,
    ),
  academicYears: () => api.get<AcademicYear[]>("/reference-data/academic-years"),
  labs: () => api.get<Lab[]>("/reference-data/labs"),
  equipmentCategories: (labId?: string) =>
    api.get<EquipmentCategory[]>(
      `/reference-data/equipment-categories${labId ? `?labId=${labId}` : ""}`,
    ),
  projectResources: (labId: string) =>
    api.get<ProjectResources>(`/reference-data/project-resources?labId=${labId}`),
};

export type DomainEquipment = {
  id: string;
  name: string;
  description: string | null;
  status: EquipmentStatusValue;
  imageUrl: string | null;
  specs: string[];
  domainId: string | null;
  totalQuantity: number;
  availableQuantity: number;
  category: { id: string; name: string };
};

export type DomainConsumable = {
  id: string;
  name: string;
  unit: string;
  description: string | null;
  variants: string[];
  maxPerProject: number | null;
  stockQuantity: number;
  lowStockThreshold: number | null;
  domainId: string | null;
  category: { id: string; name: string };
};

export type ResourceDomain = {
  id: string;
  name: string;
  tagline: string | null;
  imageUrl: string | null;
  sortOrder: number;
  equipment: DomainEquipment[];
  consumables: DomainConsumable[];
};

export type ProjectResources = {
  domains: ResourceDomain[];
  equipment: DomainEquipment[];
  consumables: DomainConsumable[];
};

export const adminDomainsApi = {
  list: (labId: string) => api.get<AdminDomain[]>(`/admin/reference/domains?labId=${labId}`),
  create: (data: {
    labId: string;
    name: string;
    tagline?: string | null;
    imageUrl?: string | null;
  }) => api.post<AdminDomain>("/admin/reference/domains", data),
  update: (
    id: string,
    data: {
      name?: string;
      tagline?: string | null;
      imageUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) => api.patch<AdminDomain>(`/admin/reference/domains/${id}`, data),
  delete: (id: string) => api.delete(`/admin/reference/domains/${id}`),
};

export type AdminDomain = {
  id: string;
  labId: string;
  name: string;
  tagline: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { equipment: number; consumables: number };
};

export const projectsApi = {
  list: (params?: Record<string, string>) =>
    api.get<ProjectSummary[]>(`/projects${toQuery(params)}`),
  get: (id: string) => api.get<ProjectDetail>(`/projects/${id}`),
  create: (data: CreateProjectInput) => api.post<ProjectDetail>("/projects", data),
  update: (id: string, data: UpdateProjectInput) =>
    api.patch<ProjectDetail>(`/projects/${id}`, data),
  archive: (id: string) => api.post<ProjectDetail>(`/projects/${id}/archive`, {}),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, email: string) =>
    api.post<ProjectDetail>(`/projects/${id}/members`, { email }),
  removeMember: (id: string, memberId: string) =>
    api.delete<ProjectDetail>(`/projects/${id}/members/${memberId}`),
  respondToInvitation: (id: string, decision: "ACCEPTED" | "DECLINED") =>
    api.post<ProjectDetail>(`/projects/${id}/invitations/respond`, { decision }),
  requestMentor: (id: string, facultyId: string) =>
    api.post<ProjectDetail>(`/projects/${id}/mentor-requests`, { facultyId }),
  decideMentor: (id: string, decision: "APPROVED" | "REJECTED", reason?: string) =>
    api.post<ProjectDetail>(`/projects/${id}/mentor-decision`, {
      decision,
      reason,
    }),
};

export const bookingsApi = {
  list: (params?: Record<string, string>) => api.get<BookingDto[]>(`/bookings${toQuery(params)}`),
  get: (id: string) => api.get<BookingDto>(`/bookings/${id}`),
  create: (data: CreateBookingInput) => api.post<BookingMutationResult>("/bookings", data),
  cancel: (id: string, data: CancelBookingInput) =>
    api.post<BookingDto>(`/bookings/${id}/cancel`, data),
  complete: (id: string) => api.post<BookingDto>(`/bookings/${id}/complete`, {}),
  updateStatus: (id: string, status: BookingStatus, notes?: string | null) =>
    api.patch<BookingDto>(`/bookings/${id}/status`, { status, notes }),
};

export type ConsumableAllowance = {
  consumableId: string;
  name: string;
  unit: string;
  variant: string | null;
  variants: string[];
  approvedQuantity: number;
  pendingQuantity: number;
  issuedQuantity: number;
  remainingQuantity: number;
  stockQuantity: number;
  claimable: boolean;
};

export type ConsumableClaimDto = {
  id: string;
  projectId: string;
  consumableId: string;
  bookingId: string | null;
  quantity: number;
  variant: string | null;
  status: "PENDING" | "ISSUED" | "REJECTED" | "CANCELLED";
  statusLabel: string;
  note: string | null;
  decisionReason: string | null;
  name: string;
  unit: string;
  decidedAt: string | null;
  createdAt: string;
  projectTitle?: string;
  claimedByName?: string;
};

export const consumableClaimsApi = {
  allowance: (projectId: string) =>
    api.get<ConsumableAllowance[]>(`/consumable-claims/allowance/${projectId}`),
  list: (params?: Record<string, string>) =>
    api.get<ConsumableClaimDto[]>(`/consumable-claims${toQuery(params)}`),
  create: (data: {
    projectId: string;
    consumableId: string;
    quantity: number;
    variant?: string | null;
    bookingId?: string | null;
    note?: string | null;
    idempotencyKey: string;
  }) => api.post<ConsumableClaimDto>("/consumable-claims", data),
  cancel: (id: string) => api.post<ConsumableClaimDto>(`/consumable-claims/${id}/cancel`, {}),
  decide: (id: string, decision: "ISSUED" | "REJECTED", reason?: string | null) =>
    api.post<ConsumableClaimDto>(`/consumable-claims/${id}/decision`, { decision, reason }),
};

export const labsApi = {
  configuration: (labId: string) => api.get<LabConfiguration>(`/labs/${labId}/configuration`),
  updateConfiguration: (labId: string, data: UpdateLabConfigurationInput) =>
    api.put<LabConfiguration>(`/labs/${labId}/configuration`, data),
  upsertDateException: (labId: string, data: DateExceptionInput) =>
    api.put<LabDateException>(`/labs/${labId}/date-exceptions`, data),
  deleteDateException: (labId: string, exceptionId: string) =>
    api.delete(`/labs/${labId}/date-exceptions/${exceptionId}`),
  regenerateSlots: (labId: string, fromDate?: string, toDate?: string) =>
    api.post<SlotGenerationResult>(`/labs/${labId}/slots/regenerate`, {
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    }),
  availabilityDates: (labId: string, projectId?: string, participantCount = 1) =>
    api.get<AvailabilityDates>(
      `/labs/${labId}/availability/dates${toQuery({
        ...(projectId ? { projectId } : {}),
        participantCount: String(participantCount),
      })}`,
    ),
  dailyAvailability: (labId: string, date: string, projectId?: string, participantCount = 1) =>
    api.get<DailyAvailability>(
      `/labs/${labId}/availability${toQuery({
        date,
        ...(projectId ? { projectId } : {}),
        participantCount: String(participantCount),
      })}`,
    ),
};

export type EquipmentStatusValue =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "IN_USE"
  | "UNAVAILABLE"
  | "UNDER_MAINTENANCE"
  | "DAMAGED"
  | "OUT_OF_SERVICE";

export type EquipmentDto = {
  id: string;
  labId: string;
  categoryId: string;
  domainId: string | null;
  category?: string;
  name: string;
  description: string | null;
  status: EquipmentStatusValue;
  imageUrl: string | null;
  totalQuantity: number;
  availableQuantity: number;
  specs: string[];
  visible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateEquipmentInput = {
  name: string;
  description: string;
  labId: string;
  categoryId: string;
  domainId?: string | null;
  status?: EquipmentStatusValue;
  totalQuantity?: number;
  availableQuantity?: number;
  specs?: string[];
  visible?: boolean;
  /** Photo URL returned by the upload endpoint; never a client-composed path. */
  imageUrl?: string | null;
};

export const equipmentApi = {
  list: (params?: Record<string, string>) =>
    api.get<EquipmentDto[]>(`/equipment${toQuery(params)}`),
  get: (id: string) => api.get<EquipmentDto>(`/equipment/${id}`),
  create: (data: CreateEquipmentInput) => api.post<EquipmentDto>("/equipment", data),
  update: (id: string, data: Partial<CreateEquipmentInput>) =>
    api.patch<EquipmentDto>(`/equipment/${id}`, data),
  updateAvailability: (
    id: string,
    data: {
      status?: EquipmentStatusValue;
      availableQuantity?: number;
      /** Photo URL from the upload endpoint; operational staff may set this. */
      imageUrl?: string | null;
      reason: string;
    },
  ) => api.patch<EquipmentDto>(`/equipment/${id}/availability`, data),
  delete: (id: string) => api.delete(`/equipment/${id}`),
};

export type ProvisioningDto = {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  isActive: boolean;
  claimedById: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const governanceApi = {
  users: (params?: Record<string, string>) => api.get<UserDto[]>(`/users${toQuery(params)}`),
  setActive: (id: string, isActive: boolean) => api.patch<UserDto>(`/users/${id}`, { isActive }),
  setRoles: (id: string, roles: string[]) => api.patch<UserDto>(`/users/${id}/roles`, { roles }),
  provisioning: (params?: Record<string, string>) =>
    api.get<ProvisioningDto[]>(`/users/provisioning${toQuery(params)}`),
  provision: (data: { email: string; name?: string; roles: string[]; isActive?: boolean }) =>
    api.post<ProvisioningDto>("/users/provisioning", data),
  updateProvisioning: (
    id: string,
    data: { name?: string | null; roles?: string[]; isActive?: boolean },
  ) => api.patch<ProvisioningDto>(`/users/provisioning/${id}`, data),
  /** Retires an account and releases its address for reuse. */
  remove: (id: string) => api.delete(`/users/${id}`),

  divisions: () => api.get<DivisionDto[]>("/admin/divisions"),
  createDivision: (data: { name: string }) => api.post<DivisionDto>("/admin/divisions", data),
  updateDivision: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<DivisionDto>(`/admin/divisions/${id}`, data),
  deleteDivision: (id: string) =>
    api.delete<{ detachedDepartments: number; detachedFaculty: number }>(`/admin/divisions/${id}`),

  faculty: (params?: Record<string, string>) =>
    api.get<FacultyDto[]>(`/admin/faculty${toQuery(params)}`),
  addFaculty: (data: {
    prefix?: string | null;
    name: string;
    email: string;
    divisionId?: string | null;
  }) => api.post<FacultyDto>("/admin/faculty", data),
  updateFaculty: (
    id: string,
    data: { prefix?: string | null; name?: string; divisionId?: string | null; isActive?: boolean },
  ) => api.patch<FacultyDto>(`/admin/faculty/${id}`, data),
  removeFaculty: (id: string) => api.delete<{ accountDeleted: boolean }>(`/admin/faculty/${id}`),
  /**
   * Uploads the spreadsheet itself. It goes as multipart rather than parsed
   * JSON so validation lives in one place on the server, and the browser never
   * has to ship a spreadsheet library.
   */
  importFaculty: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await authorizedFetch("/admin/faculty/import", true, {
      method: "POST",
      body,
    });
    const json = (await response.json().catch(() => ({}))) as {
      message?: string;
      data?: FacultyImportOutcome;
      error?: { code?: string };
    };
    if (!response.ok) {
      throw new ApiError(
        response.status,
        json.error?.code ?? "IMPORT_FAILED",
        json.message ?? "The workbook could not be imported.",
      );
    }
    return json.data as FacultyImportOutcome;
  },
  /**
   * Clears the Google identity bound to an account so the next sign-in re-links
   * it. The recovery path for "This email is linked to another identity".
   */
  unlinkGoogle: (id: string) => api.post<UserDto>(`/users/${id}/unlink-google`),
};

export const eventsApi = {
  list: (params?: Record<string, string>) => api.get(`/events${toQuery(params)}`),
  get: (id: string) => api.get(`/events/${id}`),
  create: (data: unknown) => api.post("/events", data),
  update: (id: string, data: unknown) => api.patch(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
  register: (id: string) => api.post(`/events/${id}/registrations`),
};

export const notificationsApi = {
  list: (params?: Record<string, string>) =>
    api.get<NotificationDto[]>(`/notifications${toQuery(params)}`),
  markRead: (id: string, isRead: boolean) =>
    api.patch<NotificationDto>(`/notifications/${id}/read`, { isRead }),
};

export const usersApi = {
  list: (params?: Record<string, string>) => api.get(`/users${toQuery(params)}`),
  get: (id: string) => api.get<UserDto>(`/users/${id}`),
  update: (id: string, data: unknown) => api.patch(`/users/${id}`, data),
  updateRoles: (id: string, roles: string[]) => api.patch(`/users/${id}/roles`, { roles }),
  delete: (id: string) => api.delete(`/users/${id}`),
  searchStudents: (search: string, page = 1) =>
    api.get<StudentDirectoryResult[]>(
      `/users/search/students?search=${encodeURIComponent(search)}&page=${page}&limit=10`,
    ),
  // A blank term is meaningful here: it lists the whole mentor directory
  // alphabetically so a student can browse rather than guess a name.
  searchFacultyMentors: (search = "", page = 1, limit = 100) =>
    api.get<FacultyDirectoryResult[]>(
      `/users/search/faculty-mentors?${search.trim() ? `search=${encodeURIComponent(search.trim())}&` : ""}page=${page}&limit=${limit}`,
    ),
  listProvisioning: (params?: Record<string, string>) =>
    api.get(`/users/provisioning${toQuery(params)}`),
  createProvisioning: (data: unknown) => api.post("/users/provisioning", data),
  updateProvisioning: (id: string, data: unknown) => api.patch(`/users/provisioning/${id}`, data),
  updateOwnProfile: (data: unknown) => api.patch("/users/me/student-profile", data),
};

export const uploadsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE_URL}/uploads`, {
      method: "POST",
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new ApiError(res.status, json.error?.code ?? "UPLOAD_ERROR", json.message);
      return json as ApiResponse<{ id: string; url: string; mimeType: string; bytes: number }>;
    });
  },
  delete: (id: string) => api.delete(`/uploads/${id}`),
};

// ─── helpers ───────────────────────────────────────────────────────────────

function toQuery(params?: Record<string, string>): string {
  if (!params) return "";
  const q = new URLSearchParams(params).toString();
  return q ? `?${q}` : "";
}

// ─── DTO types (lightweight mirrors of backend serializers) ─────────────────

export type UserDto = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  /** Whether a Google identity is bound to this account. */
  googleLinked?: boolean;
  avatarUrl?: string | null;
  profileComplete: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  studentProfile?: {
    prn: string;
    academicYear: number;
    division?: string | null;
    phone?: string | null;
    department?: { id: string; code: string; name: string };
    programme?: { id: string; code: string; name: string; departmentId: string };
  } | null;
};

export type Department = { id: string; code: string; name: string };
export type Programme = { id: string; departmentId: string; code: string; name: string };
export type AcademicYear = { id: string; value: number; label: string };
export type Lab = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  timeZone: string;
  slotDurationMinutes: number;
  bookingCapacity: number;
  quickVisitCapacity: number;
};

export type WeeklyLabSchedule = {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

export type LabDateException = {
  id: string;
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reason: string;
  updatedAt: string;
};

export type LabConfiguration = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  timeZone: string;
  slotDurationMinutes: number;
  bookingCapacity: number;
  quickVisitsEnabled: boolean;
  quickVisitCapacity: number;
  bookingHorizonDays: number;
  cancellationWindowHours: number;
  maxFutureBookingsPerProject: number | null;
  projectVerificationRequired: boolean;
  teamLeaderAttendanceRequired: boolean;
  configurationVersion: number;
  updatedAt: string;
  bookingWindow: { fromDate: string; toDate: string };
  weeklySchedule: WeeklyLabSchedule[];
  dateExceptions: LabDateException[];
};

export type UpdateLabConfigurationInput = Omit<
  LabConfiguration,
  "id" | "code" | "updatedAt" | "bookingWindow" | "dateExceptions"
>;

export type DateExceptionInput = {
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reason: string;
};

export type SlotGenerationResult = {
  fromDate: string;
  toDate: string;
  created: number;
  updated: number;
  closed: number;
  deleted: number;
};

export type AvailabilityDate = {
  date: string;
  label: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  slotCount: number;
  canFit: boolean;
  reason: string | null;
  source: "WEEKLY_SCHEDULE" | "DATE_EXCEPTION";
};

export type AvailabilityDates = {
  lab: LabAvailabilitySummary;
  fromDate: string;
  toDate: string;
  participantCount: number;
  dates: AvailabilityDate[];
};

export type LabAvailabilitySummary = {
  id: string;
  code: string;
  name: string;
  timeZone: string;
  slotDurationMinutes: number;
  bookingCapacity: number;
  bookingHorizonDays: number;
  teamLeaderAttendanceRequired: boolean;
};

export type DailyAvailability = {
  lab: LabAvailabilitySummary;
  date: string;
  label: string;
  participantCount: number;
  policy: {
    isOpen: boolean;
    opensAt: string | null;
    closesAt: string | null;
    source: "WEEKLY_SCHEDULE" | "DATE_EXCEPTION";
    reason: string | null;
  };
  project: {
    id: string;
    title: string;
    status: string;
    eligibleForBooking: boolean;
    eligibilityMessage: string;
  } | null;
  equipmentAdvisory: Array<{
    equipmentId: string;
    name: string;
    requiredQuantity: number;
    availableQuantity: number;
    status: string;
    available: boolean;
  }>;
  equipmentAdvisoryMessage: string;
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    startTime: string;
    endTime: string;
    bookingCapacity: number;
    placesUsed: number;
    remainingCapacity: number;
    canFit: boolean;
    quickVisitCapacity: number;
    quickVisitSeatsLeft: number;
    status: string;
    /** The project's machines, as they stand *in this slot*. */
    equipment: SlotEquipment[];
    equipmentAvailable: number;
    equipmentTotal: number;
  }>;
};

export type SlotEquipment = {
  equipmentId: string;
  name: string;
  requiredQuantity: number;
  totalQuantity: number;
  /** Units held by other teams booked into this same slot. */
  claimedQuantity: number;
  remainingQuantity: number;
  status: string;
  available: boolean;
};
export type EquipmentCategory = { id: string; labId: string; name: string };
export type EquipmentSummary = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  category: { id: string; name: string };
};
export type ConsumableSummary = {
  id: string;
  name: string;
  unit: string;
  description?: string | null;
  category: { id: string; name: string };
};

export type ProjectSummary = {
  id: string;
  labId: string;
  title: string;
  description: string;
  status: string;
  creatorId: string;
  leader: { id: string; name: string; email: string };
  mentor?: { id: string; name: string; email: string } | null;
  memberCount: number;
  pendingMemberCount: number;
  declinedMemberCount: number;
  mentorRequestStatus?: string | null;
  statusMessage: string;
  viewerRelationship: "LEADER" | "MEMBER" | "MENTOR" | "OVERSIGHT";
  viewerMemberStatus?: string | null;
  nextBooking?: { id: string; startsAt: string; endsAt: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentDirectoryResult = {
  id: string;
  name: string;
  email: string;
  prn: string;
  department?: { id: string; code: string; name: string } | null;
};

export type FacultyDirectoryResult = {
  id: string;
  name: string;
  email: string;
  /** Honorific from the faculty import ("Dr.", "Prof."), when one was given. */
  prefix?: string | null;
  department?: { id: string; code: string; name: string } | null;
};

export type NotificationDto = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type ProjectDetail = ProjectSummary & {
  domain?: string | null;
  tags: string[];
  rejectionReason?: string | null;
  submittedAt?: string | null;
  members: Array<{
    id: string;
    userId?: string | null;
    email: string;
    role: string;
    status: string;
    name: string;
    department?: { id: string; code: string; name: string } | null;
    invitationExpiresAt?: string | null;
    respondedAt?: string | null;
  }>;
  mentorRequests: Array<{
    id: string;
    faculty: { id: string; name: string; email: string };
    status: string;
    reason?: string | null;
    requestedAt: string;
    respondedAt?: string | null;
  }>;
  equipment: Array<{ id: string; name: string; category: string; status: string }>;
  consumables: Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    /** What the mentor approved — the ceiling on later material claims. */
    quantity: number;
    variant: string | null;
  }>;
  bookings: Array<{
    id: string;
    status: string;
    startsAt: string;
    endsAt: string;
    canView: boolean;
  }>;
};

export type OnboardingInput = {
  fullName: string;
  prn: string;
  departmentId: string;
  programmeId: string;
  academicYear: number;
  division?: string;
  phone?: string;
};

export type CreateProjectInput = {
  idempotencyKey: string;
  labId: string;
  title: string;
  description: string;
  teamMemberEmails?: string[];
  mentorId: string;
  equipmentIds?: string[];
  /** Material plan with the quantity the mentor is asked to approve. */
  consumables?: Array<{ consumableId: string; quantity: number; variant?: string | null }>;
};

export type UpdateProjectInput = {
  title?: string;
  description?: string;
  equipmentIds?: string[];
  consumables?: Array<{ consumableId: string; quantity: number; variant?: string | null }>;
};

export type BookingStatus = "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type BookingParticipantDto = {
  userId: string;
  name: string;
  email?: string;
  prn?: string;
  role: string;
};

export type BookingDto = {
  id: string;
  labId: string;
  labSlotId: string;
  projectId: string;
  createdById: string;
  projectTitle: string;
  labName: string;
  timeZone: string;
  attendeeCount: number;
  status: BookingStatus;
  statusLabel: string;
  notes: string | null;
  cancellationReason: string | null;
  cancellationSource: "STUDENT" | "LAB_ASSISTANT" | "ADMIN" | "SUPER_ADMIN" | null;
  cancelledAt: string | null;
  startsAt: string;
  endsAt: string;
  participants: BookingParticipantDto[];
  equipment: Array<{ equipmentId: string; name: string; quantity: number }>;
  canCancel: boolean;
  /** The leader may end a session only once the lab has checked the team in. */
  canComplete: boolean;
  cancellationDeadline: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingMutationResult = {
  booking: BookingDto;
  replayed: boolean;
};

export type CreateBookingInput = {
  labSlotId: string;
  projectId: string;
  participantIds: string[];
  /** Machines to hold for this slot; a subset of the project's own list. */
  equipmentIds?: string[];
  idempotencyKey: string;
  notes?: string | null;
};

export type CancelBookingInput = {
  reason: string;
  idempotencyKey: string;
};

// ─── Phase 5: visits, Quick Visits and the Lab Assistant console ────────────

export type VisitSource = "BOOKING" | "QUICK_VISIT";
export type AttendanceStatus = "EXPECTED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW";
export type QuickVisitStatus =
  "REQUESTED" | "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type VisitorDto = {
  userId: string;
  name: string;
  email?: string;
  prn?: string;
};

export type VisitDto = {
  id: string;
  labId: string;
  userId: string;
  bookingId: string | null;
  quickVisitId: string | null;
  projectId: string | null;
  source: VisitSource;
  status: AttendanceStatus;
  statusLabel: string;
  labName: string;
  timeZone: string;
  projectTitle: string | null;
  visitor: VisitorDto;
  expectedStartAt: string;
  expectedEndAt: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  lateByMinutes: number;
  isLateArrival: boolean;
  overstayByMinutes: number;
  isOverstay: boolean;
  closeReason: string | null;
  notes: string | null;
  durationMinutes: number | null;
  canCheckOut: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QuickVisitDto = {
  id: string;
  labId: string;
  labSlotId: string;
  userId: string;
  labName: string;
  timeZone: string;
  purpose: string;
  status: QuickVisitStatus;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  visitor: VisitorDto;
  decidedAt: string | null;
  decisionReason: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  canDecide: boolean;
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OccupantDto = {
  visitId: string;
  userId: string;
  name: string;
  email: string;
  prn: string | null;
  source: VisitSource;
  bookingId: string | null;
  quickVisitId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  checkedInAt: string;
  expectedEndAt: string;
  minutesInside: number;
  lateByMinutes: number;
  isLateArrival: boolean;
  overstayByMinutes: number;
  isOverstay: boolean;
};

export type OccupancyDto = {
  lab: { id: string; name: string; timeZone: string };
  observedAt: string;
  current: number;
  fromBookings: number;
  fromQuickVisits: number;
  overstaying: number;
  capacity: number;
  inside: OccupantDto[];
};

export type ConsoleParticipant = {
  userId: string;
  name: string;
  email: string;
  prn: string | null;
  role: "LEADER" | "MEMBER";
  attendanceStatus: AttendanceStatus;
  visitId: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  lateByMinutes: number;
  isLateArrival: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
};

export type ConsoleBooking = {
  id: string;
  projectId: string;
  projectTitle: string;
  status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  attendeeCount: number;
  notes: string | null;
  presentCount: number;
  participants: ConsoleParticipant[];
};

export type ConsoleQuickVisit = {
  id: string;
  userId: string;
  name: string;
  email: string;
  prn: string | null;
  purpose: string;
  status: QuickVisitStatus;
  visitId: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  canDecide: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
};

export type ConsoleSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "OPEN" | "BLOCKED" | "CLOSED";
  isCurrent: boolean;
  bookingCapacity: number;
  quickVisitCapacity: number;
  seatsTaken: number;
  quickVisitSeatsTaken: number;
  bookings: ConsoleBooking[];
  quickVisits: ConsoleQuickVisit[];
};

export type ConsoleDto = {
  lab: {
    id: string;
    name: string;
    timeZone: string;
    quickVisitsEnabled: boolean;
    quickVisitsRequireApproval: boolean;
    lateArrivalGraceMinutes: number;
    overstayGraceMinutes: number;
    noShowReleaseMinutes: number;
  };
  date: string;
  observedAt: string;
  occupancy: Omit<OccupancyDto, "lab" | "observedAt">;
  pendingQuickVisitRequests: number;
  slots: ConsoleSlot[];
};

export type CheckInInput =
  | {
      source: "BOOKING";
      bookingId: string;
      userId: string;
      idempotencyKey: string;
      notes?: string | null;
    }
  | { source: "QUICK_VISIT"; quickVisitId: string; idempotencyKey: string; notes?: string | null };

export const visitsApi = {
  list: (params?: Record<string, string>) => api.get<VisitDto[]>(`/visits${toQuery(params)}`),
  get: (id: string) => api.get<VisitDto>(`/visits/${id}`),
  checkIn: (data: CheckInInput) => api.post<VisitDto>("/visits/check-in", data),
  checkOut: (id: string, data: { idempotencyKey: string; notes?: string | null }) =>
    api.post<VisitDto>(`/visits/${id}/check-out`, data),
};

export const quickVisitsApi = {
  list: (params?: Record<string, string>) =>
    api.get<QuickVisitDto[]>(`/quick-visits${toQuery(params)}`),
  get: (id: string) => api.get<QuickVisitDto>(`/quick-visits/${id}`),
  create: (data: { labSlotId: string; purpose: string; idempotencyKey: string }) =>
    api.post<QuickVisitDto>("/quick-visits", data),
  decide: (id: string, decision: "APPROVED" | "REJECTED", reason?: string | null) =>
    api.post<QuickVisitDto>(`/quick-visits/${id}/decision`, { decision, reason }),
  cancel: (id: string, data: { reason: string; idempotencyKey: string }) =>
    api.post<QuickVisitDto>(`/quick-visits/${id}/cancel`, data),
};

export const consoleApi = {
  occupancy: (labId: string) => api.get<OccupancyDto>(`/labs/${labId}/occupancy`),
  roster: (labId: string, date?: string) =>
    api.get<ConsoleDto>(`/labs/${labId}/console${toQuery(date ? { date } : undefined)}`),
};

// ─── Phase 6: administration and reporting ──────────────────────────────────

export type DashboardDto = {
  lab: {
    id: string;
    name: string;
    timeZone: string;
    bookingCapacity: number;
    quickVisitCapacity: number;
  };
  observedAt: string;
  date: string;
  live: {
    occupancy: number;
    capacity: number;
    pendingQuickVisitRequests: number;
    slotsToday: number;
  };
  today: {
    bookings: Record<string, number>;
    bookingsTotal: number;
    quickVisits: Record<string, number>;
  };
  lastSevenDays: {
    from: string;
    to: string;
    bookings: Record<string, number>;
    bookingsTotal: number;
    noShowRate: number | null;
  };
  projects: Record<string, number>;
  equipment: Record<string, number>;
};

export type AuditEntryDto = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string; roles: string[] } | null;
};

export type ReferenceDepartment = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count: { programmes: number; students: number };
};

export type ReferenceProgramme = {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  isActive: boolean;
  department: { id: string; code: string; name: string };
  _count: { students: number };
};

export type ReferenceAcademicYear = {
  id: string;
  value: number;
  label: string;
  isActive: boolean;
};

export type ReferenceCategory = {
  id: string;
  labId: string;
  name: string;
  isActive: boolean;
  _count?: { equipment?: number; consumables?: number };
};

export type ReferenceConsumable = {
  id: string;
  labId: string;
  categoryId: string;
  name: string;
  domainId: string | null;
  unit: string;
  description: string | null;
  variants: string[];
  maxPerProject: number | null;
  /** Units on the shelf. Issued material never returns here — only a restock. */
  stockQuantity: number;
  lowStockThreshold: number | null;
  isActive: boolean;
  category: { id: string; name: string; isActive: boolean };
};

export type DivisionDto = {
  id: string;
  name: string;
  isActive: boolean;
  _count: { departments: number; faculty: number };
};

export type FacultyDto = {
  id: string;
  name: string;
  email: string;
  prefix: string | null;
  division: { id: string; name: string } | null;
  isActive: boolean;
  /** False until they have signed in with Google for the first time. */
  hasSignedIn: boolean;
  createdAt: string;
};

export type FacultyImportOutcome = {
  added: number;
  updated: number;
  total: number;
  divisionsCreated: string[];
  skipped: Array<{ row: number; email: string; reason: string }>;
};

export type ExportKind = "bookings" | "visits" | "quick-visits" | "projects" | "audit-logs";

export const adminApi = {
  dashboard: (labId: string) => api.get<DashboardDto>(`/labs/${labId}/dashboard`),
  auditLogs: (params?: Record<string, string>) =>
    api.get<AuditEntryDto[]>(`/admin/audit-logs${toQuery(params)}`),
  auditActions: () => api.get<string[]>("/admin/audit-logs/actions"),
  /**
   * Reports stream as CSV behind a bearer token, so a plain `<a download>` will
   * not do — the browser would send an unauthenticated request. This fetches
   * with credentials, then hands the blob to the browser as a save.
   */
  downloadExport: async (kind: ExportKind, params?: Record<string, string>) => {
    const response = await authorizedFetch(`/admin/exports/${kind}${toQuery(params)}`);
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(
        response.status,
        "EXPORT_FAILED",
        detail?.message ?? "The report could not be generated.",
      );
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filenameFrom(response) ?? `${kind}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revoke on the next tick so the navigation has already been queued.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  },

  departments: () => api.get<ReferenceDepartment[]>("/admin/reference/departments"),
  createDepartment: (data: { code: string; name: string }) =>
    api.post<ReferenceDepartment>("/admin/reference/departments", data),
  updateDepartment: (id: string, data: { code?: string; name?: string; isActive?: boolean }) =>
    api.patch<ReferenceDepartment>(`/admin/reference/departments/${id}`, data),
  /** Only possible while nothing references it; the API explains when it is not. */
  deleteDepartment: (id: string) =>
    api.delete<{ removedProgrammes: number }>(`/admin/reference/departments/${id}`),

  programmes: (labId?: string) =>
    api.get<ReferenceProgramme[]>(
      `/admin/reference/programmes${toQuery(labId ? { labId } : undefined)}`,
    ),
  createProgramme: (data: { departmentId: string; code: string; name: string }) =>
    api.post<ReferenceProgramme>("/admin/reference/programmes", data),
  updateProgramme: (id: string, data: { code?: string; name?: string; isActive?: boolean }) =>
    api.patch<ReferenceProgramme>(`/admin/reference/programmes/${id}`, data),
  deleteProgramme: (id: string) =>
    api.delete<{ deleted: boolean }>(`/admin/reference/programmes/${id}`),

  academicYears: () => api.get<ReferenceAcademicYear[]>("/admin/reference/academic-years"),
  saveAcademicYear: (data: { value: number; label: string; isActive?: boolean }) =>
    api.put<ReferenceAcademicYear>("/admin/reference/academic-years", data),

  equipmentCategories: (labId?: string) =>
    api.get<ReferenceCategory[]>(
      `/admin/reference/equipment-categories${toQuery(labId ? { labId } : undefined)}`,
    ),
  createEquipmentCategory: (data: { labId: string; name: string }) =>
    api.post<ReferenceCategory>("/admin/reference/equipment-categories", data),
  updateEquipmentCategory: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<ReferenceCategory>(`/admin/reference/equipment-categories/${id}`, data),

  consumableCategories: (labId?: string) =>
    api.get<ReferenceCategory[]>(
      `/admin/reference/consumable-categories${toQuery(labId ? { labId } : undefined)}`,
    ),
  createConsumableCategory: (data: { labId: string; name: string }) =>
    api.post<ReferenceCategory>("/admin/reference/consumable-categories", data),
  updateConsumableCategory: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<ReferenceCategory>(`/admin/reference/consumable-categories/${id}`, data),

  consumables: (labId?: string) =>
    api.get<ReferenceConsumable[]>(
      `/admin/reference/consumables${toQuery(labId ? { labId } : undefined)}`,
    ),
  createConsumable: (data: {
    labId: string;
    categoryId: string;
    name: string;
    domainId?: string | null;
    unit: string;
    description?: string | null;
    variants?: string[];
    maxPerProject?: number | null;
    stockQuantity?: number;
    lowStockThreshold?: number | null;
  }) => api.post<ReferenceConsumable>("/admin/reference/consumables", data),
  updateConsumable: (
    id: string,
    data: {
      name?: string;
      categoryId?: string;
      domainId?: string | null;
      unit?: string;
      description?: string | null;
      variants?: string[];
      maxPerProject?: number | null;
      stockQuantity?: number;
      lowStockThreshold?: number | null;
      isActive?: boolean;
    },
  ) => api.patch<ReferenceConsumable>(`/admin/reference/consumables/${id}`, data),
};
