import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, CalendarClock, Check, Footprints, Plus, CalendarDays, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Student dashboard — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Track your project verification progress, upcoming MakerSpace reservation and quick actions.",
      },
      { property: "og:title", content: "Student dashboard — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Your MakerSpace progress, reservations and quick actions.",
      },
    ],
  }),
  component: Dashboard,
});

const steps = ["Create Project", "Verification", "Book Slot", "Visit MakerSpace"];

const actions = [
  { to: "/projects", label: "New Project", icon: Plus },
  { to: "/book", label: "Book a Slot", icon: CalendarClock },
  { to: "/visits", label: "Quick Visit", icon: Footprints },
  { to: "/equipment", label: "Explore Equipment", icon: Boxes },
] as const;

function Dashboard() {
  const { profile, projects, reservations } = useMakerSpace();
  const upcoming = reservations.find((r) => r.status === "Active");
  const verified = projects.some((p) => p.status === "Verified");
  const currentStep = upcoming ? 3 : verified ? 2 : projects.length ? 1 : 0;

  return (
    <AppShell
      title={`Hi, ${profile.fullName.split(" ")[0]}`}
      subtitle={`${profile.programme} · ${profile.academicYear} · ${profile.department}`}
    >
      <div className="space-y-6">
        <section className="card-surface p-5 sm:p-6">
          <h2 className="text-base font-semibold">Your MakerSpace journey</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-4">
            {steps.map((step, index) => {
              const done = index < currentStep;
              const active = index === currentStep;
              return (
                <li key={step} className="flex items-center gap-3 sm:block">
                  <div className="flex items-center gap-2 sm:w-full">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold",
                        done && "border-success bg-success text-success-foreground",
                        active && "border-primary bg-primary text-primary-foreground",
                        !done && !active && "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "hidden h-1 flex-1 rounded-full sm:block",
                        done ? "bg-success" : "bg-border",
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-sm font-medium sm:mt-3",
                      active || done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Upcoming reservation</h2>
          {upcoming ? (
            <article className="card-surface p-5 sm:p-6">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{upcoming.projectName}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4" /> {upcoming.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-4" /> {upcoming.slot}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" /> {upcoming.attendees} attending
                    </span>
                  </p>
                </div>
                <StatusBadge label={upcoming.status} />
              </div>
              <Link
                to="/book"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-accent"
              >
                Manage booking
              </Link>
            </article>
          ) : (
            <article className="card-surface p-6 text-center">
              <p className="text-sm text-muted-foreground">No upcoming reservation yet.</p>
              <Link
                to="/book"
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Book a slot
              </Link>
            </article>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {actions.map(({ to, label, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="card-surface flex min-h-24 flex-col justify-between p-4 transition-shadow hover:shadow-lg"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="mt-3 text-sm font-semibold">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
