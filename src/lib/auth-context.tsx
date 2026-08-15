import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { AuthClient } from "./auth-client";

const AuthContext = createContext<AuthClient | null>(null);

export function AuthProvider({ client, children }: { client: AuthClient; children: ReactNode }) {
  useEffect(() => {
    void client.ensureSession();
  }, [client]);

  return <AuthContext.Provider value={client}>{children}</AuthContext.Provider>;
}

export function useAuthClient() {
  const client = useContext(AuthContext);
  if (!client) throw new Error("useAuthClient must be used inside AuthProvider");
  return client;
}

export function useAuth() {
  const client = useAuthClient();
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getServerSnapshot,
  );
  return { ...snapshot, client };
}

export type { AuthUser, AuthUserRole, OnboardingInput, StudentProfile } from "./auth-client";
