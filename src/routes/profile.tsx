import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAppSession } from "@/lib/auth-context";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() {
  const { profile, role, user, prototype } = useAppSession();
  return (
    <AppShell title="Profile" subtitle="Your MakerSpace identity">
      <section className="card-surface p-6">
        <div className="grid size-16 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {profile.fullName
            .split(" ")
            .map((x) => x[0])
            .join("")}
        </div>
        <h2 className="mt-4 text-xl font-bold">{profile.fullName}</h2>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {profile.prn && <Item label="PRN" value={profile.prn} />}
          <Item label="Role" value={role} />
          <Item label="Department" value={profile.department} />
          {profile.programme && (
            <Item label="Programme" value={`${profile.programme} · ${profile.academicYear}`} />
          )}
          {!prototype && user?.lastLoginAt && (
            <Item label="Last sign-in" value={new Date(user.lastLoginAt).toLocaleString("en-IN")} />
          )}
        </dl>
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
