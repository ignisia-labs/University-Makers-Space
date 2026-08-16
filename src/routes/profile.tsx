import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, Pencil, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireAuthenticated } from "@/lib/auth-guards";
import { useAuth } from "@/lib/auth-context";
import { ApiClientError } from "@/lib/api-client";

type Department = { id: string; code: string; name: string };
type Programme = { id: string; departmentId: string; code: string; name: string };
type AcademicYear = { id: string; value: number; label: string };
type ProfilePolicy = { prn: { pattern: string; hint: string; maxLength: number } };

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuthenticated,
  component: Profile,
});

function Profile() {
  const { client, user } = useAuth();
  const profile = user?.studentProfile;
  const isStudent = Boolean(user?.roles.includes("STUDENT") && profile);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [prn, setPrn] = useState(profile?.prn ?? "");
  const [departmentId, setDepartmentId] = useState(profile?.department?.id ?? "");
  const [programmeId, setProgrammeId] = useState(profile?.programme?.id ?? "");
  const [academicYear, setAcademicYear] = useState(String(profile?.academicYear ?? ""));
  const [division, setDivision] = useState(profile?.division ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  useEffect(() => {
    if (!editing) {
      setFullName(user?.name ?? "");
      setPrn(profile?.prn ?? "");
      setDepartmentId(profile?.department?.id ?? "");
      setProgrammeId(profile?.programme?.id ?? "");
      setAcademicYear(String(profile?.academicYear ?? ""));
      setDivision(profile?.division ?? "");
      setPhone(profile?.phone ?? "");
    }
  }, [editing, profile, user?.name]);

  const departments = useQuery({
    queryKey: ["reference-data", "departments"],
    queryFn: () => client.api.request<Department[]>("/reference-data/departments"),
    enabled: editing,
    staleTime: 5 * 60_000,
  });
  const years = useQuery({
    queryKey: ["reference-data", "academic-years"],
    queryFn: () => client.api.request<AcademicYear[]>("/reference-data/academic-years"),
    enabled: editing,
    staleTime: 5 * 60_000,
  });
  const programmes = useQuery({
    queryKey: ["reference-data", "programmes", departmentId],
    queryFn: () =>
      client.api.request<Programme[]>(
        `/reference-data/programmes?departmentId=${encodeURIComponent(departmentId)}`,
      ),
    enabled: editing && Boolean(departmentId),
    staleTime: 5 * 60_000,
  });
  const policy = useQuery({
    queryKey: ["student-profile-policy"],
    queryFn: () => client.api.request<ProfilePolicy>("/auth/student-profile/config"),
    enabled: isStudent,
    staleTime: 5 * 60_000,
  });
  const save = useMutation({
    mutationFn: () =>
      client.api.request("/users/me/student-profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: fullName.trim(),
          prn,
          departmentId,
          programmeId,
          academicYear: Number(academicYear),
          division: division.trim() || null,
          phone: phone.trim() || null,
        }),
      }),
    onSuccess: async () => {
      await client.refreshCurrentUser();
      setEditing(false);
      toast.success("Profile updated.");
    },
  });

  const role = user?.roles.map(humanRole).join(", ") || "User";
  const displayName = user?.name ?? "MakerSpace user";

  return (
    <AppShell title="Profile" subtitle="Your MIT-WPU MakerSpace identity">
      <section className="card-surface overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold">{displayName}</h2>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <p className="mt-1 text-xs font-semibold text-primary">{role}</p>
            </div>
          </div>
          {isStudent && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-accent"
            >
              <Pencil className="size-4" /> Edit profile
            </button>
          )}
        </div>

        {!editing ? (
          <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <Item label="PRN" value={profile?.prn ?? "Not applicable"} />
            <Item label="Department" value={profile?.department?.name ?? "Not applicable"} />
            <Item label="Programme" value={profile?.programme?.name ?? "Not applicable"} />
            <Item
              label="Academic year"
              value={profile ? `Year ${profile.academicYear}` : "Not applicable"}
            />
            <Item label="Division" value={profile?.division ?? "Not provided"} />
            <Item label="Phone" value={profile?.phone ?? "Not provided"} />
          </dl>
        ) : (
          <form
            className="space-y-5 p-5 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id="profile-name"
                label="Full name"
                value={fullName}
                onChange={setFullName}
              />
              <div className="space-y-2">
                <Label htmlFor="profile-prn">PRN</Label>
                <Input
                  id="profile-prn"
                  className="h-12"
                  value={prn}
                  maxLength={policy.data?.prn.maxLength ?? 24}
                  onChange={(event) => setPrn(event.target.value.toUpperCase().replace(/\s/g, ""))}
                />
                <p className="text-xs text-muted-foreground">
                  {policy.data?.prn.hint ?? "Enter the PRN issued by MIT-WPU."}
                </p>
              </div>
              <SelectField
                label="Department"
                value={departmentId}
                onChange={(value) => {
                  setDepartmentId(value);
                  setProgrammeId("");
                }}
                options={(departments.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.code})`,
                }))}
              />
              <SelectField
                label="Programme"
                value={programmeId}
                onChange={setProgrammeId}
                options={(programmes.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                disabled={!departmentId}
              />
              <SelectField
                label="Academic year"
                value={academicYear}
                onChange={setAcademicYear}
                options={(years.data ?? []).map((item) => ({
                  value: String(item.value),
                  label: item.label,
                }))}
              />
              <TextField
                id="profile-division"
                label="Division (optional)"
                value={division}
                onChange={setDivision}
              />
              <TextField
                id="profile-phone"
                label="Phone (optional)"
                value={phone}
                onChange={setPhone}
                type="tel"
              />
            </div>
            {save.isError && (
              <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {save.error instanceof ApiClientError
                  ? (save.error.details[0]?.message ?? save.error.message)
                  : "Your profile could not be updated."}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold"
              >
                <X className="size-4" /> Cancel
              </button>
              <button
                type="submit"
                disabled={
                  save.isPending ||
                  fullName.trim().length < 2 ||
                  !prn ||
                  !departmentId ||
                  !programmeId ||
                  !academicYear
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {save.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </section>
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        className="h-12"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-12 w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function humanRole(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
