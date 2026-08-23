import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { roleHomes, useAppSession } from "@/lib/auth-context";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { AppRole } from "@/lib/makerspace-data";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ error: z.string().optional() }),
  component: Login,
});

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
  const session = useAppSession();
  const { beginPrototypeSession } = useMakerSpace();
  const [devMenuOpen, setDevMenuOpen] = useState(false);

  useEffect(() => {
    if (!session.hydrated || !session.authenticated) return;
    navigate({
      to: session.onboarded ? roleHomes[session.role] : "/onboarding",
      replace: true,
    });
  }, [navigate, session.authenticated, session.hydrated, session.onboarded, session.role]);

  const handleGoogleSuccess = useCallback(
    (next: "dashboard" | "onboarding") => {
      if (next === "onboarding") navigate({ to: "/onboarding", replace: true });
    },
    [navigate],
  );

  const previewWorkspace = (previewRole: AppRole) => {
    if (!import.meta.env.DEV) return;
    beginPrototypeSession(previewRole);
    navigate({ to: roleHomes[previewRole] });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 sm:px-6">
      <section className="card-surface animate-in fade-in zoom-in-95 w-full max-w-md p-7 text-center duration-500 sm:p-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-primary">
          Welcome back
        </p>
        <h1 className="mt-4 font-serif text-3xl font-light tracking-wide text-foreground sm:text-4xl">
          MIT-WPU MakerSpace
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use your verified MIT-WPU Google Workspace account to continue.
        </p>

        <div className="mt-7">
          <GoogleSignInButton onSuccess={handleGoogleSuccess} />
        </div>

        {search.error && (
          <p role="alert" className="mt-4 text-xs text-destructive">
            {search.error}
          </p>
        )}
        <p className="mt-5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Authorized @mitwpu.edu.in accounts only
        </p>
      </section>

      {import.meta.env.DEV && (
        <div className="absolute bottom-6 right-6 z-20">
          <button
            type="button"
            aria-label="Open prototype role switch"
            aria-expanded={devMenuOpen}
            onClick={() => setDevMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all hover:bg-secondary hover:text-foreground"
          >
            <Settings className="size-4" />
          </button>

          {devMenuOpen && (
            <div className="absolute bottom-12 right-0 w-60 rounded-2xl border border-border bg-card p-4 shadow-xl">
              <p className="border-b border-border pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Prototype view
              </p>
              <div className="mt-2 grid gap-1.5">
                {prototypeRoles.map((previewRole) => (
                  <button
                    key={previewRole}
                    type="button"
                    onClick={() => previewWorkspace(previewRole)}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-100"
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
