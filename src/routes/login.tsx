import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useMakerSpace } from "@/lib/makerspace-context";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const { beginPrototypeSession } = useMakerSpace();
  const signIn = () => {
    if (import.meta.env.DEV) {
      beginPrototypeSession();
      navigate({ to: "/onboarding" });
      return;
    }

    window.location.assign("/api/auth/google");
  };
  return (
    <main className="grid min-h-screen bg-background px-4 py-10 place-items-center">
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
          <button
            type="button"
            onClick={signIn}
            className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground"
          >
            Sign in with Google <ArrowRight className="size-5" />
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Only verified @mitwpu.edu.in accounts are accepted.
          </p>
        </div>
      </section>
    </main>
  );
}
