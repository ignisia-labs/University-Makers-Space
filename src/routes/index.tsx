import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Cpu, Printer, Wrench, ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-makerspace.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MIT-WPU MakerSpace — Build, Prototype, Iterate" },
      {
        name: "description",
        content:
          "Book slots, manage projects and explore 3D printing, laser, electronics and robotics equipment at the MIT-WPU MakerSpace.",
      },
      { property: "og:title", content: "MIT-WPU MakerSpace — Build, Prototype, Iterate" },
      {
        property: "og:description",
        content:
          "Book slots, manage projects and explore 3D printing, laser, electronics and robotics equipment at the MIT-WPU MakerSpace.",
      },
    ],
  }),
  component: Landing,
});

const capabilities = [
  {
    icon: Printer,
    title: "3D Printing",
    body: "FDM and resin printers for fast, accurate prototypes.",
  },
  {
    icon: Cpu,
    title: "Electronics & IoT",
    body: "Benches, scopes and sensor kits for connected builds.",
  },
  {
    icon: Wrench,
    title: "Rapid Prototyping",
    body: "Laser cutting, CNC and fabrication for real hardware.",
  },
  {
    icon: Boxes,
    title: "Robotics",
    body: "Arms, drive kits and test rigs for autonomous systems.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-base font-bold tracking-tight">
            MIT-WPU <span className="text-primary">MakerSpace</span>
          </span>
          <Link
            to="/login"
            className="tap hidden items-center rounded-xl border border-border px-4 text-sm font-semibold sm:inline-flex sm:py-2"
          >
            Student sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            School of Engineering · Pune
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            Where student ideas become working hardware.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Register your project, get mentor verification, reserve a capacity-aware slot and walk
            into a fully equipped lab for rapid prototyping, 3D printing, electronics and IoT.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in with MIT-WPU (@mitwpu.edu.in)
              <ArrowRight className="size-5" />
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Only verified @mitwpu.edu.in institutional accounts can access the platform.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]">
          <img
            src={heroImage}
            alt="Students collaborating on a robotics build in the MIT-WPU MakerSpace"
            width={1600}
            height={1000}
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">Lab capabilities</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card-surface p-5 transition-shadow hover:shadow-lg">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="card-surface grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold">Four steps from idea to bench time</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create project → mentor verification → book a slot → visit the MakerSpace.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>MIT World Peace University · MakerSpace Management Platform</p>
        <p className="mt-1 text-[10px] tracking-wide text-muted-foreground/75">
          <a
            href="https://ignisia.tech"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            An <span className="font-semibold text-[#2938cf]">Ignisia</span> project
          </a>
        </p>
      </footer>
    </div>
  );
}
