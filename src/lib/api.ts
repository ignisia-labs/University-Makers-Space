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

const BASE_URL = "/api/v1";
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
    api.get<{ equipment: EquipmentSummary[]; consumables: ConsumableSummary[] }>(
      `/reference-data/project-resources?labId=${labId}`,
    ),
};

export const projectsApi = {
  list: (params?: Record<string, string>) =>
    api.get<ProjectSummary[]>(`/projects${toQuery(params)}`),
  get: (id: string) => api.get<ProjectDetail>(`/projects/${id}`),
  create: (data: CreateProjectInput) => api.post<ProjectDetail>("/projects", data),
  update: (id: string, data: UpdateProjectInput) =>
    api.patch<ProjectDetail>(`/projects/${id}`, data),
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
  updateStatus: (id: string, status: BookingStatus, notes?: string | null) =>
    api.patch<BookingDto>(`/bookings/${id}/status`, { status, notes }),
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

export const equipmentApi = {
  list: (params?: Record<string, string>) => api.get(`/equipment${toQuery(params)}`),
  get: (id: string) => api.get(`/equipment/${id}`),
  create: (data: unknown) => api.post("/equipment", data),
  update: (id: string, data: unknown) => api.patch(`/equipment/${id}`, data),
  updateAvailability: (
    id: string,
    data: { status?: string; availableQuantity?: number; reason: string },
  ) => api.patch(`/equipment/${id}/availability`, data),
  delete: (id: string) => api.delete(`/equipment/${id}`),
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
  searchFacultyMentors: (search: string, page = 1) =>
    api.get<FacultyDirectoryResult[]>(
      `/users/search/faculty-mentors?search=${encodeURIComponent(search)}&page=${page}&limit=10`,
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
    status: string;
  }>;
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
  consumables: Array<{ id: string; name: string; category: string; unit: string }>;
  bookings: Array<{ id: string; status: string; startsAt: string; endsAt: string }>;
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
  consumableIds?: string[];
};

export type UpdateProjectInput = {
  title?: string;
  description?: string;
  equipmentIds?: string[];
  consumableIds?: string[];
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
  canCancel: boolean;
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
  idempotencyKey: string;
  notes?: string | null;
};

export type CancelBookingInput = {
  reason: string;
  idempotencyKey: string;
};
