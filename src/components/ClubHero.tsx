import { ArrowRight, ArrowUpRight, Boxes, CalendarClock, Download, Footprints, Wrench } from "lucide-react";
import { Link } from "@tanstack/react-router";
import bgVideo from "../../Assets/gemini_generated_video_ab04e635.mp4";

export function ClubHero() {
  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6">
      <div className="relative min-h-[85vh] w-full flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-background">
        
        {/* Autoplay, Looping Background Video with Bottom Mask Fade */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none [mask-image:linear-gradient(to_bottom,black_75%,transparent_100%)]">
          <video
            src={bgVideo}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </div>

        {/* Centered Hero Text */}
        <main className="relative z-20 flex flex-col items-center text-center my-auto px-4 py-12 max-w-4xl mx-auto">
          
          <h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] text-white tracking-tight select-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] [text-shadow:_0_2px_10px_rgba(0,0,0,0.5)]">
            Build ideas into<br className="hidden sm:block" /> working prototypes.
          </h1>
          
          <p className="mt-6 text-base font-medium sm:text-lg max-w-2xl leading-snug text-white select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] [text-shadow:_0_1px_8px_rgba(0,0,0,0.6)]">
            MIT-WPU MakerSpace connects your project, team, Faculty Mentor and required resources
            to a verified MakerSpace visit—without adding unnecessary administrative steps.
          </p>

        {/* 'Sign in with MIT-WPU' Pill CTA */}
        <Link
          to="/login"
          className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-8 text-base font-semibold text-white hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.15)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        >
          Sign in with MIT-WPU
          <ArrowRight className="size-5 text-white" />
        </Link>
      </main>

      </div>
    </div>
  );
}
