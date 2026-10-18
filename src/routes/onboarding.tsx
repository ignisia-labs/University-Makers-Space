import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, LoaderCircle, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { roleHomes, useAppSession, useAuth } from "@/lib/auth-context";
import {
  ApiError,
  authApi,
  referenceApi,
  type AcademicYear,
  type Department,
  type Programme,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({ invite: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Complete your profile — सृजन" },
      {
        name: "description",
        content:
          "Set up your MakerSpace student profile with PRN, department, programme and academic year.",
      },
    ],
  }),
  component: Onboarding,
});

type FormState = {
  email: string;
  fullName: string;
  prn: string;
  departmentId: string;
  programmeId: string;
  academicYear: string;
};

type FormErrors = Partial<
  Record<"fullName" | "prn" | "departmentId" | "programmeId" | "academicYear" | "form", string>
>;

type SelectOption = { value: string; label: string };

function Onboarding() {
  const session = useAppSession();
  const { completeStudentOnboarding } = useAuth();
  const navigate = useNavigate();
  const { invite: invitationProjectId } = Route.useSearch();
  const [form, setForm] = useState<FormState>({
    email: session.profile.email,
    fullName: session.profile.fullName,
    prn: session.profile.prn,
    departmentId: "",
    programmeId: "",
    academicYear: "",
  });
  const [departmentRecords, setDepartmentRecords] = useState<Department[]>([]);
  const [programmeRecords, setProgrammeRecords] = useState<Programme[]>([]);
  const [yearRecords, setYearRecords] = useState<AcademicYear[]>([]);
  const [prnPolicy, setPrnPolicy] = useState({
    pattern: "^[A-Za-z0-9][A-Za-z0-9/-]{5,23}$",
    hint: "Enter the PRN issued by MIT-WPU.",
    maxLength: 24,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);
  const [isLoadingProgrammes, setIsLoadingProgrammes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      email: session.profile.email,
      fullName: current.fullName || session.profile.fullName,
    }));
  }, [session.profile.email, session.profile.fullName]);

  useEffect(() => {
    if (!session.hydrated) return;
    if (!session.authenticated) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (session.onboarded) {
      navigate({ to: roleHomes[session.role], replace: true });
    }
  }, [navigate, session.authenticated, session.hydrated, session.onboarded, session.role]);

  useEffect(() => {
    if (!session.authenticated) return;
    let cancelled = false;
    setIsLoadingReferences(true);
    void Promise.all([
      referenceApi.departments(),
      referenceApi.academicYears(),
      authApi.studentProfileConfig(),
    ])
      .then(([departmentResponse, yearResponse, policyResponse]) => {
        if (cancelled) return;
        setDepartmentRecords(departmentResponse.data);
        setYearRecords(yearResponse.data);
        setPrnPolicy(policyResponse.data.prn);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrors({
            form:
              error instanceof ApiError ? error.message : "Profile options could not be loaded.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReferences(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.authenticated]);

  useEffect(() => {
    if (!form.departmentId) {
      setProgrammeRecords([]);
      return;
    }
    let cancelled = false;
    setIsLoadingProgrammes(true);
    void referenceApi
      .programmes(form.departmentId)
      .then(({ data }) => {
        if (!cancelled) setProgrammeRecords(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrors((current) => ({
            ...current,
            programmeId:
              error instanceof ApiError ? error.message : "Programmes could not be loaded.",
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProgrammes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.departmentId]);

  useEffect(() => {
    if (!isComplete) return;
    const timer = window.setTimeout(() => navigate({ to: "/dashboard" }), 700);
    return () => window.clearTimeout(timer);
  }, [isComplete, navigate]);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "departmentId" ? { programmeId: "" } : {}),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key as keyof FormErrors];
      delete next.form;
      return next;
    });
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name.";
    let pattern: RegExp | null = null;
    try {
      pattern = new RegExp(prnPolicy.pattern);
    } catch {
      pattern = null;
    }
    const normalizedPrn = form.prn.trim().replace(/\s+/g, "").toUpperCase();
    if (!normalizedPrn) next.prn = "Enter your PRN.";
    else if (pattern && !pattern.test(normalizedPrn)) next.prn = prnPolicy.hint;
    if (!form.departmentId) next.departmentId = "Select your department.";
    if (!form.programmeId) next.programmeId = "Select your programme.";
    if (!form.academicYear) next.academicYear = "Select your academic year.";
    setForm((current) => ({ ...current, prn: normalizedPrn }));
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await completeStudentOnboarding({
        fullName: form.fullName.trim(),
        prn: form.prn,
        departmentId: form.departmentId,
        programmeId: form.programmeId,
        academicYear: Number(form.academicYear),
      });
      toast.success("Profile completed. Welcome!");
      setIsComplete(true);
    } catch (error) {
      setErrors({
        form: error instanceof ApiError ? error.message : "Your profile could not be saved.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const departmentOptions: SelectOption[] = departmentRecords.map((department) => ({
    value: department.id,
    label: department.name,
  }));
  const programmeOptions: SelectOption[] = programmeRecords.map((programme) => ({
    value: programme.id,
    label: programme.name,
  }));
  const yearOptions: SelectOption[] = yearRecords.map((year) => ({
    value: String(year.value),
    label: year.label,
  }));
  const verifiedEmail = session.user?.email ?? session.profile.email ?? form.email;

  if (!session.hydrated || isLoadingReferences) {
    return <LoadingState label="Loading your verified profile..." />;
  }

  if (isComplete) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <section className="card-surface animate-in fade-in zoom-in-95 w-full max-w-md p-8 text-center duration-500">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-5 font-serif text-2xl font-light tracking-wide">Profile saved</h1>
          <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" /> Taking you to your dashboard
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="card-surface animate-in fade-in slide-in-from-bottom-4 w-full max-w-lg p-8 duration-500 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              One last step
            </p>
            <h1 className="mt-3 font-serif text-3xl font-light tracking-wide sm:text-4xl">
              Complete your profile
            </h1>
          </div>
          {/* Onboarding is the one screen with no app shell around it, so
              without this a person part-way through has no way out except
              closing the tab — including anyone who signed in with the wrong
              Google account. */}
          <button
            type="button"
            onClick={() => void session.signOut()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden /> Sign out
          </button>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This is how mentors and lab staff will recognise you.
        </p>

        {/* Departments are created by the Super Admin, not seeded. Until at
            least one exists there is genuinely nothing to choose, and an empty
            dropdown would read as a broken page rather than a setup step. */}
        {!isLoadingReferences && departmentOptions.length === 0 && (
          <p
            role="status"
            className="mt-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-6"
          >
            No departments have been set up yet, so the profile cannot be completed. Ask a
            MakerSpace administrator to add your department and programme, then reload this page.
          </p>
        )}

        <form
          noValidate
          className="mt-8 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field
            label="Verified Google email"
            type="email"
            value={verifiedEmail}
            readOnly
            placeholder="you@mitwpu.edu.in"
            help="Verified by Google and cannot be changed here."
          />
          <Field
            label="Full Name"
            value={form.fullName}
            onChange={set("fullName")}
            placeholder="e.g. Rahul Sharma"
            error={errors.fullName}
          />
          <Field
            label="PRN (Permanent Registration Number)"
            value={form.prn}
            onChange={set("prn")}
            placeholder="Enter your PRN"
            error={errors.prn}
            help={prnPolicy.hint}
            maxLength={prnPolicy.maxLength}
          />
          <CustomSelect
            label="Department"
            value={form.departmentId}
            options={departmentOptions}
            error={errors.departmentId}
            onChange={set("departmentId")}
          />
          <CustomSelect
            label="Programme / Class"
            value={form.programmeId}
            options={programmeOptions}
            error={errors.programmeId}
            disabled={!form.departmentId || isLoadingProgrammes}
            placeholder={isLoadingProgrammes ? "Loading programmes..." : "Select programme / class"}
            onChange={set("programmeId")}
          />
          <CustomSelect
            label="Academic Year"
            value={form.academicYear}
            options={yearOptions}
            error={errors.academicYear}
            onChange={set("academicYear")}
          />
          {errors.form && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive"
            >
              {errors.form}
            </p>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-xs font-bold uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4.5 animate-spin" /> Saving...
              </span>
            ) : (
              "Complete Onboarding"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> {label}
      </span>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  help,
  type = "text",
  readOnly = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange?: ((value: string) => void) | undefined;
  placeholder: string;
  error?: string | undefined;
  help?: string | undefined;
  type?: string | undefined;
  readOnly?: boolean | undefined;
  maxLength?: number | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border bg-secondary/40 px-4 text-sm outline-none transition-all",
          readOnly && "cursor-not-allowed bg-muted text-muted-foreground",
          error
            ? "border-destructive focus:border-destructive"
            : "border-border focus:border-primary focus:ring-2 focus:ring-primary/15",
        )}
      />
      {error ? (
        <p className="text-[10px] font-mono text-destructive">{error}</p>
      ) : (
        help && <p className="text-[10px] leading-4 text-muted-foreground">{help}</p>
      )}
    </div>
  );
}

function CustomSelect({
  label,
  value,
  options,
  error,
  onChange,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  error?: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border bg-secondary/40 px-4 text-left text-sm outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60",
          error
            ? "border-destructive"
            : isOpen
              ? "border-primary ring-2 ring-primary/15"
              : "border-border hover:border-primary/40",
        )}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected?.label ?? placeholder ?? `Select ${label.toLowerCase()}`}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-border bg-card shadow-lg duration-200">
          <div className="space-y-0.5 p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full rounded-xl px-4 py-2.5 text-left text-xs transition-all",
                  option.value === value
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-[10px] font-mono text-destructive">{error}</p>}
    </div>
  );
}
