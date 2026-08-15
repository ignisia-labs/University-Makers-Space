import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { requireAuthenticated } from "@/lib/auth-guards";
export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuthenticated,
  component: Profile,
});
function Profile() {
  const { user } = useAuth();
  const profile = user?.studentProfile;
  const role = user?.roles
    .map((item) =>
      item
        .toLowerCase()
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(", ");
  const displayName = user?.name ?? "MakerSpace user";
  return (
    <AppShell title="Profile" subtitle="Your MakerSpace identity">
      <section className="card-surface p-6">
        <div className="grid size-16 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {displayName
            .split(" ")
            .map((x) => x[0])
            .join("")}
        </div>
        <h2 className="mt-4 text-xl font-bold">{displayName}</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Item label="PRN" value={profile?.prn ?? "Not applicable"} />
          <Item label="Role" value={role || "User"} />
          <Item label="Department" value={profile?.department?.name ?? "Not applicable"} />
          <Item
            label="Programme"
            value={
              profile?.programme
                ? `${profile.programme.name} · Year ${profile.academicYear}`
                : "Not applicable"
            }
          />
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
