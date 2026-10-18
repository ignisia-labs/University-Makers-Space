import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  authApi,
  projectsApi,
  referenceApi,
  usersApi,
  type FacultyDirectoryResult,
  type ProjectDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAppSession } from "@/lib/auth-context";
import { MentorSelect } from "@/components/CreateProject/MentorSelect";
import {
  ResourceSelection,
  emptyKit,
  type ResourceKit,
} from "@/components/CreateProject/ResourceSelection";

const steps = ["The idea", "The team", "Expected resources"];

/**
 * A teammate on the invite list.
 *
 * Invitations are addressed to an *email*, not to an existing account: a
 * first-year who has never opened the app can still be added to a project. When
 * they sign in with their institutional Google account the invitation is
 * already waiting, so nobody has to be registered by an administrator first.
 */
type TeamInvite = {
  email: string;
  name: string;
  prn: string | null;
  /** Whether this address already has a MakerSpace account. */
  registered: boolean;
};

export function PersistedProjectWizard({
  onCreated,
}: {
  onCreated: (project: ProjectDetail) => void;
}) {
  const idempotencyKey = useRef(crypto.randomUUID());
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<TeamInvite[]>([]);
  const [mentor, setMentor] = useState<FacultyDirectoryResult | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [kit, setKit] = useState<ResourceKit>(emptyKit);
  const debouncedStudentSearch = useDebouncedValue(studentSearch, 300);

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
  // The permitted domain comes from the server rather than a hard-coded string,
  // so the institution can change it in one place.
  const identity = useQuery({
    queryKey: ["auth", "google-config"],
    queryFn: () => authApi.googleConfig().then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });
  const hostedDomain = identity.data?.hostedDomain ?? "mitwpu.edu.in";
  const { user: viewer } = useAppSession();

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
          equipmentIds: kit.equipmentIds,
          consumables: kit.consumables,
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

  const selectedEmails = useMemo(
    () => new Set(members.map((member) => member.email.toLowerCase())),
    [members],
  );
  const typedEmail = studentSearch.trim().toLowerCase();
  const typedEmailIsValid =
    /^[^\s@]+@[^\s@]+$/.test(typedEmail) && typedEmail.endsWith(`@${hostedDomain}`);
  const canInviteTypedEmail = typedEmailIsValid && !selectedEmails.has(typedEmail);

  const addInvite = (invite: TeamInvite) => {
    setMembers((current) =>
      current.some((entry) => entry.email.toLowerCase() === invite.email.toLowerCase())
        ? current
        : [...current, invite],
    );
    setStudentSearch("");
  };

  /**
   * Commit a typed address, as a comma or Enter does.
   *
   * Every rejection says why. Silently dropping the text would leave the
   * student staring at an empty box wondering whether it worked — and the
   * domain rule in particular is not guessable from an empty field.
   */
  const commitTypedInvite = (raw: string) => {
    const candidate = raw
      .trim()
      .toLowerCase()
      .replace(/[,;]+$/, "");
    if (!candidate) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      toast.error(`"${candidate}" is not an email address`);
      return;
    }
    if (!candidate.endsWith(`@${hostedDomain}`)) {
      toast.error(`Only @${hostedDomain} addresses can be invited`);
      return;
    }
    if (candidate === viewer?.email?.toLowerCase()) {
      toast.error("You are already on the team as its leader");
      return;
    }
    if (selectedEmails.has(candidate)) {
      toast.error(`${candidate} is already on the list`);
      return;
    }
    // A registered student keeps their real name and PRN on the chip; anyone
    // else is invited by email alone.
    const known = students.data?.find((student) => student.email.toLowerCase() === candidate);
    addInvite(
      known
        ? { email: known.email, name: known.name, prn: known.prn, registered: true }
        : { email: candidate, name: candidate, prn: null, registered: false },
    );
  };
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
            hint={`Search by name or PRN, or type any @${hostedDomain} email — they do not need an account yet.`}
            value={studentSearch}
            onChange={setStudentSearch}
            onCommit={commitTypedInvite}
            loading={students.isFetching}
          >
            {students.data
              ?.filter((student) => !selectedEmails.has(student.email.toLowerCase()))
              .map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() =>
                    addInvite({
                      email: student.email,
                      name: student.name,
                      prn: student.prn,
                      registered: true,
                    })
                  }
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

            {/* Anyone with an institutional address can be invited, registered
                or not. They receive an email and the invitation is waiting once
                they sign in. */}
            {canInviteTypedEmail && (
              <button
                type="button"
                onClick={() =>
                  addInvite({
                    email: typedEmail,
                    name: typedEmail,
                    prn: null,
                    registered: false,
                  })
                }
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-secondary"
              >
                <span>
                  <span className="block text-sm font-semibold">Invite {typedEmail}</span>
                  <span className="block text-xs text-muted-foreground">
                    We will email them an invitation to join and set up their account.
                  </span>
                </span>
                <span className="text-xs font-semibold text-primary">Invite</span>
              </button>
            )}

            {debouncedStudentSearch.length >= 2 &&
              students.data?.length === 0 &&
              !canInviteTypedEmail && (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No registered student matches that. Type their full @{hostedDomain} email to
                  invite them anyway.
                </p>
              )}
          </DirectorySearch>

          {members.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Selected teammates">
              {members.map((member) => (
                <button
                  key={member.email}
                  type="button"
                  onClick={() =>
                    setMembers((current) => current.filter((item) => item.email !== member.email))
                  }
                  title={
                    member.registered ? member.email : `${member.email} — will be invited by email`
                  }
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs",
                    member.registered
                      ? "border-border bg-secondary/50"
                      : "border-primary/30 bg-primary/[0.06]",
                  )}
                >
                  {member.name}
                  {!member.registered && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                      invite
                    </span>
                  )}
                  <X className="size-3" aria-hidden />
                </button>
              ))}
            </div>
          )}

          <MentorSelect value={mentor} onChange={setMentor} />

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
          ) : resources.data ? (
            <ResourceSelection resources={resources.data} kit={kit} onChange={setKit} />
          ) : (
            <p className="text-sm text-muted-foreground">The catalogue could not be loaded.</p>
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
  onCommit,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  onCommit?: (value: string) => void;
  children: React.ReactNode;
}) {
  // A comma (or Enter) commits what has been typed, the way every address field
  // behaves. Typing an address and moving on without noticing the Invite button
  // is the obvious mistake, so the separator people already reach for is wired
  // to the same action. Pasting "a@x, b@x" commits each in turn.
  const handleChange = (next: string) => {
    if (!onCommit || !next.includes(",")) {
      onChange(next);
      return;
    }
    const parts = next.split(",");
    const remainder = parts.pop() ?? "";
    for (const part of parts) {
      const candidate = part.trim();
      if (candidate) onCommit(candidate);
    }
    onChange(remainder.trim());
  };

  return (
    <section className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (!onCommit) return;
            // Enter would otherwise submit the wizard form.
            if (event.key === "Enter" && value.trim()) {
              event.preventDefault();
              onCommit(value.trim());
              onChange("");
            }
          }}
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
