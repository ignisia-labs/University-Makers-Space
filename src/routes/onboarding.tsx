import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMakerSpace } from "@/lib/makerspace-context";
import { academicYears, departments, programmes } from "@/lib/makerspace-data";

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
      { property: "og:title", content: "Student onboarding — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "One-step profile setup for MIT-WPU MakerSpace students.",
      },
    ],
  }),
  component: Onboarding,
});

type FormErrors = Partial<
  Record<"fullName" | "prn" | "department" | "programme" | "academicYear", string>
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
        <section className="card-surface w-full max-w-md p-6 text-center sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">Your profile is complete</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {invitationProjectId
              ? "You have joined the project team. Taking you to your dashboard…"
              : "You are ready to start your MakerSpace journey. Taking you to your dashboard…"}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <LoaderCircle className="size-4 animate-spin" /> Preparing your dashboard
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold text-primary">Step 1 of 1</p>
        <h1 className="mt-1 text-3xl font-bold">Complete your student profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We use these details to verify your project registrations and MakerSpace visits.
        </p>

        <form
          noValidate
          className="card-surface mt-6 space-y-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            setIsSaving(true);
            window.setTimeout(() => {
              completeOnboarding(form);
              if (invitationProjectId) {
                acceptProjectInvitation(invitationProjectId, form);
                toast.success("Profile completed. You have joined the project team.");
              } else {
                toast.success("Profile completed. Welcome to the MakerSpace!");
              }
              setIsSaving(false);
              setIsComplete(true);
            }, 450);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Institutional email</Label>
            <Input id="email" value={form.email} readOnly className="h-12 bg-muted" />
          </div>

          <TextField
            id="name"
            label="Full name"
            value={form.fullName}
            error={errors.fullName}
            onChange={set("fullName")}
          />
          <TextField
            id="prn"
            label="PRN"
            value={form.prn}
            error={errors.prn}
            placeholder="Enter your PRN"
            onChange={set("prn")}
          />
          <FieldSelect
            id="department"
            label="Department"
            value={form.department}
            options={departments}
            error={errors.department}
            onChange={set("department")}
          />
          <FieldSelect
            id="programme"
            label="Programme"
            value={form.programme}
            options={programmes}
            error={errors.programme}
            onChange={set("programme")}
          />
          <FieldSelect
            id="year"
            label="Academic year"
            value={form.academicYear}
            options={academicYears}
            error={errors.academicYear}
            onChange={set("academicYear")}
          />

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-80"
          >
            {isSaving ? (
              <>
                <LoaderCircle className="size-5 animate-spin" /> Saving your profile…
              </>
            ) : (
              "Complete Onboarding"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="h-12"
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldSelect({
  id,
  label,
  value,
  options,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full"
        >
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="min-h-11">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
