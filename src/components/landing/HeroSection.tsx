import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { roleHomes, useAppSession } from "@/lib/auth-context";
import { demoMode } from "@/mocks/server";

/**
 * Where the hero film is served from.
 *
 * Set `VITE_HERO_VIDEO_URL` to a CDN URL and the 2.4MB file leaves this origin
 * altogether. With it unset the local copy is still used, but fetched through a
 * dynamic import so the bytes are requested *after* the page is interactive
 * rather than as part of the first paint.
 */
// Defaulted in source rather than left to the host. This branch is the demo
// and is deployed by Cloudflare, which reads neither netlify.toml nor
// vercel.json — relying on a build variable meant the film silently did not
// play in production while working fine locally.
const heroVideoUrl =
  (import.meta.env["VITE_HERO_VIDEO_URL"] as string | undefined) ??
  "https://res.cloudinary.com/b8aehfw4/video/upload/v1792348368/srijan/landing/hero.mp4";
const heroPosterUrl = import.meta.env["VITE_HERO_POSTER_URL"] as string | undefined;

/**
 * A 32x18 frame of the film, inlined at ~1.4KB.
 *
 * Scaled up and blurred by the browser it reads as the film's own colours and
 * composition, so the hero is never bare black while the video is still being
 * fetched — and it costs a rounding error rather than a poster JPEG's 65KB.
 */
const heroPlaceholder =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wAARCAASACADASIAAhEBAxEB/8QAGQAAAwADAAAAAAAAAAAAAAAAAAIEAQMF/8QAJxAAAgIBAwMEAgMAAAAAAAAAAQIDEQQAITEFEiIUQVFhgZETMrH/xAAXAQEBAQEAAAAAAAAAAAAAAAAAAQID/8QAGBEBAAMBAAAAAAAAAAAAAAAAAAECETH/2gAMAwEAAhEDEQA/AOZBiYEM3qcOekUEs1FEdeCpF2LFg1Qo86oxOimTLMc8sKeP8gYsN3+Nlsn5P++8GO0k3pjHFHB2L2sxJJPNUSTWx+rP71nq+dkYUkZGSpLRq4IABBG1D4si/nj87nHKNWDpxiyJFjyEYqnj2yAhlIpjsL2vggA3+9HpMTAk74A0rAASyhwCQV8q9/c7V71Z5MuBkydQyYIVljhhxR4+NM4og2Qbs0oPF/jSzRCESd6IWiao3ALFgbsGyQNqGwHGrGE6oQlZFRSQojDADi+wb6TqSKcuYFQQrkAVwL0aNLJU3SUX1qt2i+/mvo6TI3xpr3qQAfX9tGjVrwt1/9k=";

// The static build always streams the film from the CDN — there is no local
// copy to fall back to, which is the point: it keeps 2.4MB out of the bundle.
async function resolveHeroVideo() {
  return heroVideoUrl ?? "";
}

const glassButtonStyle: React.CSSProperties = {
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
};

const glassTopEdge: React.CSSProperties = {
  background:
    "linear-gradient(to right, transparent 10%, rgba(255,255,255,0.45) 50%, transparent 90%)",
};

export function HeroSection() {
  const { authenticated, role, onboarded } = useAppSession();
  const navigate = useNavigate();

  const destination = onboarded ? roleHomes[role] : "/onboarding";
  const openWorkspace = () => {
    navigate({ to: destination });
  };

  /**
   * Safety net for the sign-in hand-off.
   *
   * The button's own callback normally navigates. This catches the case where
   * it cannot — the component unmounts the moment `authenticated` flips, so a
   * hiccup in that callback would otherwise leave somebody signed in but still
   * looking at the landing page with no way forward.
   *
   * It fires only on the false → true transition, so visiting the landing page
   * while already signed in still shows the page rather than bouncing away.
   */
  const [signInError, setSignInError] = useState("");
  const wasAuthenticated = useRef(authenticated);
  useEffect(() => {
    if (authenticated && !wasAuthenticated.current) {
      navigate({ to: destination, replace: true });
    }
    wasAuthenticated.current = authenticated;
  }, [authenticated, destination, navigate]);

  return (
    <section className="relative w-full h-screen bg-black flex flex-col justify-center items-center overflow-hidden">
      {/* Full-Height Background Video */}
      <div className="absolute inset-0 w-full h-full z-0 select-none pointer-events-none">
        <HeroBackdrop />
        {/* Multi-layer cinematic overlay for depth and editorial legibility */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
        {/* Subtle radial vignette pulling focus to center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      {/* Centered Overlay Content */}
      <div className="relative z-10 w-full px-6 text-center flex flex-col items-center justify-center text-white h-full gap-0">
        {/* The university mark. The official asset is a JPEG on white, so it
            sits in a light chip rather than being dropped straight onto the
            video, where its background would read as a rectangular artefact. */}
        <span className="mb-8 inline-flex rounded-xl bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm">
          <img
            src="/mitwpu-logo.jpg"
            alt="MIT World Peace University"
            width={431}
            height={124}
            className="h-7 w-auto sm:h-9"
          />
        </span>

        {/* Wordmark: सृजन — the name of the MakerSpace. Devanagari is set a
            touch larger than a Latin equivalent would be, because its
            x-height reads smaller at the same point size. */}
        <h1
          className="wordmark whitespace-nowrap select-none"
          style={{
            fontWeight: 400,
            fontSize: "clamp(3.4rem, 9vw, 8rem)",
            letterSpacing: "0.02em",
            color: "rgba(255,255,255,0.96)",
            textShadow:
              "0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.2)",
          }}
        >
          सृजन
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
            MIT-WPU MakerSpace
          </p>
          <div
            className="flex-1 h-px"
            style={{
              background: "linear-gradient(to left, transparent, rgba(255,255,255,0.3))",
            }}
          />
        </div>

        {/* Sign-in lives here on the homepage — there is no separate login
            screen. The control below is ours; the click target is Google's.
            See `overlay` in GoogleSignInButton for why it has to work that
            way rather than calling Google from an onClick handler. */}
        {authenticated ? (
          <button
            type="button"
            onClick={openWorkspace}
            className="group relative mt-14 inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full transition-all duration-500 hover:scale-[1.04] active:scale-95"
            style={glassButtonStyle}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full" />
            <span className="absolute inset-x-0 top-0 h-px" style={glassTopEdge} />
            <span className="relative z-10">Open workspace</span>
          </button>
        ) : (
          <div className="mt-14 flex flex-col items-center">
            <div
              className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full transition-all duration-500 hover:scale-[1.04] active:scale-95"
              style={glassButtonStyle}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full"
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px"
                style={glassTopEdge}
              />
              <span aria-hidden="true" className="relative z-10">
                {demoMode ? "Explore the demo" : "Sign in with Google"}
              </span>
              {/* Transparent, stretched, and on top: this is what is actually
                  clicked. It carries its own accessible label, so the
                  decorative text above is hidden from assistive tech.

                  autoPrompt is deliberately off in the demo: it opens Google's
                  One Tap chooser, which has nothing to sign in to here. */}
              <GoogleSignInButton
                onSuccess={(destination) => navigate({ to: destination })}
                onError={setSignInError}
                autoPrompt={!demoMode}
                overlay
              />
            </div>
            {/* Rendered here, outside the button, because the button clips its
                own children — a failure drawn inside it would be invisible. */}
            {signInError ? (
              <p
                role="alert"
                className="mt-5 max-w-[min(88vw,28rem)] rounded-lg bg-red-950/85 px-4 py-2.5 text-center text-xs leading-5 text-red-100 shadow-lg backdrop-blur-sm"
              >
                {signInError}
              </p>
            ) : (
              <p
                className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
              >
                {demoMode
                  ? "Preview — sample data, no sign-in required"
                  : "Authorized @mitwpu.edu.in accounts only"}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The hero backdrop: a still by default, film only when it is welcome.
 *
 * The film is decoration. It is fetched *after* the page is interactive, and
 * not at all when the visitor has asked for reduced motion, is on a metered or
 * slow connection, or has no configured source. The still — a poster frame, or
 * failing that a gradient — is what everybody actually waits for, so the page
 * is legible in one paint rather than after a few megabytes.
 */
function HeroBackdrop() {
  const [filmSrc, setFilmSrc] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Someone who asked the OS for less motion should not be handed a looping
    // film as the first thing they see.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Save-Data and the effective connection type are advisory and absent on
    // several browsers; when unknown we go ahead rather than punishing everyone.
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return;

    // Wait for the main work to finish before spending bandwidth on decoration.
    let cancelled = false;
    const start = () => {
      void resolveHeroVideo().then((src) => {
        if (!cancelled) setFilmSrc(src);
      });
    };
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      }
    ).requestIdleCallback;
    if (idle) {
      const handle = idle(start, { timeout: 2_000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(handle);
      };
    }
    const timer = window.setTimeout(start, 1_200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {/* The still is always painted, and stays behind the film so a slow or
          failed video never exposes bare black. */}
      <div
        className="absolute inset-0 size-full scale-110 bg-neutral-950 bg-cover bg-center blur-xl"
        style={{ backgroundImage: `url(${heroPosterUrl ?? heroPlaceholder})` }}
      />
      {filmSrc && (
        <video
          src={filmSrc}
          {...(heroPosterUrl ? { poster: heroPosterUrl } : {})}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          aria-hidden
          className="absolute inset-0 size-full scale-105 object-cover"
        />
      )}
    </>
  );
}
