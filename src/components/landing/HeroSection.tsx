import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMakerSpace } from "@/lib/makerspace-context";
import bgVideo from "../../../Assets/gemini_generated_video_ab04e635.mp4";

const roleHomes = {
  Student: "/dashboard",
  "Faculty Mentor": "/faculty",
  "Lab Assistant": "/operations",
  Admin: "/admin",
  "Super Admin": "/super-admin",
} as const;

export function HeroSection() {
  const { authenticated, role, signInWithEmail } = useMakerSpace();
  const navigate = useNavigate();
  const [stage, setStage] = useState<"idle" | "email" | "loading">("idle");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Mimic the round-trip to Google, then land on the dashboard for a known
  // account or on onboarding for a new one.
  useEffect(() => {
    if (stage !== "loading") return;
    const timer = window.setTimeout(() => {
      const exists = signInWithEmail(email);
      navigate({ to: exists ? "/dashboard" : "/onboarding" });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [stage, email, signInWithEmail, navigate]);

  const handleSignIn = () => {
    if (authenticated) {
      navigate({ to: roleHomes[role] });
      return;
    }
    if (import.meta.env.DEV) {
      setStage("email");
      return;
    }
    window.location.assign("/api/auth/google");
  };

  if (stage === "loading") return <SignInTransition />;
  if (stage === "email") {
    return (
      <EmailGate
        email={email}
        error={emailError}
        onChange={(value) => {
          setEmail(value);
          setEmailError("");
        }}
        onBack={() => setStage("idle")}
        onContinue={() => {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
            setEmailError("Enter a valid institutional email.");
            return;
          }
          setStage("loading");
        }}
      />
    );
  }

  return (
    <section className="relative w-full h-screen bg-black flex flex-col justify-center items-center overflow-hidden">
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
        {/* Multi-layer cinematic overlay for depth and editorial legibility */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
        {/* Subtle radial vignette pulling focus to center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      {/* Centered Overlay Content */}
      <div className="relative z-10 w-full px-6 text-center flex flex-col items-center justify-center text-white h-full gap-0">
        {/* Main Title: Cormorant Garamond — luxury editorial display */}
        <h1
          className="whitespace-nowrap select-none leading-none"
          style={{
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(2.8rem, 7.5vw, 6.8rem)",
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.96)",
            textShadow:
              "0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.2)",
          }}
        >
          MIT-WPU MakerSpace
        </h1>

        {/* Rule lines + Tagline composition */}
        <div className="mt-8 flex items-center gap-5 w-full max-w-xl justify-center">
          <div
            className="flex-1 h-px"
            style={{
              background: "linear-gradient(to right, transparent, rgba(255,255,255,0.3))",
            }}
          />
          <p
            className="text-[11px] sm:text-sm lg:text-base tracking-[0.25em] font-mono uppercase text-white/70 flex-shrink-0"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
          >
            Build ideas into working prototypes
          </p>
          <div
            className="flex-1 h-px"
            style={{
              background: "linear-gradient(to left, transparent, rgba(255,255,255,0.3))",
            }}
          />
        </div>

        {/* Liquid Glass Sign In Button */}
        <button
          type="button"
          onClick={handleSignIn}
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
          {/* Shimmer reflection sweep */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out" />
          {/* Top edge highlight — glass refraction */}
          <span
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(to right, transparent 10%, rgba(255,255,255,0.45) 50%, transparent 90%)",
            }}
          />
          <span className="relative z-10">Sign In</span>
        </button>
      </div>
    </section>
  );
}

function EmailGate({
  email,
  error,
  onChange,
  onBack,
  onContinue,
}: {
  email: string;
  error: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="grid min-h-screen place-items-center bg-background px-6">
      <form
        className="card-surface animate-in fade-in zoom-in-95 w-full max-w-sm p-8 duration-300"
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
      >
        <div className="flex items-center gap-3">
          <GoogleMark />
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Sign in with Google
          </p>
        </div>
        <h1 className="mt-5 font-serif text-2xl font-light tracking-wide">Welcome</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Use your MIT-WPU institutional email to continue.
        </p>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(event) => onChange(event.target.value)}
          placeholder="you@mitwpu.edu.in"
          className={
            "mt-5 h-12 w-full rounded-xl border bg-secondary/40 px-4 text-sm outline-none transition-all " +
            (error
              ? "border-destructive focus:border-destructive"
              : "border-border focus:border-primary focus:ring-2 focus:ring-primary/15")
          }
        />
        {error && <p className="mt-1.5 text-[10px] font-mono text-destructive">{error}</p>}
        <button
          type="submit"
          className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back
        </button>
      </form>
    </section>
  );
}

function SignInTransition() {
  return (
    <section className="grid min-h-screen place-items-center bg-background px-6">
      <div className="animate-in fade-in zoom-in-95 flex flex-col items-center text-center duration-500">
        <span className="relative grid size-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <span className="absolute inset-0 rounded-full border border-primary/20" />
          <GoogleMark />
        </span>
        <p className="mt-8 font-serif text-2xl font-light tracking-wide text-foreground">
          Signing you in
        </p>
        <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          MIT-WPU institutional account
        </p>
        <span className="mt-8 h-0.5 w-40 overflow-hidden rounded-full bg-border">
          <span className="signin-progress block h-full rounded-full bg-primary" />
        </span>
      </div>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="relative size-7" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.26a12 12 0 0 0 0 10.76l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
