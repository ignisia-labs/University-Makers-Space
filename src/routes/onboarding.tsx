import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

function Onboarding() {
  const { profile, completeOnboarding, acceptProjectInvitation } = useMakerSpace();
  const navigate = useNavigate();
  const [form, setForm] = useState(profile);
  const { invite: invitationProjectId } = Route.useSearch();

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold text-primary">Step 1 of 1</p>
        <h1 className="mt-1 text-3xl font-bold">Complete your student profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We use these details to verify your project registrations and MakerSpace visits.
        </p>

        <form
          className="card-surface mt-6 space-y-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            completeOnboarding(form);
            if (invitationProjectId) {
              acceptProjectInvitation(invitationProjectId, form);
              toast.success("Profile completed. You have joined the project team.");
            } else {
              toast.success("Profile completed. Welcome to the MakerSpace!");
            }
            navigate({ to: "/dashboard" });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Institutional email</Label>
            <Input id="email" value={form.email} readOnly className="h-12 bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              className="h-12"
              value={form.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prn">PRN</Label>
            <Input
              id="prn"
              required
              inputMode="numeric"
              className="h-12"
              placeholder="10 digit PRN"
              value={form.prn}
              onChange={(e) => set("prn")(e.target.value)}
            />
          </div>

          <FieldSelect
            id="department"
            label="Department"
            value={form.department}
            options={departments}
            onChange={set("department")}
          />
          <FieldSelect
            id="programme"
            label="Programme"
            value={form.programme}
            options={programmes}
            onChange={set("programme")}
          />
          <FieldSelect
            id="year"
            label="Academic year"
            value={form.academicYear}
            options={academicYears}
            onChange={set("academicYear")}
          />

          <button
            type="submit"
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Complete Onboarding
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-12 w-full">
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
    </div>
  );
}
