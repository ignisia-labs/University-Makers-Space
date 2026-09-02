import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Footprints,
  Bell,
  LogOut,
  Settings,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IgnisiaCredit } from "@/components/IgnisiaCredit";
import type { AppRole } from "@/lib/roles";
import { roleHomes, useAppSession } from "@/lib/auth-context";
import { notificationsApi } from "@/lib/api";
import { projectKeys, usePersistedNotifications } from "@/lib/project-queries";

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/book", label: "Slots", icon: CalendarClock },
  { to: "/visits", label: "Visits", icon: Footprints },
  { to: "/equipment", label: "Equipment", icon: Boxes },
] as const;
export function AppShell({
  title,
  subtitle,
  children,
  workspaceNavigation,
  activeWorkspace,
  onWorkspaceChange,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  workspaceNavigation?: readonly {
    id: string;
    label: string;
    icon: LucideIcon;
  }[];
  activeWorkspace?: string;
  onWorkspaceChange?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsMounted, setNotificationsMounted] = useState(false);
  const { profile, role, authenticated, onboarded, hydrated, signOut } = useAppSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const persistedNotifications = usePersistedNotifications(authenticated);
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.notifications }),
  });

  // Send signed-out visitors back to the landing page rather than showing a wall.
  useEffect(() => {
    if (!hydrated) return;
    if (!authenticated) navigate({ to: "/", replace: true });
    else if (!onboarded) navigate({ to: "/onboarding", replace: true });
  }, [hydrated, authenticated, onboarded, navigate]);
  const initials = profile.fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  const studentOnly = [
    "/dashboard",
    "/projects",
    "/book",
    "/bookings",
    "/visits",
    "/equipment",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const requiredRole = pathname.startsWith("/faculty")
    ? "Faculty Mentor"
    : pathname.startsWith("/operations")
      ? "Lab Assistant"
      : pathname.startsWith("/super-admin")
        ? "Super Admin"
        : pathname.startsWith("/admin")
          ? "Admin"
          : studentOnly
            ? "Student"
            : null;
  const workspaceDenied = requiredRole !== null && !canOpenWorkspace(role, requiredRole);

  const showSidebar = role === "Student" || (workspaceNavigation?.length ?? 0) > 1;
  const notifications = (persistedNotifications.data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    href: item.href ?? roleHomes[role],
    read: item.isRead,
    createdAt: new Date(item.createdAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  }));
  const unread = notifications.filter((item) => !item.read).length;
  const markNotificationRead = (id: string) => markReadMutation.mutate(id);
  const markAllNotificationsRead = async () => {
    await Promise.all(
      notifications
        .filter((item) => !item.read)
        .map((item) => notificationsApi.markRead(item.id, true)),
    );
    await queryClient.invalidateQueries({ queryKey: projectKeys.notifications });
  };
  const openNotifications = () => {
    setNotificationsMounted(true);
    window.requestAnimationFrame(() => setNotificationsOpen(true));
  };
  const closeNotifications = () => setNotificationsOpen(false);
  const toggleNotifications = () => {
    if (notificationsOpen) closeNotifications();
    else openNotifications();
  };
  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Restoring your secure session...
      </main>
    );
  }
  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="card-surface max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your MIT-WPU institutional account to continue.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Go to landing page
          </Link>
        </section>
      </main>
    );
  }
  if (workspaceDenied) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="card-surface max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your MIT-WPU account does not have permission to open this workspace.
          </p>
          <Link
            to={roleHomes[role]}
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Go to dashboard
          </Link>
        </section>
      </main>
    );
  }
  return (
    <div className="min-h-screen overflow-x-hidden bg-background relative">
      {/* Single, very subtle indigo ambience */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-[25%] left-1/2 aspect-square w-[70%] -translate-x-1/2 rounded-full blur-[160px] opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #1E2B8A 0%, transparent 70%)" }}
        />
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] md:flex",
          !showSidebar && "md:hidden",
          expanded ? "w-60" : "w-[4.5rem]",
        )}
      >
        <div className="flex items-center gap-2 px-3 py-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className="tap grid place-items-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="size-5" />
          </button>
          {expanded && (
            <span className="flex min-w-0 items-center gap-2.5">
              <img
                src="/mitwpu-logo.jpg"
                alt="MIT World Peace University"
                width={431}
                height={124}
                className="h-6 w-auto shrink-0"
              />
              <span className="wordmark truncate text-base font-normal tracking-wide text-zinc-800">
                सृजन
              </span>
            </span>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {role === "Student"
            ? studentNav.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-label={label}
                    className={cn(
                      "tap flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {expanded && <span className="truncate">{label}</span>}
                  </Link>
                );
              })
            : workspaceNavigation?.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onWorkspaceChange?.(id)}
                  aria-label={label}
                  aria-current={activeWorkspace === id ? "page" : undefined}
                  className={cn(
                    "tap flex items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors",
                    activeWorkspace === id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {expanded && <span className="truncate">{label}</span>}
                </button>
              ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {expanded && (
            <div className="mb-3 flex gap-1">
              <Link
                to="/profile"
                className="tap grid place-items-center rounded-xl px-2 hover:bg-sidebar-accent"
                aria-label="Profile"
              >
                <UserRound className="size-4" />
              </Link>
              <Link
                to="/settings"
                className="tap grid place-items-center rounded-xl px-2 hover:bg-sidebar-accent"
                aria-label="Settings"
              >
                <Settings className="size-4" />
              </Link>
            </div>
          )}
          <div className="flex items-center gap-3 px-2 py-1">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {initials}
            </span>
            {expanded && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.prn ? `PRN ${profile.prn}` : role}
                </p>
              </div>
            )}
          </div>
          {expanded && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-3 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          )}
          {expanded && <IgnisiaCredit className="mt-3 px-3" />}
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding] relative z-10",
          showSidebar && (expanded ? "md:pl-60" : "md:pl-[4.5rem]"),
        )}
      >
        <header
          className={cn(
            "sticky top-0 border-b border-border bg-background/95 backdrop-blur",
            notificationsMounted ? "z-40" : "z-20",
          )}
        >
          <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-2xl sm:text-3xl font-serif font-light text-[#0F172A] tracking-wide">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-[10px] font-mono tracking-widest uppercase text-zinc-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                aria-label="Profile"
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground",
                  showSidebar && "md:hidden",
                )}
              >
                {initials}
              </Link>
              {!showSidebar && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={toggleNotifications}
                  aria-label="Notifications"
                  aria-haspopup="dialog"
                  aria-expanded={notificationsOpen}
                  className="relative grid size-11 place-items-center rounded-full bg-accent text-accent-foreground transition-all duration-200 hover:bg-accent/75"
                >
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />
                  )}
                </button>

                {notificationsMounted && (
                  <>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      className={cn(
                        "fixed inset-0 z-40 cursor-default bg-foreground/10 transition-opacity duration-200 ease-out",
                        notificationsOpen ? "opacity-100" : "pointer-events-none opacity-0",
                      )}
                      onClick={closeNotifications}
                    />
                    <section
                      role="dialog"
                      aria-modal="false"
                      aria-labelledby="notification-panel-title"
                      onTransitionEnd={(event) => {
                        if (
                          event.propertyName === "opacity" &&
                          !notificationsOpen &&
                          event.currentTarget === event.target
                        ) {
                          setNotificationsMounted(false);
                        }
                      }}
                      className={cn(
                        "absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm origin-top-right overflow-hidden rounded-2xl border bg-card shadow-2xl transition-[opacity,transform] duration-200 ease-out",
                        notificationsOpen
                          ? "scale-100 opacity-100"
                          : "pointer-events-none scale-95 opacity-0",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
                        <div>
                          <h2 id="notification-panel-title" className="font-semibold">
                            Notifications
                          </h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {unread ? `${unread} unread` : "You're all caught up"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeNotifications}
                          aria-label="Close notifications"
                          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="max-h-[min(60vh,30rem)] overflow-y-auto p-2">
                        {notifications.length ? (
                          notifications.map((item) => (
                            <a
                              key={item.id}
                              href={item.href}
                              onClick={() => {
                                markNotificationRead(item.id);
                                closeNotifications();
                              }}
                              className={cn(
                                "block rounded-xl px-3 py-3 transition-colors hover:bg-muted",
                                !item.read && "bg-primary/5",
                              )}
                            >
                              <span className="flex items-start gap-3">
                                <span
                                  className={cn(
                                    "mt-1.5 size-2 shrink-0 rounded-full",
                                    item.read ? "bg-border" : "bg-primary",
                                  )}
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold">{item.title}</span>
                                  <span className="mt-1 block text-sm text-muted-foreground">
                                    {item.body}
                                  </span>
                                  <span className="mt-1.5 block text-xs text-muted-foreground">
                                    {item.createdAt}
                                  </span>
                                </span>
                              </span>
                            </a>
                          ))
                        ) : (
                          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                            No notifications yet.
                          </p>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="border-t p-3">
                          <button
                            type="button"
                            onClick={() => void markAllNotificationsRead()}
                            disabled={!unread}
                            className="min-h-11 w-full rounded-xl text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:text-muted-foreground disabled:hover:bg-transparent"
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto max-w-5xl px-4 pt-5 sm:px-6 md:pb-12",
            showSidebar ? "pb-[calc(7rem+env(safe-area-inset-bottom))]" : "pb-12",
          )}
        >
          {children}
        </main>
      </div>

      {showSidebar && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
          aria-label="Primary"
        >
          <div className="glass-bar relative overflow-hidden rounded-[1.75rem] p-1.5">
            <ul
              className="relative grid"
              style={{
                gridTemplateColumns: `repeat(${role === "Student" ? studentNav.length : (workspaceNavigation?.length ?? 1)}, minmax(0, 1fr))`,
              }}
            >
              {role === "Student"
                ? studentNav.map(({ to, label, icon: Icon }) => {
                    const active = pathname === to;
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          aria-label={label}
                          className={cn(
                            "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.35rem] text-[10px] font-medium transition-colors duration-300",
                            active ? "text-primary-foreground" : "text-muted-foreground",
                          )}
                        >
                          {active && (
                            <span
                              className="absolute inset-0 rounded-[1.35rem] bg-primary shadow-[0_6px_20px_-6px_color-mix(in_oklch,var(--color-primary)_70%,transparent)]"
                              aria-hidden
                            />
                          )}
                          <Icon className="relative size-5" />
                          <span className="relative">{label}</span>
                        </Link>
                      </li>
                    );
                  })
                : workspaceNavigation?.map(({ id, label, icon: Icon }) => {
                    const active = activeWorkspace === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => onWorkspaceChange?.(id)}
                          aria-label={label}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 text-[10px] font-medium transition-colors duration-300",
                            active ? "text-primary-foreground" : "text-muted-foreground",
                          )}
                        >
                          {active && (
                            <span
                              className="absolute inset-0 rounded-[1.35rem] bg-primary"
                              aria-hidden
                            />
                          )}
                          <Icon className="relative size-5" />
                          <span className="relative max-w-full truncate">{label}</span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * Which workspaces each role may open.
 *
 * Seniority is not a straight line — a Faculty Mentor is not "below" a Lab
 * Assistant, they simply do different jobs — so this is an explicit grant table
 * rather than a numeric rank comparison. A Super Admin can open everything by
 * definition; an Admin also runs the operations console.
 *
 * This governs navigation only. Every request is still authorised server-side
 * against the permission model, so widening a workspace here can never widen
 * what the account is actually allowed to do.
 */
const workspaceGrants: Record<AppRole, readonly AppRole[]> = {
  "Super Admin": ["Super Admin", "Admin", "Lab Assistant", "Faculty Mentor", "Student"],
  Admin: ["Admin", "Lab Assistant"],
  "Lab Assistant": ["Lab Assistant"],
  "Faculty Mentor": ["Faculty Mentor"],
  Student: ["Student"],
};

function canOpenWorkspace(role: AppRole, required: AppRole) {
  return workspaceGrants[role]?.includes(required) ?? false;
}
