import { ApiClient, type ApiClientError } from "./api-client";

export type AuthUserRole = "STUDENT" | "FACULTY_MENTOR" | "LAB_ASSISTANT" | "ADMIN" | "SUPER_ADMIN";

export type StudentProfile = {
  prn: string;
  academicYear: number;
  division: string | null;
  phone: string | null;
  department?: { id: string; code: string; name: string };
  programme?: { id: string; departmentId: string; code: string; name: string };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: AuthUserRole[];
  avatarUrl: string | null;
  profileComplete: boolean;
  isActive: boolean;
  studentProfile?: StudentProfile | null;
};

export type AuthSnapshot = {
  status: "initializing" | "authenticated" | "anonymous";
  user: AuthUser | null;
  permissions: string[];
  error: ApiClientError | null;
};

type GoogleConfig = { clientId: string; hostedDomain: string };
type AuthPayload = { user: AuthUser; permissions: string[] };
type GoogleSignInPayload = AuthPayload & {
  accessToken: string;
  next: "onboarding" | "dashboard";
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

const initialSnapshot: AuthSnapshot = {
  status: "initializing",
  user: null,
  permissions: [],
  error: null,
};

export class AuthClient {
  readonly api = new ApiClient();
  private snapshot = initialSnapshot;
  private listeners = new Set<() => void>();
  private initializationPromise: Promise<AuthSnapshot> | null = null;
  private initializationAttempted = false;

  constructor() {
    this.api.setAuthenticationLostHandler(() => this.clearSession());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initialSnapshot;

  ensureSession = async () => {
    if (typeof window === "undefined") return this.snapshot;
    if (this.snapshot.status === "authenticated") return this.snapshot;
    if (this.initializationAttempted && this.snapshot.status === "anonymous") return this.snapshot;
    if (!this.initializationPromise) {
      this.initializationAttempted = true;
      this.initializationPromise = this.restoreSession().finally(() => {
        this.initializationPromise = null;
      });
    }
    return this.initializationPromise;
  };

  retrySession = async () => {
    this.initializationAttempted = false;
    this.setSnapshot({ ...initialSnapshot });
    return this.ensureSession();
  };

  getGoogleConfig = () => this.api.publicRequest<GoogleConfig>("/auth/google/config");

  createLoginCsrf = async () => {
    const result = await this.api.publicRequest<{ csrfToken: string }>("/auth/google/csrf");
    return result.csrfToken;
  };

  signInWithGoogle = async (credential: string, csrfToken: string) => {
    const result = await this.api.publicRequest<GoogleSignInPayload>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, csrfToken }),
    });
    this.api.setAccessToken(result.accessToken);
    await this.loadCurrentUser();
    return { user: this.snapshot.user!, next: result.next };
  };

  completeOnboarding = async (input: OnboardingInput) => {
    await this.api.request("/auth/onboarding", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await this.loadCurrentUser();
    return this.snapshot.user!;
  };

  refreshCurrentUser = async () => {
    await this.loadCurrentUser();
    return this.snapshot.user!;
  };

  logout = async () => {
    try {
      if (this.api.getAccessToken()) {
        await this.api.request("/auth/logout", { method: "POST" });
      }
    } finally {
      this.clearSession();
    }
  };

  private restoreSession = async () => {
    try {
      const refreshed = await this.api.refreshAccessToken();
      if (!refreshed) {
        this.clearSession();
        return this.snapshot;
      }
      await this.loadCurrentUser();
    } catch (error) {
      this.setSnapshot({
        status: "anonymous",
        user: null,
        permissions: [],
        error: error as ApiClientError,
      });
    }
    return this.snapshot;
  };

  private loadCurrentUser = async () => {
    const result = await this.api.request<AuthPayload>("/auth/me");
    this.setSnapshot({
      status: "authenticated",
      user: result.user,
      permissions: result.permissions,
      error: null,
    });
  };

  private clearSession = () => {
    this.api.setAccessToken(null);
    this.setSnapshot({ status: "anonymous", user: null, permissions: [], error: null });
  };

  private setSnapshot(snapshot: AuthSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}

export function destinationForUser(user: AuthUser) {
  if (user.roles.includes("STUDENT") && !user.profileComplete) return "/onboarding" as const;
  if (user.roles.includes("SUPER_ADMIN")) return "/super-admin" as const;
  if (user.roles.includes("ADMIN")) return "/admin" as const;
  if (user.roles.includes("LAB_ASSISTANT")) return "/operations" as const;
  if (user.roles.includes("FACULTY_MENTOR")) return "/faculty" as const;
  return "/dashboard" as const;
}
