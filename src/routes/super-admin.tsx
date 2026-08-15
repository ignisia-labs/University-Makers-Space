import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMakerSpace } from "@/lib/makerspace-context";
import { type AppRole } from "@/lib/makerspace-data";
export const Route = createFileRoute("/super-admin")({ component: SuperAdmin });
function SuperAdmin() {
  const { users, updateUserRole, auditLogs } = useMakerSpace();
  const roles: AppRole[] = ["Student", "Faculty Mentor", "Lab Assistant", "Admin", "Super Admin"];
  return (
    <AppShell title="Super Admin" subtitle="People, roles and audit history">
      <section>
        <h2 className="mb-3 font-semibold">Institutional users</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <article key={u.id} className="card-surface grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => updateUserRole(u.id, e.target.value as AppRole)}
                className="h-10 rounded-xl border bg-card px-3 text-sm"
              >
                <>
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </>
              </select>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Audit log</h2>
        <div className="space-y-2">
          {auditLogs.length ? (
            auditLogs.map((log) => (
              <article key={log.id} className="card-surface p-3 text-sm">
                <strong>{log.action}</strong>
                <span className="mx-2 text-muted-foreground">{log.entity}</span>
                <span className="text-xs text-muted-foreground">
                  {log.actor} · {log.timestamp}
                </span>
              </article>
            ))
          ) : (
            <div className="card-surface p-5 text-sm text-muted-foreground">
              Prototype activity will appear here as roles, catalogue, and configuration change.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
