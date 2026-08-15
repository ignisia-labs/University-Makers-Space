import { Link, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Footprints,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
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
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const { profile, role, setRole, notifications } = useMakerSpace();
  const [roleOpen, setRoleOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initials = profile.fullName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  const nav =
    role === "Student"
      ? studentNav
      : ([
          {
            to:
              role === "Faculty Mentor"
                ? "/faculty"
                : role === "Lab Assistant"
                  ? "/operations"
                  : role === "Admin"
                    ? "/admin"
                    : "/super-admin",
            label:
              role === "Faculty Mentor"
                ? "Faculty"
                : role === "Lab Assistant"
                  ? "Operations"
                  : role,
            icon: LayoutDashboard,
          },
        ] as const);
  const unread = notifications.filter((item) => !item.read).length;
  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] md:flex",
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
            <span className="font-display text-sm font-bold tracking-tight text-sidebar-foreground">
              MIT-WPU MakerSpace
            </span>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn(
                  "tap flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" />
                {expanded && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          {expanded && (
            <div className="mb-3 flex gap-1">
              <Link
                to="/notifications"
                className="tap relative grid place-items-center rounded-xl px-2 hover:bg-sidebar-accent"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />
                )}
              </Link>
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
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
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
            <div className="relative mt-3">
              <button
                type="button"
                onClick={() => setRoleOpen((value) => !value)}
                className="flex min-h-10 w-full items-center justify-between rounded-lg bg-muted px-3 text-xs font-semibold"
              >
                Prototype role: {role}
                <ChevronDown className="size-3" />
              </button>
              {roleOpen && (
                <div className="absolute bottom-11 z-40 w-full rounded-xl border border-border bg-card p-1 shadow-lg">
                  {(
                    ["Student", "Faculty Mentor", "Lab Assistant", "Admin", "Super Admin"] as const
                  ).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setRole(item);
                        setRoleOpen(false);
                      }}
                      className="block min-h-9 w-full rounded-lg px-2 text-left text-xs hover:bg-accent"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <div className={cn("transition-[padding]", expanded ? "md:pl-60" : "md:pl-[4.5rem]")}>
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1>
              {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground md:hidden">
              {initials}
            </span>
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative hidden size-10 place-items-center rounded-full bg-accent text-accent-foreground md:grid"
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 md:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => {
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
          })}
        </ul>
      </nav>
    </div>
  );
}
