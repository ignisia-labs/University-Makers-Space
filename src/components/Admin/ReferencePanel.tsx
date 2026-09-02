import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminApi,
  readableError,
  type ReferenceDepartment,
  type ReferenceProgramme,
} from "@/lib/api";
import { AdminError, AdminSkeleton, SubmitButton } from "./AdminPrimitives";
import { cn } from "@/lib/utils";

type Draft = { code: string; name: string };

/**
 * Departments and the programmes inside them.
 *
 * Both are fully editable, and both offer deletion — but deletion is only ever
 * possible while nothing depends on the row. Once a student has selected a
 * department or programme, the database refuses to drop it (the profile would
 * be orphaned), so the server returns a plain explanation and deactivation is
 * the right move instead. Deactivating hides it from new sign-ups while the
 * existing records stay readable.
 */
export function ReferencePanel() {
  const [departments, setDepartments] = useState<ReferenceDepartment[]>([]);
  const [programmes, setProgrammes] = useState<ReferenceProgramme[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [departmentDraft, setDepartmentDraft] = useState<Draft>({ code: "", name: "" });
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [departmentEdit, setDepartmentEdit] = useState<Draft>({ code: "", name: "" });

  const [programmeDepartmentId, setProgrammeDepartmentId] = useState("");
  const [programmeDraft, setProgrammeDraft] = useState<Draft>({ code: "", name: "" });
  const [editingProgramme, setEditingProgramme] = useState<string | null>(null);
  const [programmeEdit, setProgrammeEdit] = useState<Draft>({ code: "", name: "" });

  const load = useCallback(async () => {
    try {
      const [departmentsResponse, programmesResponse] = await Promise.all([
        adminApi.departments(),
        adminApi.programmes(),
      ]);
      setDepartments(departmentsResponse.data);
      setProgrammes(programmesResponse.data);
      setState("ready");
    } catch (cause) {
      setError(readableError(cause, "Reference data could not be loaded."));
      setState("error");
    }
  }, []);

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
      // Surfaces the server's own explanation — "3 student profiles refer to
      // this department…" — rather than a generic failure.
      toast.error(readableError(cause, "That change could not be saved."));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const programmesByDepartment = useMemo(() => {
    const map = new Map<string, ReferenceProgramme[]>();
    for (const programme of programmes) {
      const bucket = map.get(programme.departmentId);
      if (bucket) bucket.push(programme);
      else map.set(programme.departmentId, [programme]);
    }
    return map;
  }, [programmes]);

  if (state === "loading") return <AdminSkeleton />;
  if (state === "error") return <AdminError message={error} onRetry={() => void load()} />;

  const activeDepartments = departments.filter((department) => department.isActive);

  return (
    <div className="space-y-5">
      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Departments</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A department can be deleted only while no student has selected it. After that, deactivate
          it — the records that reference it stay intact.
        </p>

        <ul className="mt-4 divide-y divide-border">
          {departments.map((department) => {
            const isEditing = editingDepartment === department.id;
            const inUse = department._count.students > 0;
            return (
              <li key={department.id} className="py-3">
                {isEditing ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(
                        department.id,
                        () =>
                          adminApi.updateDepartment(department.id, {
                            code: departmentEdit.code.trim(),
                            name: departmentEdit.name.trim(),
                          }),
                        "Department updated",
                      ).then((ok) => ok && setEditingDepartment(null));
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      value={departmentEdit.code}
                      onChange={(event) =>
                        setDepartmentEdit((current) => ({ ...current, code: event.target.value }))
                      }
                      aria-label="Department code"
                      required
                      minLength={2}
                      maxLength={24}
                      className="w-28 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                    />
                    <input
                      value={departmentEdit.name}
                      onChange={(event) =>
                        setDepartmentEdit((current) => ({ ...current, name: event.target.value }))
                      }
                      aria-label="Department name"
                      required
                      minLength={2}
                      maxLength={120}
                      className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                    />
                    <SubmitButton
                      busy={busy === department.id}
                      disabled={busy !== null}
                      label="Save"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingDepartment(null)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {department.name}{" "}
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          {department.code}
                        </span>
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {department._count.programmes} programmes · {department._count.students}{" "}
                        students{department.isActive ? "" : " · inactive"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => {
                          setEditingDepartment(department.id);
                          setDepartmentEdit({ code: department.code, name: department.name });
                        }}
                        className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            department.id,
                            () =>
                              adminApi.updateDepartment(department.id, {
                                isActive: !department.isActive,
                              }),
                            department.isActive
                              ? "Department deactivated"
                              : "Department reactivated",
                          )
                        }
                        className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                      >
                        {department.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        title={
                          inUse
                            ? "Students have selected this department, so it can only be deactivated"
                            : "Delete this department and its programmes"
                        }
                        onClick={() => {
                          const count = department._count.programmes;
                          const warning = count
                            ? `Delete ${department.name}? Its ${count} ${count === 1 ? "programme" : "programmes"} will be deleted too.`
                            : `Delete ${department.name}?`;
                          if (!window.confirm(warning)) return;
                          void run(
                            department.id,
                            () => adminApi.deleteDepartment(department.id),
                            "Department deleted",
                          );
                        }}
                        className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {departments.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">
              No departments yet. Add the first one below — students cannot complete onboarding
              until a department with at least one programme exists.
            </li>
          ) : null}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "new-department",
              () =>
                adminApi.createDepartment({
                  code: departmentDraft.code.trim(),
                  name: departmentDraft.name.trim(),
                }),
              "Department created",
            ).then((ok) => ok && setDepartmentDraft({ code: "", name: "" }));
          }}
          className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4"
        >
          <input
            value={departmentDraft.code}
            onChange={(event) =>
              setDepartmentDraft((current) => ({ ...current, code: event.target.value }))
            }
            placeholder="CODE"
            aria-label="New department code"
            required
            minLength={2}
            maxLength={24}
            className="w-28 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
          <input
            value={departmentDraft.name}
            onChange={(event) =>
              setDepartmentDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Department name"
            aria-label="New department name"
            required
            minLength={2}
            maxLength={120}
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
          <SubmitButton busy={busy === "new-department"} disabled={busy !== null} label="Add" />
        </form>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Programmes</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every department needs at least one, or a student choosing it during onboarding has
          nothing to select.
        </p>

        {departments.map((department) => {
          const list = programmesByDepartment.get(department.id) ?? [];
          return (
            <div key={department.id} className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {department.name}
              </p>
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {list.map((programme) => {
                  const isEditing = editingProgramme === programme.id;
                  return (
                    <li key={programme.id} className="px-3 py-2.5">
                      {isEditing ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(
                              programme.id,
                              () =>
                                adminApi.updateProgramme(programme.id, {
                                  code: programmeEdit.code.trim(),
                                  name: programmeEdit.name.trim(),
                                }),
                              "Programme updated",
                            ).then((ok) => ok && setEditingProgramme(null));
                          }}
                          className="flex flex-wrap gap-2"
                        >
                          <input
                            value={programmeEdit.code}
                            onChange={(event) =>
                              setProgrammeEdit((current) => ({
                                ...current,
                                code: event.target.value,
                              }))
                            }
                            aria-label="Programme code"
                            required
                            minLength={2}
                            maxLength={24}
                            className="w-32 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                          />
                          <input
                            value={programmeEdit.name}
                            onChange={(event) =>
                              setProgrammeEdit((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            aria-label="Programme name"
                            required
                            minLength={2}
                            maxLength={120}
                            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                          />
                          <SubmitButton
                            busy={busy === programme.id}
                            disabled={busy !== null}
                            label="Save"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingProgramme(null)}
                            className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              {programme.name}{" "}
                              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                                {programme.code}
                              </span>
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {programme._count.students} students
                              {programme.isActive ? "" : " · inactive"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                setEditingProgramme(programme.id);
                                setProgrammeEdit({ code: programme.code, name: programme.name });
                              }}
                              className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() =>
                                void run(
                                  programme.id,
                                  () =>
                                    adminApi.updateProgramme(programme.id, {
                                      isActive: !programme.isActive,
                                    }),
                                  programme.isActive
                                    ? "Programme deactivated"
                                    : "Programme reactivated",
                                )
                              }
                              className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                            >
                              {programme.isActive ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => {
                                if (!window.confirm(`Delete ${programme.name}?`)) return;
                                void run(
                                  programme.id,
                                  () => adminApi.deleteProgramme(programme.id),
                                  "Programme deleted",
                                );
                              }}
                              className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
                {list.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-muted-foreground">
                    No programmes yet — students cannot choose this department until one exists.
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "new-programme",
              () =>
                adminApi.createProgramme({
                  departmentId: programmeDepartmentId,
                  code: programmeDraft.code.trim(),
                  name: programmeDraft.name.trim(),
                }),
              "Programme created",
            ).then((ok) => ok && setProgrammeDraft({ code: "", name: "" }));
          }}
          className="mt-5 space-y-2 border-t border-border pt-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Add programme
          </p>
          <select
            value={programmeDepartmentId}
            onChange={(event) => setProgrammeDepartmentId(event.target.value)}
            required
            disabled={!activeDepartments.length}
            aria-label="Department for the new programme"
            className={cn(
              "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm",
              !activeDepartments.length && "opacity-50",
            )}
          >
            <option value="">
              {activeDepartments.length ? "Choose a department" : "Create a department first"}
            </option>
            {activeDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <input
              value={programmeDraft.code}
              onChange={(event) =>
                setProgrammeDraft((current) => ({ ...current, code: event.target.value }))
              }
              placeholder="CODE"
              aria-label="New programme code"
              required
              minLength={2}
              maxLength={24}
              className="w-32 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
            />
            <input
              value={programmeDraft.name}
              onChange={(event) =>
                setProgrammeDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Programme name"
              aria-label="New programme name"
              required
              minLength={2}
              maxLength={120}
              className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
            />
            <SubmitButton
              busy={busy === "new-programme"}
              disabled={busy !== null || !programmeDepartmentId}
              label="Add"
            />
          </div>
        </form>
      </section>
    </div>
  );
}
