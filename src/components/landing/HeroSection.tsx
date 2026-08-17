import { useNavigate } from "@tanstack/react-router";
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
  const { authenticated, role, beginNewStudentSession } = useMakerSpace();
  const navigate = useNavigate();

  const handleSignIn = () => {
    if (authenticated) {
      navigate({ to: roleHomes[role] });
      return;
    }

    if (import.meta.env.DEV) {
      beginNewStudentSession();
      navigate({ to: "/onboarding" });
      return;
    }

    window.location.assign("/api/auth/google");
  };

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
