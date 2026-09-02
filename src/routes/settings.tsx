import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CalendarCheck, Check, FolderKanban } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAppSession } from "@/lib/auth-context";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — सृजन" },
      { name: "description", content: "Your account and what the MakerSpace notifies you about." },
    ],
  }),
  component: SettingsPage,
});

const notified = [
  {
    icon: FolderKanban,
    title: "Project and team activity",
    description: "Invitations, team responses, and Faculty Mentor decisions.",
  },
  {
    icon: CalendarCheck,
    title: "Booking and visit updates",
    description: "Confirmations, cancellations, no-shows, and attendance changes.",
  },
  {
    icon: BellRing,
    title: "MakerSpace announcements",
    description: "Operational notices and closures that affect your bookings.",
  },
];

/**
 * Account and notifications.
 *
 * There are no toggles here, because none of them would do anything yet.
 * Everything listed concerns a project, booking or visit the person is part of,
 * so it is delivered to everyone — and the page says exactly that rather than
 * offering switches that silently ignore you.
 */
function SettingsPage() {
  const { profile } = useAppSession();
  return (
    <AppShell title="Settings" subtitle="Account and notifications">
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <section className="card-surface p-5 sm:p-6">
          <h2 className="text-base font-semibold">Account</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="text-sm font-medium">{profile.fullName}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Institutional email</dt>
              <dd className="truncate text-sm font-medium">{profile.email}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Your name and email come from your MIT-WPU Google account and are kept in step at every
            sign-in.
          </p>
        </section>

        <section className="card-surface overflow-hidden">
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <h2 className="text-base font-semibold">What you are notified about</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              These reach you in the notification centre and by email at your institutional address.
            </p>
          </div>
          <div className="divide-y divide-border">
            {notified.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
                <Check className="size-4 shrink-0 text-success" aria-label="Delivered" />
              </div>
            ))}
          </div>
        </section>

        <p className="px-1 text-xs leading-5 text-muted-foreground">
          Choosing which of these you receive is not available yet. Everything above concerns a
          project, booking, or visit you are part of, so it is delivered to everyone for now.
        </p>
      </div>
    </AppShell>
  );
}
