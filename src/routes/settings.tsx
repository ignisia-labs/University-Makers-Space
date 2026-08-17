import { createFileRoute } from "@tanstack/react-router";
import { BellRing, CalendarClock, CircleCheck, FolderKanban, PackageSearch } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { useMakerSpace, type NotificationPreferences } from "@/lib/makerspace-context";

export const Route = createFileRoute("/settings")({ component: Settings });

const preferences: {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: typeof BellRing;
}[] = [
  {
    key: "projectActivity",
    title: "Project and team activity",
    description: "Invitations, team responses, and Faculty Mentor decisions.",
    icon: FolderKanban,
  },
  {
    key: "bookingUpdates",
    title: "Booking and visit updates",
    description: "Booking confirmations, cancellations, and attendance updates.",
    icon: CalendarClock,
  },
  {
    key: "equipmentUpdates",
    title: "Equipment availability",
    description: "Changes that affect resources required by your project.",
    icon: PackageSearch,
  },
  {
    key: "systemAnnouncements",
    title: "MakerSpace announcements",
    description: "Operational notices, closures, and important service updates.",
    icon: BellRing,
  },
];

function Settings() {
  const { notificationPreferences, updateNotificationPreferences } = useMakerSpace();
  const [saved, setSaved] = useState(false);

  const update = (key: keyof NotificationPreferences, checked: boolean) => {
    updateNotificationPreferences({ [key]: checked });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <AppShell title="Settings" subtitle="Notification preferences">
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <section className="card-surface overflow-hidden">
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">In-app notifications</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Choose the MakerSpace updates you want to see in your notification centre.
                </p>
              </div>
              {saved && (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-success">
                  <CircleCheck className="size-4" /> Saved
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-border">
            {preferences.map(({ key, title, description, icon: Icon }) => (
              <label
                key={key}
                className="flex min-h-[84px] cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/35 sm:px-6"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                  </span>
                </span>
                <Switch
                  checked={notificationPreferences[key]}
                  onCheckedChange={(checked) => update(key, checked)}
                  aria-label={title}
                  className="h-6 w-11 data-[state=checked]:bg-primary [&>span]:h-5 [&>span]:w-5 data-[state=checked]:[&>span]:translate-x-5"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="card-surface overflow-hidden">
          <div className="flex min-h-[84px] items-center gap-4 px-5 py-4 sm:px-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
              <CalendarClock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Email booking reminders</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Receive optional reminders before a confirmed MakerSpace slot.
              </p>
            </div>
            <Switch
              checked={notificationPreferences.emailBookingReminders}
              onCheckedChange={(checked) => update("emailBookingReminders", checked)}
              aria-label="Email booking reminders"
              className="h-6 w-11 data-[state=checked]:bg-primary [&>span]:h-5 [&>span]:w-5 data-[state=checked]:[&>span]:translate-x-5"
            />
          </div>
        </section>

        <p className="px-1 text-xs leading-5 text-muted-foreground">
          Project decisions, booking changes, and other critical workflow information remain visible
          in the application when relevant. Profile, help, and sign-out are available separately in
          the account navigation.
        </p>
      </div>
    </AppShell>
  );
}
