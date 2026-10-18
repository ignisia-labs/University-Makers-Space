import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { governanceApi, readableError, type ProvisioningDto, type UserDto } from "@/lib/api";
import { AdminError, AdminSkeleton, Pager, SubmitButton } from "./AdminPrimitives";

const assignableRoles = ["STUDENT", "FACULTY_MENTOR", "LAB_ASSISTANT", "ADMIN", "SUPER_ADMIN"];

/**
 * Super Admin governance.
 *
 * Privileged access is deny-by-default: a role is granted by *pre-provisioning
 * an institutional address*, so nobody acquires elevated permissions merely by
 * signing in. Existing accounts can be re-roled or suspended here, and both
 * paths write an audit record on the server.
 */
export function GovernancePanel() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [provisions, setProvisions] = useState<ProvisioningDto[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ email: "", name: "", role: "LAB_ASSISTANT" });
  const [confirmRemoval, setConfirmRemoval] = useState<UserDto | null>(null);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (search.trim()) params["search"] = search.trim();
      const [userPage, provisioningPage] = await Promise.all([
        governanceApi.users(params),
        governanceApi.provisioning({ limit: "50" }),
      ]);
      setUsers(userPage.data);
      setTotalPages(userPage.meta?.totalPages ?? 1);
      setProvisions(provisioningPage.data);
      setState("ready");
    } catch (cause) {
      setError(readableError(cause, "Governance data could not be loaded."));
      setState("error");
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    if (busy) return false;
    setBusy(key);
    try {
      await action();
      toast.success(message);
      await load();
      return true;
    } catch (cause) {
      // Surfaces the field-level reason, e.g. "Email must use @mitwpu.edu.in",
      // instead of the generic validation envelope.
      toast.error(readableError(cause, "That change could not be saved."));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading") return <AdminSkeleton />;
  if (state === "error") return <AdminError message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Provisioned access
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Privileged roles are granted to an address before first sign-in. Nobody is elevated just
          by logging in.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {provisions.map((provision) => (
            <li key={provision.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {provision.name ?? provision.email}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {provision.roles.join(", ").toLowerCase()}
                  </span>
                </p>
                <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {provision.name ? `${provision.email} · ` : ""}
                  {provision.claimedAt ? "claimed" : "pending first sign-in"}
                  {provision.isActive ? "" : " · revoked"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    provision.id,
                    () =>
                      governanceApi.updateProvisioning(provision.id, {
                        isActive: !provision.isActive,
                      }),
                    provision.isActive ? "Access revoked" : "Access restored",
                  )
                }
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
              >
                {provision.isActive ? "Revoke" : "Restore"}
              </button>
            </li>
          ))}
          {provisions.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">Nothing provisioned yet.</li>
          ) : null}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "provision",
              () =>
                governanceApi.provision({
                  email: draft.email.trim().toLowerCase(),
                  ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
                  roles: [draft.role],
                }),
              "Access provisioned",
            ).then((ok) => ok && setDraft({ email: "", name: "", role: "LAB_ASSISTANT" }));
          }}
          className="mt-4 flex flex-wrap gap-2"
        >
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Full name (optional)"
            aria-label="Full name"
            maxLength={100}
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
          <input
            value={draft.email}
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            placeholder="person@mitwpu.edu.in"
            aria-label="Institutional email"
            type="email"
            required
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
          <select
            value={draft.role}
            onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
            aria-label="Role to grant"
            className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {role.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
          <SubmitButton busy={busy === "provision"} disabled={busy !== null} label="Provision" />
        </form>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">People</p>
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search name or email"
            aria-label="Search people"
            className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
        </div>
        <ul className="mt-4 divide-y divide-border">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {user.name}
                  {user.isActive ? null : (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-warning">
                      suspended
                    </span>
                  )}
                </p>
                <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {user.email} · {user.roles.join(", ").toLowerCase()}
                  {user.googleLinked === false ? " · google not linked" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <select
                  value={user.roles[0] ?? "STUDENT"}
                  disabled={busy !== null}
                  aria-label={`Role for ${user.name}`}
                  onChange={(event) =>
                    void run(
                      `role:${user.id}`,
                      () => governanceApi.setRoles(user.id, [event.target.value]),
                      "Roles updated — the account's sessions were revoked",
                    )
                  }
                  className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ").toLowerCase()}
                    </option>
                  ))}
                </select>
                {/* Recovery for "This email is linked to another identity":
                    clears the bound Google account so the next sign-in re-links
                    whichever identity actually authenticates. */}
                {user.googleLinked ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void run(
                        `unlink:${user.id}`,
                        () => governanceApi.unlinkGoogle(user.id),
                        "Google identity cleared — their next sign-in will re-link it",
                      )
                    }
                    aria-label={`Unlink the Google account from ${user.name} and sign them out everywhere`}
                    className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                  >
                    Unlink Google
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      `active:${user.id}`,
                      () => governanceApi.setActive(user.id, !user.isActive),
                      user.isActive ? "Account suspended" : "Account restored",
                    )
                  }
                  aria-label={`${user.isActive ? "Suspend" : "Restore"} ${user.name}`}
                  className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                >
                  {user.isActive ? "Suspend" : "Restore"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setConfirmRemoval(user)}
                  aria-label={`Remove ${user.name}`}
                  className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {users.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">Nobody matches that search.</li>
          ) : null}
        </ul>
        <Pager page={page} totalPages={totalPages} onChange={setPage} />
      </section>

      {confirmRemoval ? (
        <RemovalDialog
          user={confirmRemoval}
          busy={busy === `remove:${confirmRemoval.id}`}
          onCancel={() => setConfirmRemoval(null)}
          onConfirm={() => {
            const target = confirmRemoval;
            void run(
              `remove:${target.id}`,
              () => governanceApi.remove(target.id),
              `${target.name} was removed`,
            ).then((ok) => ok && setConfirmRemoval(null));
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Deletion is irreversible from the operator's side, so it asks first and says
 * plainly what survives: the person loses access and their address is freed for
 * reuse, while the bookings and attendance they appear in are left intact.
 */
function RemovalDialog({
  user,
  busy,
  onCancel,
  onConfirm,
}: {
  user: UserDto;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Remove ${user.name}`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="card-surface w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-serif text-xl font-light">Remove {user.name}?</p>
        <p className="mt-3 text-sm text-muted-foreground">
          They lose access immediately and are signed out everywhere.{" "}
          <span className="text-foreground">{user.email}</span> becomes available again, so the
          address can be reissued or the person can be re-invited later.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Their bookings, attendance records and audit history are kept — those belong to the
          MakerSpace, not to the account.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-border px-4 py-2 text-xs transition hover:bg-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="rounded-full bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Removing…" : "Remove account"}
          </button>
        </div>
      </div>
    </div>
  );
}
