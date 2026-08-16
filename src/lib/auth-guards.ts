import { redirect } from "@tanstack/react-router";
import type { AuthClient, AuthUserRole } from "./auth-client";
import { destinationForUser } from "./auth-client";
import { readPrototypeRole } from "./prototype-role";

type GuardContext = { authClient: AuthClient };
type GuardArgs = { context: GuardContext; params?: Record<string, string> };

export async function requireAuthenticated({ context }: GuardArgs) {
  if (typeof window === "undefined") return;
  const session = await context.authClient.ensureSession();
  if (session.status !== "authenticated" || !session.user) {
    throw redirect({ to: "/" });
  }
  const prototypeRole = readPrototypeRole();
  if (
    session.user.roles.includes("STUDENT") &&
    !session.user.profileComplete &&
    (!prototypeRole || prototypeRole === "STUDENT")
  ) {
    throw redirect({ to: "/onboarding" });
  }
  return session.user;
}

export function requireRoles(...roles: AuthUserRole[]) {
  return async (args: GuardArgs) => {
    const user = await requireAuthenticated(args);
    if (!user) return;
    const prototypeRole = readPrototypeRole();
    const hasPreviewAccess = prototypeRole ? roles.includes(prototypeRole) : false;
    if (!hasPreviewAccess && !roles.some((role) => user.roles.includes(role))) {
      throw redirect({ to: destinationForUser(user) });
    }
    return user;
  };
}

export async function requireOnboarding({ context }: GuardArgs) {
  if (typeof window === "undefined") return;
  const session = await context.authClient.ensureSession();
  if (session.status !== "authenticated" || !session.user) {
    throw redirect({ to: "/" });
  }
  if (!session.user.roles.includes("STUDENT") || session.user.profileComplete) {
    throw redirect({ to: destinationForUser(session.user) });
  }
  return session.user;
}

export async function requireInvitation({ context, params }: GuardArgs) {
  if (typeof window === "undefined") return;
  const session = await context.authClient.ensureSession();
  if (session.status !== "authenticated" || !session.user) {
    throw redirect({ to: "/", search: { invite: params?.projectId } });
  }
  if (!session.user.roles.includes("STUDENT")) {
    throw redirect({ to: destinationForUser(session.user) });
  }
  if (!session.user.profileComplete) {
    throw redirect({
      to: "/onboarding",
      search: { invite: params?.projectId },
    });
  }
  return session.user;
}
