import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, ChevronDown } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useMakerSpace } from "@/lib/makerspace-context";
import { academicYears, departments, programmes } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({ invite: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Complete your profile — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Set up your MakerSpace student profile with PRN, department, programme and academic year.",
      },
    ],
  }),
  component: Onboarding,
});

type FormErrors = Partial<
  Record<"email" | "fullName" | "prn" | "department" | "programme" | "academicYear", string>
>;

function Onboarding() {
  const { profile, completeOnboarding, acceptProjectInvitation } = useMakerSpace();
  const navigate = useNavigate();
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { invite: invitationProjectId } = Route.useSearch();

  useEffect(() => {
    if (!isComplete) return;
    const timer = window.setTimeout(() => navigate({ to: "/dashboard" }), 900);
    return () => window.clearTimeout(timer);
  }, [isComplete, navigate]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      next.email = "Enter your institutional email.";
    if (!form.fullName.trim()) next.fullName = "Enter your full name.";
    if (!form.prn.trim()) next.prn = "Enter your PRN.";
    if (!form.department) next.department = "Select your department.";
    if (!form.programme) next.programme = "Select your programme.";
    if (!form.academicYear) next.academicYear = "Select your academic year.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

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
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
          One last step
        </p>
        <h1 className="mt-3 font-serif text-3xl font-light tracking-wide sm:text-4xl">
          Complete your profile
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This is how mentors and lab staff will recognise you.
        </p>

        {/* Form */}
        <form
          noValidate
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            setIsSaving(true);
            window.setTimeout(() => {
              completeOnboarding(form);
              if (invitationProjectId) {
                acceptProjectInvitation(invitationProjectId, form);
                toast.success("Profile completed. Joined project team.");
              } else {
                toast.success("Profile completed. Welcome!");
              }
              setIsSaving(false);
              setIsComplete(true);
            }, 450);
          }}
        >
          <Field
            label="Institutional Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@mitwpu.edu.in"
            error={errors.email}
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
          />

          {/* Custom Select for Department */}
          <CustomSelect
            label="Department"
            value={form.department}
            options={departments}
            error={errors.department}
            onChange={set("department")}
          />

          {/* Custom Select for Programme */}
          <CustomSelect
            label="Programme"
            value={form.programme}
            options={programmes}
            error={errors.programme}
            onChange={set("programme")}
          />

          {/* Custom Select for Academic Year */}
          <CustomSelect
            label="Academic Year"
            value={form.academicYear}
            options={academicYears}
            error={errors.academicYear}
            onChange={set("academicYear")}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-xs font-bold uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-wait"
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | undefined;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border bg-secondary/40 px-4 text-sm outline-none transition-all",
          error
            ? "border-destructive focus:border-destructive"
            : "border-border focus:border-primary focus:ring-2 focus:ring-primary/15",
        )}
      />
      {error && <p className="text-[10px] font-mono text-destructive">{error}</p>}
    </div>
  );
}

interface CustomSelectProps {
  label: string;
  value: string;
  options: string[];
  error?: string | undefined;
  onChange: (value: string) => void;
}

function CustomSelect({ label, value, options, error, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
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
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border bg-secondary/40 px-4 text-left text-sm outline-none transition-all",
          error
            ? "border-destructive"
            : isOpen
              ? "border-primary ring-2 ring-primary/15"
              : "border-border hover:border-primary/40",
        )}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || `Select ${label.toLowerCase()}`}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-300",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-border bg-card shadow-lg duration-200">
          <div className="space-y-0.5 p-1">
            {options.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-xl px-4 py-2.5 text-left text-xs font-mono transition-all",
                    isSelected
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-[10px] font-mono text-destructive">{error}</p>}
    </div>
  );
}
