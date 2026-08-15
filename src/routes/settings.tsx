import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAuthenticated } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";
export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuthenticated,
  component: Settings,
});
function Settings() {
  const { client } = useAuth();
  const navigate = useNavigate();
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
      <button
        type="button"
        onClick={() => void client.logout().then(() => navigate({ to: "/" }))}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive sm:w-auto"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </AppShell>
  );
}
