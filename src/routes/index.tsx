import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  Check,
  Cpu,
  GraduationCap,
  Printer,
  UsersRound,
  Wrench,
} from "lucide-react";
import heroImage from "@/assets/hero-makerspace.jpg";

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

function SignInLink({ className }: { className: string }) {
  return (
    <Link to="/login" className={className}>
      Sign in with MIT-WPU
      <ArrowRight className="size-5" />
    </Link>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-base font-bold tracking-tight">
            MIT-WPU <span className="text-primary">MakerSpace</span>
          </span>
          <SignInLink className="tap hidden items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold sm:inline-flex" />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Wrench className="size-3.5 text-primary" />
              MIT World Peace University
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
              Build ideas into working prototypes.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              MIT-WPU MakerSpace connects your project, team, Faculty Mentor and required resources
              to a verified MakerSpace visit—without adding unnecessary administrative steps.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SignInLink className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Access is for authorized MIT-WPU institutional accounts.
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

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-16">
            <div>
              <p className="text-sm font-semibold text-primary">One guided journey</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                From an idea to time in the MakerSpace.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The platform carries project context forward, so your team does not have to
                repeatedly provide information the university already knows.
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {journey.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Made for hands-on work</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Explore the resources your project needs.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              MakerSpace resources are configured by the university. These are representative areas
              of work; availability is shown when you plan your project and book a visit.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resourceAreas.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card-surface p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
            <div>
              <p className="text-sm font-semibold text-primary">Access MakerSpace</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Start with your MIT-WPU account.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Sign in with your institutional account to create a project, collaborate with your
                team and access the MakerSpace workflow.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                [GraduationCap, "Sign in", "Use your authorized MIT-WPU institutional account."],
                [
                  UsersRound,
                  "Set up your project",
                  "Add your team, Faculty Mentor and expected resources.",
                ],
                [
                  CalendarClock,
                  "Plan your visit",
                  "Book a verified project slot when you are ready to build.",
                ],
              ].map(([Icon, title, body]) => {
                const StepIcon = Icon as typeof GraduationCap;
                return (
                  <li
                    key={title as string}
                    className="flex gap-3 rounded-xl border border-border bg-background p-4"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                      <StepIcon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{title as string}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{body as string}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="card-surface grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Check className="size-4" />
                MIT-WPU MakerSpace Management Platform
              </span>
              <h2 className="mt-2 text-2xl font-bold">Ready to start your next project?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with your MIT-WPU account to begin.
              </p>
            </div>
            <SignInLink className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90" />
          </div>
        </section>
      </main>

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
