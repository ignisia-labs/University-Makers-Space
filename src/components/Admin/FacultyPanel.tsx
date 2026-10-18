import { Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  governanceApi,
  readableError,
  type DivisionDto,
  type FacultyDto,
  type FacultyImportOutcome,
} from "@/lib/api";
import { Pagination, type PageMeta } from "@/components/Pagination";
import { AdminError, AdminSkeleton, SubmitButton } from "./AdminPrimitives";

/**
 * Divisions and faculty.
 *
 * A Division is internal: it groups departments and staff for administration
 * and is never shown to students. Faculty have no department in this system, so
 * the division is the only grouping they carry.
 */
export function FacultyPanel() {
  const [divisions, setDivisions] = useState<DivisionDto[]>([]);
  const [faculty, setFaculty] = useState<FacultyDto[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [facultyMeta, setFacultyMeta] = useState<PageMeta | undefined>(undefined);

  const [divisionDraft, setDivisionDraft] = useState("");
  const [editingDivision, setEditingDivision] = useState<string | null>(null);
  const [divisionEdit, setDivisionEdit] = useState("");

  const [draft, setDraft] = useState({ prefix: "", name: "", email: "", divisionId: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ prefix: "", name: "", divisionId: "" });

  const [importOutcome, setImportOutcome] = useState<FacultyImportOutcome | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [divisionsResponse, facultyResponse] = await Promise.all([
        governanceApi.divisions(),
        // Search is applied by the database, so a name is reachable however
        // deep it sits — 400 faculty do not fit on a page.
        governanceApi.faculty({
          page: String(page),
          limit: "50",
          ...(search.trim() ? { search: search.trim() } : {}),
        }),
      ]);
      setDivisions(divisionsResponse.data);
      setFaculty(facultyResponse.data);
      setFacultyMeta(facultyResponse.meta as PageMeta | undefined);
      setState("ready");
    } catch (cause) {
      setError(readableError(cause, "Faculty data could not be loaded."));
      setState("error");
    }
  }, [search, page]);

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
      toast.error(readableError(cause, "That change could not be saved."));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const onImport = async (file: File) => {
    setBusy("import");
    setImportOutcome(null);
    try {
      const outcome = await governanceApi.importFaculty(file);
      setImportOutcome(outcome);
      toast.success(`Imported ${outcome.added + outcome.updated} of ${outcome.total} rows`);
      await load();
    } catch (cause) {
      toast.error(readableError(cause, "The workbook could not be imported."));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (state === "loading") return <AdminSkeleton />;
  if (state === "error") return <AdminError message={error} onRetry={() => void load()} />;

  const activeDivisions = divisions.filter((division) => division.isActive);

  return (
    <div className="space-y-5">
      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Divisions</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Internal only — students never see these. One division holds many departments, and every
          faculty member belongs to one.
        </p>

        <ul className="mt-4 divide-y divide-border">
          {divisions.map((division) => (
            <li key={division.id} className="py-3">
              {editingDivision === division.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(
                      division.id,
                      () =>
                        governanceApi.updateDivision(division.id, { name: divisionEdit.trim() }),
                      "Division updated",
                    ).then((ok) => ok && setEditingDivision(null));
                  }}
                  className="flex flex-wrap gap-2"
                >
                  <input
                    value={divisionEdit}
                    onChange={(event) => setDivisionEdit(event.target.value)}
                    aria-label="Division name"
                    required
                    minLength={2}
                    maxLength={120}
                    className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                  />
                  <SubmitButton busy={busy === division.id} disabled={busy !== null} label="Save" />
                  <button
                    type="button"
                    onClick={() => setEditingDivision(null)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{division.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {division._count.departments} departments · {division._count.faculty} faculty
                      {division.isActive ? "" : " · inactive"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setEditingDivision(division.id);
                        setDivisionEdit(division.name);
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
                          division.id,
                          () =>
                            governanceApi.updateDivision(division.id, {
                              isActive: !division.isActive,
                            }),
                          division.isActive ? "Division deactivated" : "Division reactivated",
                        )
                      }
                      className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                    >
                      {division.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        const count = division._count.departments + division._count.faculty;
                        if (
                          !window.confirm(
                            count
                              ? `Delete ${division.name}? Its ${division._count.departments} departments and ${division._count.faculty} faculty stay, but lose this grouping.`
                              : `Delete ${division.name}?`,
                          )
                        ) {
                          return;
                        }
                        void run(
                          division.id,
                          () => governanceApi.deleteDivision(division.id),
                          "Division deleted",
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
          ))}
          {divisions.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">
              No divisions yet. Add one below, or import a spreadsheet — divisions named in the file
              are created automatically.
            </li>
          ) : null}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "new-division",
              () => governanceApi.createDivision({ name: divisionDraft.trim() }),
              "Division created",
            ).then((ok) => ok && setDivisionDraft(""));
          }}
          className="mt-4 flex gap-2 border-t border-border pt-4"
        >
          <input
            value={divisionDraft}
            onChange={(event) => setDivisionDraft(event.target.value)}
            placeholder="Division 1"
            aria-label="New division name"
            required
            minLength={2}
            maxLength={120}
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
          <SubmitButton busy={busy === "new-division"} disabled={busy !== null} label="Add" />
        </form>
      </section>

      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Import from Excel
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          An .xlsx workbook with the columns <strong>Prefix</strong>, <strong>Full Name</strong>,{" "}
          <strong>Work Email</strong> and <strong>Division</strong>. Column order does not matter
          and extra columns are ignored. Anyone already on the system keeps their account and is
          updated rather than duplicated.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Faculty workbook"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
            }}
            className="text-xs file:mr-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-4 file:py-1.5 file:text-xs file:text-foreground"
          />
          {busy === "import" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="size-3.5 animate-pulse" aria-hidden /> Importing…
            </span>
          )}
        </div>

        {importOutcome && (
          <div className="mt-4 rounded-lg border border-border p-4" role="status">
            <p className="text-sm">
              {importOutcome.added} added · {importOutcome.updated} updated ·{" "}
              {importOutcome.skipped.length} skipped, out of {importOutcome.total} rows.
            </p>
            {importOutcome.divisionsCreated.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Divisions created: {importOutcome.divisionsCreated.join(", ")}
              </p>
            )}
            {importOutcome.skipped.length > 0 && (
              <ul className="mt-3 space-y-1">
                {importOutcome.skipped.map((entry) => (
                  <li key={`${entry.row}-${entry.email}`} className="text-xs text-warning">
                    Row {entry.row} ({entry.email}) — {entry.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="card-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Faculty</p>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or email"
            aria-label="Search faculty"
            className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
        </div>

        <ul className="mt-4 divide-y divide-border">
          {faculty.map((member) => (
            <li key={member.id} className="py-3">
              {editing === member.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(
                      member.id,
                      () =>
                        governanceApi.updateFaculty(member.id, {
                          prefix: edit.prefix.trim() || null,
                          name: edit.name.trim(),
                          divisionId: edit.divisionId || null,
                        }),
                      "Faculty updated",
                    ).then((ok) => ok && setEditing(null));
                  }}
                  className="flex flex-wrap gap-2"
                >
                  <input
                    value={edit.prefix}
                    onChange={(event) => setEdit((c) => ({ ...c, prefix: event.target.value }))}
                    placeholder="Dr."
                    aria-label="Prefix"
                    maxLength={24}
                    className="w-20 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                  />
                  <input
                    value={edit.name}
                    onChange={(event) => setEdit((c) => ({ ...c, name: event.target.value }))}
                    aria-label="Full name"
                    required
                    minLength={2}
                    className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                  />
                  <select
                    value={edit.divisionId}
                    onChange={(event) => setEdit((c) => ({ ...c, divisionId: event.target.value }))}
                    aria-label="Division"
                    className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
                  >
                    <option value="">No division</option>
                    {activeDivisions.map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <SubmitButton busy={busy === member.id} disabled={busy !== null} label="Save" />
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {member.prefix ? `${member.prefix} ` : ""}
                      {member.name}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {member.email}
                      {member.division ? ` · ${member.division.name}` : " · no division"}
                      {member.hasSignedIn ? "" : " · not signed in yet"}
                      {member.isActive ? "" : " · suspended"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setEditing(member.id);
                        setEdit({
                          prefix: member.prefix ?? "",
                          name: member.name,
                          divisionId: member.division?.id ?? "",
                        });
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${member.name} as faculty? Projects they already mentor keep their history.`,
                          )
                        ) {
                          return;
                        }
                        void run(
                          member.id,
                          () => governanceApi.removeFaculty(member.id),
                          "Faculty removed",
                        );
                      }}
                      className="rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {faculty.length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">
              {search ? "Nobody matches that search." : "No faculty yet."}
            </li>
          ) : null}
        </ul>

        <Pagination meta={facultyMeta} onPage={setPage} busy={busy !== null} noun="faculty" />

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "new-faculty",
              () =>
                governanceApi.addFaculty({
                  prefix: draft.prefix.trim() || null,
                  name: draft.name.trim(),
                  email: draft.email.trim().toLowerCase(),
                  divisionId: draft.divisionId || null,
                }),
              "Faculty added",
            ).then((ok) => ok && setDraft({ prefix: "", name: "", email: "", divisionId: "" }));
          }}
          className="mt-4 space-y-2 border-t border-border pt-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Add one manually
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={draft.prefix}
              onChange={(event) => setDraft((c) => ({ ...c, prefix: event.target.value }))}
              placeholder="Dr."
              aria-label="New faculty prefix"
              maxLength={24}
              className="w-20 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
            />
            <input
              value={draft.name}
              onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
              placeholder="Full name"
              aria-label="New faculty full name"
              required
              minLength={2}
              className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
            />
            <input
              value={draft.email}
              onChange={(event) => setDraft((c) => ({ ...c, email: event.target.value }))}
              placeholder="work.email@mitwpu.edu.in"
              aria-label="New faculty work email"
              type="email"
              required
              className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
            />
            <select
              value={draft.divisionId}
              onChange={(event) => setDraft((c) => ({ ...c, divisionId: event.target.value }))}
              aria-label="New faculty division"
              className="rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
            >
              <option value="">No division</option>
              {activeDivisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
            <SubmitButton busy={busy === "new-faculty"} disabled={busy !== null} label="Add" />
          </div>
        </form>
      </section>
    </div>
  );
}
