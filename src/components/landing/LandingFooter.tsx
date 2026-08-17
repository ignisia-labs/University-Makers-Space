import { Link } from "@tanstack/react-router";
import { IgnisiaCredit } from "@/components/IgnisiaCredit";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-zinc-100 py-12 px-6 md:px-12 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <span className="text-sm font-serif font-medium tracking-widest text-[#0F172A] uppercase">
            MIT-WPU MAKERSPACE
          </span>
          <span className="mt-1 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
            Dr. Vishwanath Karad World Peace University
          </span>
        </div>

        {/* Minimal Navigation links */}
        <div className="flex items-center gap-6 text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
          <Link to="/login" className="hover:text-[#1E2B8A] transition-colors">
            Login
          </Link>
          <span className="text-zinc-200">/</span>
          <Link to="/equipment" className="hover:text-[#1E2B8A] transition-colors">
            Catalogue
          </Link>
          <span className="text-zinc-200">/</span>
          <a
            href="https://mitwpu.edu.in"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#1E2B8A] transition-colors"
          >
            MIT-WPU
          </a>
        </div>
      </div>

      {/* Outlined Wordmark */}
      <div
        className="w-full overflow-hidden select-none mt-12 mb-6 pointer-events-none"
        aria-hidden
      >
        <p
          className="font-serif uppercase text-transparent text-center font-medium"
          style={{
            fontSize: "clamp(48px, 12vw, 150px)",
            letterSpacing: "-0.04em",
            WebkitTextStroke: "1px #DBD9F2",
          }}
        >
          MAKERSPACE
        </p>
      </div>

      {/* Copyright */}
      <div className="flex w-full max-w-7xl flex-col items-center justify-between gap-3 border-t border-zinc-100 pt-6 text-[10px] font-mono text-zinc-400 sm:flex-row">
        <span>© {currentYear} MIT World Peace University. All rights reserved.</span>
        <IgnisiaCredit />
      </div>
    </footer>
  );
}
