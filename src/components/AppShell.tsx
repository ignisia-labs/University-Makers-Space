import { Link, useRouterState } from "@tanstack/react-router";
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
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMakerSpace } from "@/lib/makerspace-context";

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
  const {
    profile,
    role,
    notifications,
    authenticated,
    signOut,
    markNotificationRead,
    markAllNotificationsRead,
  } = useMakerSpace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initials = profile.fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  const requiredRole = pathname.startsWith("/faculty")
    ? "Faculty Mentor"
    : pathname.startsWith("/operations")
      ? "Lab Assistant"
      : pathname.startsWith("/super-admin")
        ? "Super Admin"
        : pathname.startsWith("/admin")
          ? "Admin"
          : null;

  const showSidebar = role === "Student" || (workspaceNavigation?.length ?? 0) > 1;
  const unread = notifications.filter((item) => !item.read).length;
  const openNotifications = () => {
    setNotificationsMounted(true);
    window.requestAnimationFrame(() => setNotificationsOpen(true));
  };
  const closeNotifications = () => setNotificationsOpen(false);
  const toggleNotifications = () => {
    if (notificationsOpen) closeNotifications();
    else openNotifications();
  };
  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="card-surface max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your MIT-WPU institutional account to continue.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }
  if (requiredRole && role !== requiredRole) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <section className="card-surface max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your MIT-WPU account does not have permission to open this workspace.
          </p>
          <Link
            to="/dashboard"
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
      {/* Floating Ambient Aura Blurs — Ignisia palette */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Ignisia Teal Aura — top left */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[60%] aspect-square rounded-full mix-blend-multiply filter blur-[140px] opacity-[0.07] animate-pulse"
          style={{
            background: "radial-gradient(circle, #2CC5B0 0%, transparent 70%)",
            animationDuration: "14s",
          }}
        />
        {/* Ignisia Indigo-Purple Aura — bottom right */}
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[60%] aspect-square rounded-full mix-blend-multiply filter blur-[140px] opacity-[0.08] animate-pulse"
          style={{
            background: "radial-gradient(circle, #6D28D9 0%, transparent 70%)",
            animationDuration: "18s",
          }}
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
            <span className="font-serif text-sm font-light tracking-wide text-zinc-800">
              MIT-WPU MakerSpace
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

        {/* Ignisia branding badge */}
        {expanded && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/60 to-violet-50/40 px-3 py-2">
            {/* Ignisia logomark — simplified teal molecular node */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
              <rect x="2" y="2" width="5" height="5" rx="1.5" fill="#2CC5B0" />
              <rect x="11" y="2" width="5" height="5" rx="1.5" fill="#2CC5B0" />
              <rect x="6.5" y="6.5" width="5" height="5" rx="1.5" fill="#2CC5B0" opacity="0.7" />
              <rect x="2" y="11" width="5" height="5" rx="1.5" fill="#2CC5B0" />
              <rect x="11" y="11" width="5" height="5" rx="1.5" fill="#2CC5B0" />
            </svg>
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-widest text-indigo-400/80">
                an
              </p>
              <p className="-mt-0.5 font-serif text-xs font-semibold italic text-indigo-800">
                Ignisia
              </p>
              <p className="text-[8px] font-mono uppercase tracking-widest text-indigo-400/80">
                project
              </p>
            </div>
          </div>
        )}
        {!expanded && (
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-xl border border-indigo-100/80 bg-indigo-50/60">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1.5" fill="#2CC5B0" />
              <rect x="11" y="2" width="5" height="5" rx="1.5" fill="#2CC5B0" />
              <rect x="6.5" y="6.5" width="5" height="5" rx="1.5" fill="#2CC5B0" opacity="0.7" />
              <rect x="2" y="11" width="5" height="5" rx="1.5" fill="#2CC5B0" />
              <rect x="11" y="11" width="5" height="5" rx="1.5" fill="#2CC5B0" />
            </svg>
          </div>
        )}

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
                <p className="truncate text-xs text-muted-foreground">PRN {profile.prn}</p>
              </div>
            )}
          </div>
          {expanded && (
            <button
              type="button"
              onClick={signOut}
              className="mt-3 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          )}
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
                  onClick={signOut}
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
                            <Link
                              key={item.id}
                              to={item.href as "/projects"}
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
                            </Link>
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
                            onClick={markAllNotificationsRead}
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
            showSidebar ? "pb-28" : "pb-12",
          )}
        >
          {children}
        </main>
      </div>

      {showSidebar && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
          <ul
            className="grid"
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
                          "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-5" />
                        {label}
                      </Link>
                    </li>
                  );
                })
              : workspaceNavigation?.map(({ id, label, icon: Icon }) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onWorkspaceChange?.(id)}
                      aria-label={label}
                      aria-current={activeWorkspace === id ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                        activeWorkspace === id ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="max-w-full truncate">{label}</span>
                    </button>
                  </li>
                ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
