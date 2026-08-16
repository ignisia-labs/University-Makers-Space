import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMakerSpace } from "@/lib/makerspace-context";

const loginErrors = {
  "unauthorized-domain": {
    title: "Use your MIT-WPU account",
    body: "MakerSpace access is available only to authorized @mitwpu.edu.in institutional accounts.",
  },
  "account-inactive": {
    title: "This account is not active",
    body: "Contact the MakerSpace team if you believe you should have access.",
  },
  "session-expired": {
    title: "Your session has expired",
    body: "Sign in again with your MIT-WPU account to continue.",
  },
  "connection-failed": {
    title: "We couldn't connect",
    body: "Check your connection and try signing in again.",
  },
} as const;

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    error: z.enum(Object.keys(loginErrors) as [keyof typeof loginErrors]).optional(),
  }),
  component: Login,
});

const roleHomes = {
  Student: "/dashboard",
  "Faculty Mentor": "/faculty",
  "Lab Assistant": "/operations",
  Admin: "/admin",
  "Super Admin": "/super-admin",
} as const;

function Login() {
  const navigate = useNavigate();
  const { authenticated, role, beginPrototypeSession } = useMakerSpace();
  const { error } = Route.useSearch();
  const [isChecking, setIsChecking] = useState(false);
  const message = error ? loginErrors[error] : null;

  useEffect(() => {
    if (authenticated && !isChecking) navigate({ to: roleHomes[role] });
  }, [authenticated, isChecking, navigate, role]);

  const signIn = () => {
    setIsChecking(true);

    if (import.meta.env.DEV) {
      window.setTimeout(() => {
        beginPrototypeSession();
        navigate({ to: "/onboarding" });
      }, 450);
      return;
    }

    window.location.assign("/api/auth/google");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md">
        <p className="font-display text-sm font-bold">
          MIT-WPU <span className="text-primary">MakerSpace</span>
        </p>
        <div className="card-surface mt-5 p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl font-bold">Sign in to MakerSpace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your MIT-WPU Google account to access projects, bookings, and MakerSpace operations.
          </p>

          {message && (
            <div
              className="mt-5 rounded-xl border border-warning/30 bg-warning/10 p-4"
              role="alert"
            >
              <div className="flex gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
                <div>
                  <h2 className="text-sm font-semibold">{message.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{message.body}</p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={signIn}
            disabled={isChecking}
            className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-80"
          >
            {isChecking ? (
              <>
                <LoaderCircle className="size-5 animate-spin" /> Checking your MIT-WPU account…
              </>
            ) : (
              <>
                Sign in with Google <ArrowRight className="size-5" />
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Only verified @mitwpu.edu.in accounts are accepted.
          </p>
        </div>
      </section>
    </main>
  );
}
