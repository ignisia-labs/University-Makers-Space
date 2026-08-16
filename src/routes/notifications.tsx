import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAuthenticated } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export const Route = createFileRoute("/notifications")({
  beforeLoad: requireAuthenticated,
  component: Notifications,
});

function Notifications() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => client.api.requestPage<Notification[]>("/notifications?limit=50&order=desc"),
  });
  const markRead = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      client.api.request(`/notifications/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ isRead }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const rows = notifications.data?.data ?? [];
  const unread = rows.filter((notification) => !notification.isRead);

  return (
    <AppShell title="Notifications" subtitle={`${unread.length} unread on this page`}>
      {unread.length > 0 && (
        <button
          type="button"
          onClick={() =>
            unread.forEach((notification) => markRead.mutate({ id: notification.id, isRead: true }))
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
        >
          <CheckCheck className="size-4" /> Mark this page read
        </button>
      )}
      {notifications.isLoading && (
        <div className="mt-4 grid min-h-48 place-items-center rounded-2xl border border-border bg-card">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Loading notifications…
          </p>
        </div>
      )}
      {notifications.data && rows.length === 0 && (
        <div className="mt-4 grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <div>
            <Bell className="mx-auto size-7 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No notifications yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Project invitations and verification updates will appear here.
            </p>
          </div>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {rows.map((notification) => (
          <a
            key={notification.id}
            href={notification.href ?? "/notifications"}
            onClick={() => {
              if (!notification.isRead) markRead.mutate({ id: notification.id, isRead: true });
            }}
            className={`card-surface block p-4 ${notification.isRead ? "opacity-70" : "border-primary/40"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{notification.title}</p>
              {!notification.isRead && (
                <span
                  className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                  aria-label="Unread"
                />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDateTime(notification.createdAt)}
            </p>
          </a>
        ))}
      </div>
    </AppShell>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
