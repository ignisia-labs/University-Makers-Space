import type { AuthUserRole } from "./auth-client";
import type { AppRole } from "./makerspace-data";

const STORAGE_KEY = "ums.prototypeRole";

export const prototypeRoles: AppRole[] = [
  "Student",
  "Faculty Mentor",
  "Lab Assistant",
  "Admin",
  "Super Admin",
];

const authRoleByPrototypeRole: Record<AppRole, AuthUserRole> = {
  Student: "STUDENT",
  "Faculty Mentor": "FACULTY_MENTOR",
  "Lab Assistant": "LAB_ASSISTANT",
  Admin: "ADMIN",
  "Super Admin": "SUPER_ADMIN",
};

const prototypeRoleByAuthRole: Record<AuthUserRole, AppRole> = {
  STUDENT: "Student",
  FACULTY_MENTOR: "Faculty Mentor",
  LAB_ASSISTANT: "Lab Assistant",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export function toAuthRole(role: AppRole) {
  return authRoleByPrototypeRole[role];
}

export function toPrototypeRole(role: AuthUserRole) {
  return prototypeRoleByAuthRole[role];
}

export function readPrototypeRole(): AuthUserRole | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(STORAGE_KEY);
  return Object.values(authRoleByPrototypeRole).includes(value as AuthUserRole)
    ? (value as AuthUserRole)
    : null;
}

export function storePrototypeRole(role: AppRole) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, toAuthRole(role));
  }
}

export function prototypeDestination(role: AppRole) {
  switch (role) {
    case "Faculty Mentor":
      return "/faculty" as const;
    case "Lab Assistant":
      return "/operations" as const;
    case "Admin":
      return "/admin" as const;
    case "Super Admin":
      return "/super-admin" as const;
    default:
      return "/dashboard" as const;
  }
}
