import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, KeyRound, Search, ShieldCheck, UserPlus, UserRoundX } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { AppRole, AppUser } from "@/lib/makerspace-data";

export const Route = createFileRoute("/super-admin")({ component: SuperAdmin });

const roles: AppRole[] = ["Student", "Faculty Mentor", "Lab Assistant", "Admin", "Super Admin"];
const privilegedRoles: AppRole[] = ["Faculty Mentor", "Lab Assistant", "Admin", "Super Admin"];
const blankUser: Omit<AppUser, "id"> = {
  name: "",
  email: "",
  prn: "",
  role: "Faculty Mentor",
  active: true,
};

function SuperAdmin() {
  const { users, updateUserRole, provisionUser, updateUserActive, auditLogs } = useMakerSpace();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | AppRole>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [provisioning, setProvisioning] = useState(false);
  const [draft, setDraft] = useState(blankUser);
  const [draftError, setDraftError] = useState("");
  const [roleTarget, setRoleTarget] = useState<AppUser | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("Student");
  const [activeTarget, setActiveTarget] = useState<AppUser | null>(null);
  const [auditQuery, setAuditQuery] = useState("");
  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          `${user.name} ${user.email} ${user.prn ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (roleFilter === "All" || user.role === roleFilter) &&
          (statusFilter === "All" || (statusFilter === "Active" ? user.active : !user.active)),
      ),
    [users, query, roleFilter, statusFilter],
  );
  const filteredAudit = useMemo(
    () =>
      auditLogs.filter((event) =>
        `${event.action} ${event.actor} ${event.entity} ${event.timestamp}`
          .toLowerCase()
          .includes(auditQuery.toLowerCase()),
      ),
    [auditLogs, auditQuery],
  );
  function provision() {
    const email = draft.email.trim().toLowerCase();
    if (!draft.name.trim() || !email.endsWith("@mitwpu.edu.in")) {
      setDraftError("Enter a name and a valid @mitwpu.edu.in email address.");
      return;
    }
    if (users.some((user) => user.email.toLowerCase() === email)) {
      setDraftError("That institutional email is already provisioned.");
      return;
    }
    const user: Omit<AppUser, "id"> = { ...draft, name: draft.name.trim(), email };
    if (draft.prn?.trim()) user.prn = draft.prn.trim();
    provisionUser(user);
    setProvisioning(false);
    setDraft(blankUser);
    setDraftError("");
  }
  return (
    <AppShell
      title="Super Admin"
      subtitle="Institutional access, privileged roles and immutable audit history"
    >
      <section className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Institutional user directory</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by name, institutional email or PRN. Privileged roles are provisioned before
              first sign-in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(blankUser);
              setDraftError("");
              setProvisioning(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <UserPlus className="size-4" />
            Pre-provision user
          </button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email or PRN"
              className="form-input pl-10"
            />
          </label>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "All" | AppRole)}
            className="form-input lg:w-48"
          >
            <option>All</option>
            {roles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "All" | "Active" | "Inactive")
            }
            className="form-input lg:w-36"
          >
            <option>All</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {filteredUsers.length ? (
            filteredUsers.map((user) => (
              <article key={user.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{user.name}</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {user.email}
                      {user.prn ? ` · ${user.prn}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge label={user.role} />
                      <StatusBadge label={user.active ? "Active" : "Inactive"} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRoleTarget(user);
                        setNewRole(user.role);
                      }}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold"
                    >
                      <KeyRound className="size-3.5" />
                      Change role
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTarget(user)}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${user.active ? "border-destructive/40 text-destructive" : "border-success/40 text-success"}`}
                    >
                      {user.active ? (
                        <UserRoundX className="size-3.5" />
                      ) : (
                        <BadgeCheck className="size-3.5" />
                      )}
                      {user.active ? "Disable" : "Activate"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No institutional users match these filters.
            </div>
          )}
        </div>
      </section>
      <section className="mt-7 card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">System audit log</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit events are view-only in the interface.
            </p>
          </div>
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <label className="relative mt-4 block">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <input
            value={auditQuery}
            onChange={(event) => setAuditQuery(event.target.value)}
            placeholder="Search audit actions, actors or records"
            className="form-input pl-10"
          />
        </label>
        <div className="mt-4 space-y-2">
          {filteredAudit.length ? (
            filteredAudit.map((event) => (
              <article key={event.id} className="rounded-xl border p-3 text-sm">
                <strong>{event.action}</strong>
                <span className="mx-2 text-muted-foreground">{event.entity}</span>
                <span className="block mt-1 text-xs text-muted-foreground sm:inline sm:mt-0">
                  {event.actor} · {event.timestamp}
                </span>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No audit events match the current search. New administrative actions will appear here.
            </div>
          )}
        </div>
      </section>

      <ResponsiveModal
        open={provisioning}
        onOpenChange={setProvisioning}
        title="Pre-provision privileged user"
        description="Provision access before the person’s first MIT-WPU sign-in."
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Name
            <input
              value={draft.name}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                setDraftError("");
              }}
              className="form-input mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium">
            MIT-WPU email
            <input
              type="email"
              value={draft.email}
              onChange={(event) => {
                setDraft({ ...draft, email: event.target.value });
                setDraftError("");
              }}
              placeholder="name@mitwpu.edu.in"
              className="form-input mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium">
            PRN / staff identifier (optional)
            <input
              value={draft.prn ?? ""}
              onChange={(event) => setDraft({ ...draft, prn: event.target.value })}
              className="form-input mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium">
            Privileged role
            <select
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value as AppRole })}
              className="form-input mt-1.5"
            >
              {privilegedRoles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          {draftError && <p className="text-sm text-destructive">{draftError}</p>}
          <button
            type="button"
            onClick={provision}
            className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Provision access
          </button>
        </div>
      </ResponsiveModal>
      <ResponsiveModal
        open={!!roleTarget}
        onOpenChange={(open) => !open && setRoleTarget(null)}
        title="Change institutional role"
        description="Role changes are privileged actions and are recorded for audit."
      >
        {roleTarget && (
          <div className="space-y-4">
            <p className="text-sm">
              Change <strong>{roleTarget.name}</strong> from <strong>{roleTarget.role}</strong> to:
            </p>
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as AppRole)}
              className="form-input"
            >
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                updateUserRole(roleTarget.id, newRole);
                setRoleTarget(null);
              }}
              disabled={newRole === roleTarget.role}
              className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
            >
              Confirm role change
            </button>
          </div>
        )}
      </ResponsiveModal>
      <ResponsiveModal
        open={!!activeTarget}
        onOpenChange={(open) => !open && setActiveTarget(null)}
        title={activeTarget?.active ? "Disable user" : "Activate user"}
        description="This changes whether the institutional identity can access the platform."
      >
        {activeTarget && (
          <div className="space-y-4">
            <p className="text-sm">
              {activeTarget.active ? "Disable" : "Activate"} <strong>{activeTarget.name}</strong> (
              {activeTarget.email})?
            </p>
            <button
              type="button"
              onClick={() => {
                updateUserActive(activeTarget.id, !activeTarget.active);
                setActiveTarget(null);
              }}
              className={`min-h-12 w-full rounded-xl font-semibold ${activeTarget.active ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground"}`}
            >
              {activeTarget.active
                ? "Disable institutional access"
                : "Activate institutional access"}
            </button>
          </div>
        )}
      </ResponsiveModal>
    </AppShell>
  );
}
