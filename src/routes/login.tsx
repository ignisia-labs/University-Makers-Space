import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { AppRole } from "@/lib/makerspace-data";
import bgVideo from "../../Assets/gemini_generated_video_ab04e635.mp4";
import { Settings } from "lucide-react";
import { z } from "zod";

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
      <main className="flex min-h-screen items-center justify-center bg-[#0b1020] px-6 py-12 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-white/60">MIT-WPU MakerSpace</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Sign in</h1>
          <p className="mt-2 text-sm text-white/70">
            Use your institutional email to continue to your workspace.
          </p>

          <label className="mt-6 block text-sm font-medium text-white/80" htmlFor="email-input">
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
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/30"
          />
          {emailError && <p className="mt-2 text-sm text-rose-300">{emailError}</p>}

          <button
            type="button"
            onClick={handleEmailSignIn}
            disabled={isChecking}
            className="mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
          >
            {isChecking ? "Signing in..." : "Continue"}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="mt-3 w-full rounded-full border border-white/15 px-4 py-3 text-sm text-white/80 transition hover:bg-white/5"
          >
            Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen bg-black flex flex-col justify-center items-center overflow-hidden">
      {/* Full-Height Background Video */}
      <div className="absolute inset-0 w-full h-full z-0 select-none pointer-events-none">
        <video
          src={bgVideo}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-xl px-6 text-center flex flex-col items-center justify-center">
        {/* Brand */}
        <h1
          className="whitespace-nowrap select-none leading-none"
          style={{
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.96)",
            textShadow:
              "0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.2)",
          }}
        >
          MIT-WPU MakerSpace
        </h1>

        {/* Liquid Glass Sign In Button */}
        <button
          type="button"
          onClick={signIn}
          disabled={isChecking}
          className="mt-14 inline-flex items-center justify-center rounded-full relative overflow-hidden group transition-all duration-500 active:scale-95 hover:scale-[1.04] cursor-pointer"
          style={{
            minHeight: "3.5rem",
            paddingLeft: "3.5rem",
            paddingRight: "3.5rem",
            fontSize: "0.75rem",
            letterSpacing: "0.25em",
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.95)",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderTop: "1px solid rgba(255,255,255,0.38)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,0,0,0.15) inset",
          }}
        >
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out" />
          <span
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(to right, transparent 10%, rgba(255,255,255,0.45) 50%, transparent 90%)",
            }}
          />
          <span className="relative z-10">
            {isChecking ? "Authenticating..." : "Sign In with MIT-WPU Email"}
          </span>
        </button>
      </div>

      {/* DEV Preview Trigger at absolute corner */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-6 right-6 z-20">
          <button
            onClick={() => setDevMenuOpen((o) => !o)}
            className="flex items-center justify-center size-9 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 text-white transition-all backdrop-blur-md cursor-pointer"
          >
            <Settings className="size-4 animate-spin-slow" />
          </button>

          {devMenuOpen && (
            <div className="absolute bottom-12 right-0 bg-[#F0EFFF] border border-zinc-200 p-4 rounded-2xl shadow-xl w-60 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest pb-2 border-b border-zinc-100">
                PROTOTYPE ROLES
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
