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
import type { AppRole, StudentProfile } from "./makerspace-data";
import { useMakerSpace } from "./makerspace-context";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  user: UserDto | null;
  permissions: string[];
  signInWithGoogleCredential: (credential: string) => Promise<"dashboard" | "onboarding">;
  completeStudentOnboarding: (input: OnboardingInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const roleHomes = {
  Student: "/dashboard",
  "Faculty Mentor": "/faculty",
  "Lab Assistant": "/operations",
  Admin: "/admin",
  "Super Admin": "/super-admin",
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
  const { endPrototypeSession } = useMakerSpace();
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

  const signInWithGoogleCredential = useCallback(
    async (credential: string) => {
      const { data: csrf } = await authApi.loginCsrf();
      const { data } = await authApi.googleSignIn(credential, csrf.csrfToken);
      storeAccessToken(data.accessToken);
      endPrototypeSession();
      setUser(data.user);
      setPermissions(data.permissions);
      setStatus("authenticated");
      return data.next;
    },
    [endPrototypeSession],
  );

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
      logout,
    }),
    [status, user, permissions, signInWithGoogleCredential, completeStudentOnboarding, logout],
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
  const mock = useMakerSpace();
  const prototype = import.meta.env.DEV && mock.prototypeActive;
  const role = prototype ? mock.role : primaryAppRole(auth.user?.roles ?? []);
  const profile = prototype ? mock.profile : userProfile(auth.user);
  const authenticated = prototype ? mock.authenticated : auth.status === "authenticated";
  const onboarded = prototype ? mock.onboarded : Boolean(auth.user?.profileComplete);

  return {
    prototype,
    role,
    profile,
    authenticated,
    onboarded,
    hydrated: mock.hydrated && auth.status !== "loading",
    user: prototype ? null : auth.user,
    permissions: prototype ? [] : auth.permissions,
    signOut: prototype ? async () => mock.signOut() : auth.logout,
  };
}
