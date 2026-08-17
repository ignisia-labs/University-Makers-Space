import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "@/components/landing/HeroSection";
import { AboutSection } from "@/components/landing/AboutSection";
import { EquipmentSection } from "@/components/landing/EquipmentSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MIT-WPU MakerSpace — Prototyping Laboratory" },
      {
        name: "description",
        content: "MIT-WPU MakerSpace rapid prototyping and hardware engineering laboratory.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F0EFFF] text-[#0F172A] flex flex-col selection:bg-[#1E2B8A]/10 selection:text-[#1E2B8A]">
      <main className="flex-1">
        {/* Cinematic Widescreen Video Hero with Serif overlays */}
        <HeroSection />

        {/* Parallax About Section with Visual Floor Plan SVG */}
        <AboutSection />

        {/* Immersive Equipment Grid */}
        <EquipmentSection />
      </main>

      {/* Done - Minimalist Footer */}
      <LandingFooter />
    </div>
  );
}
