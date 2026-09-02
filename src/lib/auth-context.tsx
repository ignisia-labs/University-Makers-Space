import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  authApi,
  clearAccessToken,
  restoreAccessToken,
  storeAccessToken,
  type OnboardingInput,
  type UserDto,
} from "./api";
import type { AppRole, StudentProfile } from "./roles";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  user: UserDto | null;
  permissions: string[];
  /** Resolves to the path the signed-in account should land on. */
  signInWithGoogleCredential: (credential: string) => Promise<string>;
  completeStudentOnboarding: (input: OnboardingInput) => Promise<void>;
  reloadCurrentUser: () => Promise<UserDto>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Where each role lands after signing in.
 *
 * A Super Admin goes to `/admin`: that console already exposes everything they
 * govern — the People tab is gated on `user.roles.manage`, which only they
 * hold — so there is no separate workspace to maintain, and no risk of the two
 * drifting apart.
 */
export const roleHomes = {
  Student: "/dashboard",
  "Faculty Mentor": "/faculty",
  "Lab Assistant": "/operations",
  Admin: "/admin",
  "Super Admin": "/admin",
} as const satisfies Record<AppRole, string>;

const backendRoleToAppRole: Record<string, AppRole> = {
  STUDENT: "Student",
  FACULTY_MENTOR: "Faculty Mentor",
  LAB_ASSISTANT: "Lab Assistant",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const rolePriority = ["SUPER_ADMIN", "ADMIN", "LAB_ASSISTANT", "FACULTY_MENTOR", "STUDENT"];

export function primaryAppRole(roles: string[]): AppRole {
  const role = rolePriority.find((candidate) => roles.includes(candidate));
  return backendRoleToAppRole[role ?? "STUDENT"] ?? "Student";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserDto | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const loadCurrentUser = useCallback(async () => {
    const { data } = await authApi.me();
    setUser(data.user);
    setPermissions(data.permissions);
    setStatus("authenticated");
    return data.user;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await restoreAccessToken();
      if (!token || cancelled) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      try {
        const { data } = await authApi.me();
        if (cancelled) return;
        setUser(data.user);
        setPermissions(data.permissions);
        setStatus("authenticated");
      } catch {
        if (!cancelled) {
          clearAccessToken();
          setStatus("unauthenticated");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogleCredential = useCallback(async (credential: string) => {
    const { data: csrf } = await authApi.loginCsrf();
    const { data } = await authApi.googleSignIn(credential, csrf.csrfToken);
    storeAccessToken(data.accessToken);
    setUser(data.user);
    setPermissions(data.permissions);
    setStatus("authenticated");
    // A student signing in for the first time has no profile yet and is sent
    // to onboarding. Everyone else goes straight to the workspace their role
    // owns, rather than to a single shared dashboard they may not be able to
    // open.
    return data.next === "onboarding" ? "/onboarding" : roleHomes[primaryAppRole(data.user.roles)];
  }, []);

  const completeStudentOnboarding = useCallback(
    async (input: OnboardingInput) => {
      await authApi.onboarding(input);
      await loadCurrentUser();
    },
    [loadCurrentUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
    } finally {
      clearAccessToken();
      setUser(null);
      setPermissions([]);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      permissions,
      signInWithGoogleCredential,
      completeStudentOnboarding,
      reloadCurrentUser: loadCurrentUser,
      logout,
    }),
    [
      status,
      user,
      permissions,
      signInWithGoogleCredential,
      completeStudentOnboarding,
      loadCurrentUser,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

function userProfile(user: UserDto | null): StudentProfile {
  return {
    email: user?.email ?? "",
    fullName: user?.name ?? "",
    prn: user?.studentProfile?.prn ?? "",
    department: user?.studentProfile?.department?.name ?? "MIT-WPU MakerSpace",
    programme: user?.studentProfile?.programme?.name ?? "",
    academicYear: user?.studentProfile ? `Year ${user.studentProfile.academicYear}` : "",
  };
}

export function useAppSession() {
  const auth = useAuth();
  return {
    role: primaryAppRole(auth.user?.roles ?? []),
    profile: userProfile(auth.user),
    authenticated: auth.status === "authenticated",
    onboarded: Boolean(auth.user?.profileComplete),
    hydrated: auth.status !== "loading",
    user: auth.user,
    permissions: auth.permissions,
    reloadCurrentUser: auth.reloadCurrentUser,
    signOut: auth.logout,
  };
}
