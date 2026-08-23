import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAppSession } from "@/lib/auth-context";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, authApi, referenceApi, usersApi, type UserDto } from "@/lib/api";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() {
  const { profile, role, user, prototype, reloadCurrentUser } = useAppSession();
  const [editOpen, setEditOpen] = useState(false);
  return (
    <AppShell title="Profile" subtitle="Your MakerSpace identity">
      <section className="card-surface p-6">
        <div className="grid size-16 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {profile.fullName
            .split(" ")
            .map((x) => x[0])
            .join("")}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{profile.fullName}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          {!prototype && role === "Student" && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
            >
              <Pencil className="size-4" /> Edit profile
            </button>
          )}
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {profile.prn && <Item label="PRN" value={profile.prn} />}
          <Item label="Role" value={role} />
          <Item label="Department" value={profile.department} />
          {profile.programme && (
            <Item label="Programme" value={`${profile.programme} · ${profile.academicYear}`} />
          )}
          {!prototype && user?.studentProfile?.division && (
            <Item label="Division" value={user.studentProfile.division} />
          )}
          {!prototype && user?.studentProfile?.phone && (
            <Item label="Phone" value={user.studentProfile.phone} />
          )}
          {!prototype && user?.lastLoginAt && (
            <Item label="Last sign-in" value={new Date(user.lastLoginAt).toLocaleString("en-IN")} />
          )}
        </dl>
      </section>
      <ResponsiveModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Student profile"
        description="Your verified Google email cannot be changed."
      >
        {user && (
          <StudentProfileEditor
            user={user}
            onSaved={async () => {
              await reloadCurrentUser();
              setEditOpen(false);
            }}
          />
        )}
      </ResponsiveModal>
    </AppShell>
  );
}

function StudentProfileEditor({ user, onSaved }: { user: UserDto; onSaved: () => Promise<void> }) {
  const [fullName, setFullName] = useState(user.name);
  const [prn, setPrn] = useState(user.studentProfile?.prn ?? "");
  const [departmentId, setDepartmentId] = useState(user.studentProfile?.department?.id ?? "");
  const [programmeId, setProgrammeId] = useState(user.studentProfile?.programme?.id ?? "");
  const [academicYear, setAcademicYear] = useState(user.studentProfile?.academicYear ?? 1);
  const [division, setDivision] = useState(user.studentProfile?.division ?? "");
  const [phone, setPhone] = useState(user.studentProfile?.phone ?? "");
  const policy = useQuery({
    queryKey: ["student-profile", "prn-policy"],
    queryFn: () => authApi.studentProfileConfig().then((r) => r.data.prn),
  });
  const departments = useQuery({
    queryKey: ["student-profile", "departments"],
    queryFn: () => referenceApi.departments().then((r) => r.data),
  });
  const programmes = useQuery({
    queryKey: ["student-profile", "programmes", departmentId],
    queryFn: () => referenceApi.programmes(departmentId).then((r) => r.data),
    enabled: Boolean(departmentId),
  });
  const years = useQuery({
    queryKey: ["student-profile", "academic-years"],
    queryFn: () => referenceApi.academicYears().then((r) => r.data),
  });
  const mutation = useMutation({
    mutationFn: () =>
      usersApi.updateOwnProfile({
        fullName: fullName.trim(),
        prn,
        departmentId,
        programmeId,
        academicYear,
        division: division.trim() || null,
        phone: phone.trim() || null,
      }),
    onSuccess: async () => {
      await onSaved();
      toast.success("Profile updated");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Profile could not be updated"),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <Field label="Verified email">
        <Input value={user.email} readOnly aria-readonly className="bg-secondary/50" />
      </Field>
      <Field label="Full name">
        <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      </Field>
      <Field label="PRN">
        <Input
          value={prn}
          onChange={(event) => setPrn(event.target.value.toUpperCase().replace(/\s+/g, ""))}
          maxLength={policy.data?.maxLength ?? 24}
          pattern={policy.data?.pattern}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {policy.data?.hint ?? "Enter the PRN issued by MIT-WPU."}
        </p>
      </Field>
      <Field label="Department">
        <select
          value={departmentId}
          onChange={(event) => {
            setDepartmentId(event.target.value);
            setProgrammeId("");
          }}
          required
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select department</option>
          {departments.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Programme">
        <select
          value={programmeId}
          onChange={(event) => setProgrammeId(event.target.value)}
          required
          disabled={!departmentId}
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
        >
          <option value="">Select programme</option>
          {programmes.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Academic year">
        <select
          value={academicYear}
          onChange={(event) => setAcademicYear(Number(event.target.value))}
          required
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {years.data?.map((item) => (
            <option key={item.id} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Division (optional)">
          <Input value={division} onChange={(event) => setDivision(event.target.value)} />
        </Field>
        <Field label="Phone (optional)">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
        </Field>
      </div>
      <button
        type="submit"
        disabled={mutation.isPending || !fullName.trim() || !prn || !departmentId || !programmeId}
        className="min-h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
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
