import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { requireOnboarding } from "@/lib/auth-guards";
import { ApiClientError } from "@/lib/api-client";

type Department = { id: string; code: string; name: string };
type Programme = { id: string; departmentId: string; code: string; name: string };
type AcademicYear = { id: string; value: number; label: string };
type ProfilePolicy = { prn: { pattern: string; hint: string; maxLength: number } };

export const Route = createFileRoute("/onboarding")({
  beforeLoad: requireOnboarding,
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

function Onboarding() {
  const { client, user } = useAuth();
  const navigate = useNavigate();
  const { invite } = Route.useSearch();
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [prn, setPrn] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [division, setDivision] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!fullName && user?.name) setFullName(user.name);
  }, [fullName, user?.name]);

  const departments = useQuery({
    queryKey: ["reference-data", "departments"],
    queryFn: () => client.api.request<Department[]>("/reference-data/departments"),
    staleTime: 5 * 60 * 1000,
  });
  const academicYears = useQuery({
    queryKey: ["reference-data", "academic-years"],
    queryFn: () => client.api.request<AcademicYear[]>("/reference-data/academic-years"),
    staleTime: 5 * 60 * 1000,
  });
  const programmes = useQuery({
    queryKey: ["reference-data", "programmes", departmentId],
    queryFn: () =>
      client.api.request<Programme[]>(
        `/reference-data/programmes?departmentId=${encodeURIComponent(departmentId)}`,
      ),
    enabled: Boolean(departmentId),
    staleTime: 5 * 60 * 1000,
  });
  const profilePolicy = useQuery({
    queryKey: ["student-profile-policy"],
    queryFn: () => client.api.request<ProfilePolicy>("/auth/student-profile/config"),
    staleTime: 5 * 60 * 1000,
  });

  const referenceError = departments.error ?? academicYears.error ?? programmes.error;
  const loadingReferences = departments.isLoading || academicYears.isLoading;
  const canSubmit = useMemo(
    () =>
      fullName.trim().length >= 2 &&
      Boolean(prn) &&
      (profilePolicy.data ? new RegExp(profilePolicy.data.prn.pattern).test(prn) : true) &&
      Boolean(departmentId && programmeId && academicYear) &&
      !submitting,
    [academicYear, departmentId, fullName, prn, profilePolicy.data, programmeId, submitting],
  );

  const retryReferences = () => {
    void departments.refetch();
    void academicYears.refetch();
    if (departmentId) void programmes.refetch();
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold text-primary">Step 1 of 1</p>
        <h1 className="mt-1 text-3xl font-bold">Complete your student profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We use these details to verify project registrations and MakerSpace visits.
        </p>

        <form
          className="card-surface mt-6 space-y-5 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            setSubmitting(true);
            setSubmitError(null);
            void client
              .completeOnboarding({
                fullName: fullName.trim(),
                prn,
                departmentId,
                programmeId,
                academicYear: Number(academicYear),
                ...(division.trim() ? { division: division.trim() } : {}),
                ...(phone.trim() ? { phone: phone.trim() } : {}),
              })
              .then(() => {
                toast.success("Profile completed. Welcome to the MakerSpace!");
                return invite
                  ? navigate({ to: "/invitations/$projectId", params: { projectId: invite } })
                  : navigate({ to: "/dashboard" });
              })
              .catch((error: unknown) => {
                const message =
                  error instanceof ApiClientError
                    ? fieldAwareMessage(error)
                    : "Your profile could not be saved. Please try again.";
                setSubmitError(message);
              })
              .finally(() => setSubmitting(false));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Institutional email</Label>
            <Input id="email" value={user?.email ?? ""} readOnly className="h-12 bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              autoComplete="name"
              className="h-12"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prn">PRN</Label>
            <Input
              id="prn"
              required
              inputMode="text"
              autoComplete="off"
              maxLength={profilePolicy.data?.prn.maxLength ?? 24}
              className="h-12"
              placeholder="MIT-WPU PRN"
              value={prn}
              onChange={(event) =>
                setPrn(
                  event.target.value
                    .toUpperCase()
                    .replace(/\s/g, "")
                    .slice(0, profilePolicy.data?.prn.maxLength ?? 24),
                )
              }
              aria-describedby="prn-help"
            />
            <p id="prn-help" className="text-xs text-muted-foreground">
              {profilePolicy.data?.prn.hint ?? "Enter the PRN issued by MIT-WPU."}
            </p>
          </div>

          {loadingReferences && (
            <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Loading university options…
            </div>
          )}

          {referenceError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">University options could not be loaded.</p>
              <button
                type="button"
                onClick={retryReferences}
                className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary"
              >
                <RefreshCw className="size-4" aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {!loadingReferences && !referenceError && (
            <>
              <FieldSelect
                id="department"
                label="Department"
                value={departmentId}
                options={(departments.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.code})`,
                }))}
                onChange={(value) => {
                  setDepartmentId(value);
                  setProgrammeId("");
                }}
              />
              <FieldSelect
                id="programme"
                label="Programme"
                value={programmeId}
                disabled={!departmentId || programmes.isLoading}
                options={(programmes.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={setProgrammeId}
              />
              <FieldSelect
                id="year"
                label="Academic year"
                value={academicYear}
                options={(academicYears.data ?? []).map((item) => ({
                  value: String(item.value),
                  label: item.label,
                }))}
                onChange={setAcademicYear}
              />
            </>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="division">Division (optional)</Label>
              <Input
                id="division"
                className="h-12"
                value={division}
                onChange={(event) => setDivision(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                className="h-12"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
            {submitting ? "Saving profile…" : "Complete onboarding"}
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
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-12 w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="min-h-11">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function fieldAwareMessage(error: ApiClientError) {
  if (error.code === "CONFLICT") return "That PRN is already connected to another account.";
  return error.details[0]?.message ?? error.message;
}
