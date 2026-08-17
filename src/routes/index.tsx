import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  Cpu,
  Printer,
  Wrench,
} from "lucide-react";
import heroImage from "@/assets/hero-makerspace.jpg";
import bgVideo from "../../Assets/gemini_generated_video_ab04e635.mp4";
import { GuidedJourney } from "@/components/GuidedJourney";
import { ResourcesCarousel } from "@/components/ResourcesCarousel";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MIT-WPU MakerSpace — Build, Prototype, Iterate" },
      {
        name: "description",
        content:
          "MIT-WPU MakerSpace helps students take a project from idea and mentorship to verified resources, slot booking and a physical visit.",
      },
      { property: "og:title", content: "MIT-WPU MakerSpace — Build, Prototype, Iterate" },
      {
        property: "og:description",
        content:
          "Move your project from idea to MakerSpace visit with institutional access, team collaboration and verified booking.",
      },
    ],
  }),
  component: Landing,
});

const resourceAreas = [
  {
    icon: Printer,
    title: "Prototyping & fabrication",
    body: "Bring physical ideas to life through configured fabrication resources.",
  },
  {
    icon: Cpu,
    title: "Electronics & IoT",
    body: "Develop connected prototypes with electronics and embedded resources.",
  },
  {
    icon: Wrench,
    title: "Robotics & mechanical work",
    body: "Build, test and refine systems for engineering projects.",
  },
  {
    icon: Boxes,
    title: "CAD, computing & measurement",
    body: "Use the resources your project needs to design, evaluate and iterate.",
  },
];

const journey = [
  "Create your project",
  "Build your team",
  "Choose a Faculty Mentor",
  "Identify required resources",
  "Get your project verified",
  "Book a MakerSpace slot",
  "Visit and build",
];

import { ClubHero } from "@/components/ClubHero";

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <ClubHero />

      <main>

        <GuidedJourney />

        <ResourcesCarousel />





      </main>

      <SiteFooter />
    </div>
  );
}
