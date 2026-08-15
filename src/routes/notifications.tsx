import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMakerSpace } from "@/lib/makerspace-context";
import { requireAuthenticated } from "@/lib/auth-guards";
export const Route = createFileRoute("/notifications")({
  beforeLoad: requireAuthenticated,
  component: Notifications,
});
function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useMakerSpace();
  return (
    <AppShell
      title="Notifications"
      subtitle={`${notifications.filter((n) => !n.read).length} unread`}
    >
      <button
        onClick={markAllNotificationsRead}
        className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
      >
        Mark all read
      </button>
      <div className="mt-4 space-y-3">
        {notifications.map((n) => (
          <Link
            key={n.id}
            to={n.href as "/projects"}
            onClick={() => markNotificationRead(n.id)}
            className={`card-surface block p-4 ${n.read ? "opacity-70" : "border-primary/40"}`}
          >
            <p className="font-semibold">{n.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">{n.createdAt}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
