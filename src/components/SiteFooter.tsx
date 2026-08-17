import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

const platformLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Projects", href: "/projects" },
  { label: "Book a Slot", href: "/slots" },
  { label: "Equipment Catalogue", href: "/equipment" },
  { label: "Visit History", href: "/visits" },
];

const supportLinks = [
  { label: "Sign In", href: "/login" },
  { label: "Student Guide", href: "/login" },
  { label: "Faculty Portal", href: "/login" },
  { label: "Lab Operations", href: "/login" },
  { label: "Admin Panel", href: "/login" },
];

const aboutLinks = [
  { label: "MIT-WPU", href: "https://mitwpu.edu.in", external: true },
  { label: "Ignisia Club", href: "https://ignisia.tech", external: true },
  { label: "MakerSpace PRD", href: "/login" },
  { label: "Terms of Use", href: "/login" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background overflow-hidden">

      {/* ── Top section: CTA + columns ───────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">

          {/* LEFT: CTA block */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
              Get started
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-foreground">
              Build your next<br />idea at the<br />MakerSpace.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground max-w-xs">
              Sign in with your MIT-WPU institutional account to create a project and access the MakerSpace workflow.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign in with MIT-WPU
              <ArrowRight className="size-3.5" />
            </Link>

            {/* Institution tag */}
            <p className="mt-8 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
              Dr. Vishwanath Karad · MIT World Peace University
            </p>
          </div>

          {/* PLATFORM */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Platform
            </p>
            <ul className="space-y-2.5">
              {platformLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SUPPORT */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Access
            </p>
            <ul className="space-y-2.5">
              {supportLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ABOUT */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              About
            </p>
            <ul className="space-y-2.5">
              {aboutLinks.map(({ label, href, external }) => (
                <li key={label}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      to={href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* ── Giant wordmark ───────────────────────────────────── */}
      <div className="w-full overflow-hidden select-none" aria-hidden>
        <p
          className="font-black uppercase text-foreground/[0.06] whitespace-nowrap leading-none"
          style={{
            fontSize: "clamp(80px, 18vw, 220px)",
            letterSpacing: "-0.02em",
            lineHeight: 0.85,
          }}
        >
          MakerSpace
        </p>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────── */}
      <div className="border-t border-border/60 mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground/60 tracking-wide">
          © {year} MIT-WPU MakerSpace Management Platform — All rights reserved.
        </p>
        <a
          href="https://ignisia.tech"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors tracking-wide"
        >
          Built by{" "}
          <span className="font-bold text-[#2938cf]">Ignisia</span>
        </a>
      </div>

    </footer>
  );
}
