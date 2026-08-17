import { Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, Layers, ShieldCheck, Sparkles, Wrench } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4 sm:px-8 transition-all duration-300">
      <div className="mx-auto max-w-7xl">
        <nav className="flex items-center justify-between rounded-full border border-white/20 bg-background/70 backdrop-blur-xl px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          {/* Logo & Identity */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <Sparkles className="size-4.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                MIT-WPU <span className="text-primary font-extrabold">MakerSpace</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Rapid Prototyping Lab
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <a
              href="#zones"
              className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-full transition-colors flex items-center gap-1.5"
            >
              <Layers className="size-3.5 text-primary" />
              Lab Zones
            </a>
            <a
              href="#equipment"
              className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-full transition-colors flex items-center gap-1.5"
            >
              <Wrench className="size-3.5 text-primary" />
              Equipment
            </a>
            <a
              href="#tracks"
              className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-full transition-colors flex items-center gap-1.5"
            >
              <Cpu className="size-3.5 text-primary" />
              Innovation Tracks
            </a>
            <a
              href="#safety"
              className="px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-full transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="size-3.5 text-primary" />
              Safety & Infrastructure
            </a>
          </div>

          {/* Action CTA */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all hover:shadow-lg active:scale-95"
            >
              <span>Lab Portal</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
