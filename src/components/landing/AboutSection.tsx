import heroImage from "@/assets/hero-makerspace.jpg";

export function AboutSection() {
  return (
    <section className="relative w-full bg-[#F0EFFF] py-24 px-6 md:px-12 border-t border-zinc-200/50">
      <div className="mx-auto max-w-5xl text-center">
        {/* Simple Label */}
        <p className="text-[10px] font-mono tracking-widest text-[#1E2B8A] uppercase font-semibold">
          01 // THE SPACE
        </p>

        {/* Clean, Elegant Serif Heading */}
        <h2 className="mt-4 text-4xl sm:text-5xl font-serif font-light text-[#0F172A] tracking-wide leading-tight">
          A physical hub for builders
        </h2>

        {/* Concise Introduction Text */}
        <p className="mt-6 text-sm sm:text-base text-zinc-500 max-w-2xl mx-auto leading-relaxed font-serif italic font-light">
          MIT-WPU MakerSpace is an open-access prototyping laboratory designed to bridge the gap
          between virtual designs and physical hardware. We provide the tools, workspace, and safety
          systems for students to engineer functional models.
        </p>

        {/* Massive, Premium Framed Image */}
        <div className="mt-14 rounded-3xl overflow-hidden border border-zinc-200 bg-[#F6F5F0] shadow-sm relative aspect-[16/9]">
          <img
            src={heroImage}
            alt="MIT-WPU MakerSpace Lab"
            className="w-full h-full object-cover opacity-95 transition-transform duration-700 hover:scale-101"
          />
        </div>

        {/* Clean, minimal summary list of zones */}
        <div className="mt-12 pt-8 border-t border-zinc-200/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-left">
          <div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Zone 01</p>
            <p className="mt-1 text-xs font-serif text-[#0F172A] font-semibold">
              Digital Fabrication
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Zone 02</p>
            <p className="mt-1 text-xs font-serif text-[#0F172A] font-semibold">
              Electronics Bench
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Zone 03</p>
            <p className="mt-1 text-xs font-serif text-[#0F172A] font-semibold">Robotics & IoT</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Zone 04</p>
            <p className="mt-1 text-xs font-serif text-[#0F172A] font-semibold">Assembly Tables</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Zone 05</p>
            <p className="mt-1 text-xs font-serif text-[#0F172A] font-semibold">Design & CAD</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Zone 06</p>
            <p className="mt-1 text-xs font-serif text-[#0F172A] font-semibold">Safety Systems</p>
          </div>
        </div>
      </div>
    </section>
  );
}
