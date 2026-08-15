import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
export const Route = createFileRoute("/settings")({ component: Settings });
function Settings() {
  return (
    <AppShell title="Settings" subtitle="Preferences">
      <section className="card-surface divide-y p-2">
        <label className="flex min-h-14 items-center justify-between px-3 text-sm font-medium">
          Booking reminders
          <input type="checkbox" defaultChecked className="size-5" />
        </label>
        <label className="flex min-h-14 items-center justify-between px-3 text-sm font-medium">
          Product updates
          <input type="checkbox" defaultChecked className="size-5" />
        </label>
      </section>
    </AppShell>
  );
}
