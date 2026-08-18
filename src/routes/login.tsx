import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { AppRole } from "@/lib/makerspace-data";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    error: z.string().optional(),
    mode: z.enum(["email"]).optional(),
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

const prototypeRoles: AppRole[] = [
  "Student",
  "Faculty Mentor",
  "Lab Assistant",
  "Admin",
  "Super Admin",
];

function Login() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { authenticated, role, beginPrototypeSession, beginNewStudentSession, signInWithEmail } =
    useMakerSpace();
  const [isChecking, setIsChecking] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (authenticated && !isChecking) {
      navigate({ to: roleHomes[role] });
    }
  }, [authenticated, isChecking, navigate, role]);

  const signIn = () => {
    setIsChecking(true);
    if (import.meta.env.DEV) {
      window.setTimeout(() => {
        beginNewStudentSession();
        navigate({ to: "/onboarding" });
      }, 450);
      return;
    }
    navigate({ to: "/login", search: { mode: "email" } });
  };

  const handleEmailSignIn = () => {
    const normalized = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      setEmailError("Enter a valid institutional email.");
      return;
    }

    setIsChecking(true);
    const exists = signInWithEmail(normalized);
    if (import.meta.env.DEV) {
      beginNewStudentSession();
      navigate({ to: "/onboarding" });
      return;
    }
    navigate({ to: exists ? "/dashboard" : "/onboarding" });
  };

  const previewWorkspace = (previewRole: AppRole) => {
    if (!import.meta.env.DEV) return;
    setIsChecking(true);
    window.setTimeout(() => {
      beginPrototypeSession(previewRole);
      navigate({ to: roleHomes[previewRole] });
    }, 200);
  };

  if (search.mode === "email") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10 sm:px-6">
        <section className="card-surface w-full max-w-md p-7 sm:p-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-primary">MIT-WPU MakerSpace</p>
          <h1 className="mt-4 font-serif text-3xl font-light tracking-wide text-foreground sm:text-4xl">
            Sign in
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use your institutional email to continue to your workspace.
          </p>

          <div className="mt-7 space-y-2">
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="email-input">
              Email address
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError("");
              }}
              placeholder="name@mitwpu.edu.in"
              className="h-11 w-full rounded-xl border border-border bg-secondary/40 px-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {emailError && <p className="text-[10px] font-mono text-destructive">{emailError}</p>}
          </div>

          <button
            type="button"
            onClick={handleEmailSignIn}
            disabled={isChecking}
            className="pressable mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking ? "Signing in..." : "Continue"}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="pressable mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Back
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 sm:px-6">
      <section className="card-surface animate-in fade-in zoom-in-95 w-full max-w-md p-7 text-center duration-500 sm:p-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-primary">Welcome back</p>
        <h1 className="mt-4 font-serif text-3xl font-light tracking-wide text-foreground sm:text-4xl">
          MIT-WPU MakerSpace
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Continue to your student workspace and manage your projects, bookings, and lab access.
        </p>

        <button
          type="button"
          onClick={signIn}
          disabled={isChecking}
          className="pressable mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? "Authenticating..." : "Sign In with MIT-WPU Email"}
        </button>
      </section>

      {import.meta.env.DEV && (
        <div className="absolute bottom-6 right-6 z-20">
          <button
            onClick={() => setDevMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-4" />
          </button>

          {devMenuOpen && (
            <div className="absolute bottom-12 right-0 w-60 rounded-2xl border border-border bg-card p-4 shadow-xl">
              <p className="border-b border-border pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Prototype roles
              </p>
              <div className="mt-2 grid gap-1.5">
                {prototypeRoles.map((previewRole) => (
                  <button
                    key={previewRole}
                    type="button"
                    onClick={() => previewWorkspace(previewRole)}
                    className="w-full text-left py-2 px-3 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-all font-mono"
                  >
                    Open {previewRole}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
