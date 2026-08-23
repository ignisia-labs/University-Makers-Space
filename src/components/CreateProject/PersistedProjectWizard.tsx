import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  projectsApi,
  referenceApi,
  usersApi,
  type FacultyDirectoryResult,
  type ProjectDetail,
  type StudentDirectoryResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const steps = ["The idea", "The team", "Expected resources"];

export function PersistedProjectWizard({
  onCreated,
}: {
  onCreated: (project: ProjectDetail) => void;
}) {
  const idempotencyKey = useRef(crypto.randomUUID());
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<StudentDirectoryResult[]>([]);
  const [mentor, setMentor] = useState<FacultyDirectoryResult | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [mentorSearch, setMentorSearch] = useState("");
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [consumableIds, setConsumableIds] = useState<string[]>([]);
  const debouncedStudentSearch = useDebouncedValue(studentSearch, 300);
  const debouncedMentorSearch = useDebouncedValue(mentorSearch, 300);

  const labs = useQuery({
    queryKey: ["phase2-reference", "labs"],
    queryFn: () => referenceApi.labs().then((r) => r.data),
  });
  const labId = labs.data?.[0]?.id ?? "";
  const resources = useQuery({
    queryKey: ["phase2-reference", "project-resources", labId],
    queryFn: () => referenceApi.projectResources(labId).then((r) => r.data),
    enabled: Boolean(labId),
  });
  const students = useQuery({
    queryKey: ["phase2-directory", "students", debouncedStudentSearch],
    queryFn: () => usersApi.searchStudents(debouncedStudentSearch).then((r) => r.data),
    enabled: debouncedStudentSearch.length >= 2,
  });
  const mentors = useQuery({
    queryKey: ["phase2-directory", "faculty", debouncedMentorSearch],
    queryFn: () => usersApi.searchFacultyMentors(debouncedMentorSearch).then((r) => r.data),
    enabled: debouncedMentorSearch.length >= 2,
  });

  const createProject = useMutation({
    mutationFn: () =>
      projectsApi
        .create({
          idempotencyKey: idempotencyKey.current,
          labId,
          title: title.trim(),
          description: description.trim(),
          teamMemberEmails: members.map((member) => member.email),
          mentorId: mentor!.id,
          equipmentIds,
          consumableIds,
        })
        .then((r) => r.data),
    onSuccess: (project) => {
      toast.success("Project submitted for verification");
      onCreated(project);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not create the project");
    },
  });

  const selectedMemberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const canSubmit = Boolean(labId && mentor && title.trim() && description.trim());

  return (
    <form
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) return;
        if (!canSubmit || createProject.isPending) return;
        createProject.mutate();
      }}
    >
      <ol className="mb-6 flex items-center gap-2" aria-label="Project creation progress">
        {steps.map((label, index) => {
          const number = index + 1;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  number <= step ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-mono uppercase tracking-widest",
                  number === step ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={number === step ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="project-title">Project name</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Project description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={5}
              required
            />
          </div>
          <button
            type="button"
            disabled={!title.trim() || !description.trim()}
            onClick={() => setStep(2)}
            className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-45"
          >
            Next — the team <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-7">
          <DirectorySearch
            id="student-directory-search"
            label="Invite teammates"
            hint="Search registered students by name, MIT-WPU email, or PRN."
            value={studentSearch}
            onChange={setStudentSearch}
            loading={students.isFetching}
          >
            {debouncedStudentSearch.length >= 2 && students.data?.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No eligible students found.</p>
            )}
            {students.data
              ?.filter((student) => !selectedMemberIds.has(student.id))
              .map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setMembers((current) => [...current, student]);
                    setStudentSearch("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-secondary"
                >
                  <span>
                    <span className="block text-sm font-semibold">{student.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {student.email} · PRN {student.prn}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-primary">Add</span>
                </button>
              ))}
          </DirectorySearch>

          {members.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Selected teammates">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() =>
                    setMembers((current) => current.filter((item) => item.id !== member.id))
                  }
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 text-xs"
                >
                  {member.name} <X className="size-3" aria-hidden />
                </button>
              ))}
            </div>
          )}

          <DirectorySearch
            id="mentor-directory-search"
            label="Faculty Mentor"
            hint="Search authorized Faculty Mentors by name or university email."
            value={mentorSearch}
            onChange={setMentorSearch}
            loading={mentors.isFetching}
          >
            {mentors.data?.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  setMentor(result);
                  setMentorSearch("");
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-secondary"
              >
                <span>
                  <span className="block text-sm font-semibold">{result.name}</span>
                  <span className="block text-xs text-muted-foreground">{result.email}</span>
                </span>
                <span className="text-xs font-semibold text-primary">Select</span>
              </button>
            ))}
          </DirectorySearch>

          {mentor && (
            <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{mentor.name}</p>
                <p className="text-xs text-muted-foreground">{mentor.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setMentor(null)}
                className="text-xs font-semibold text-primary"
              >
                Change
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <BackButton onClick={() => setStep(1)} />
            <button
              type="button"
              disabled={!mentor}
              onClick={() => setStep(3)}
              className="pressable inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-45"
            >
              Next — expected resources <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Select expected requirements only. These choices do not reserve equipment, materials,
            quantities, or time.
          </p>
          {resources.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading the configured catalogue…</p>
          ) : (
            <>
              <ResourceChecks
                label="Equipment"
                items={resources.data?.equipment ?? []}
                selected={equipmentIds}
                onChange={setEquipmentIds}
              />
              <ResourceChecks
                label="Consumables"
                items={resources.data?.consumables ?? []}
                selected={consumableIds}
                onChange={setConsumableIds}
              />
            </>
          )}
          <div className="flex gap-3">
            <BackButton onClick={() => setStep(2)} />
            <button
              type="submit"
              disabled={!canSubmit || createProject.isPending}
              className="pressable inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-45"
            >
              {createProject.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Create project
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function DirectorySearch({
  id,
  label,
  hint,
  value,
  onChange,
  loading,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-3.5 size-4 animate-spin text-primary" />
        )}
      </div>
      {value.trim().length >= 2 && (
        <div className="max-h-52 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
          {children}
        </div>
      )}
    </section>
  );
}

function ResourceChecks({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    category: { name: string };
  }>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <section>
      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">{label}</p>
      {items.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active ? selected.filter((id) => id !== item.id) : [...selected, item.id],
                  )
                }
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left",
                  active
                    ? "border-primary bg-primary/[0.05]"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border",
                    active && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {active && <Check className="size-3" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {item.category.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No configured {label.toLowerCase()}.</p>
      )}
    </section>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
    >
      <ArrowLeft className="size-4" /> Back
    </button>
  );
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value.trim()), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}
