import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PersistedJourney } from "@/components/Dashboard/PersistedJourney";
import { useAppSession } from "@/lib/auth-context";
import { usePersistedProjects } from "@/lib/project-queries";
import { usePersistedBookings } from "@/lib/booking-queries";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — सृजन" },
      {
        name: "description",
        content: "Your MakerSpace journey — create a project, book a slot, build.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAppSession();
  const projects = usePersistedProjects();
  const upcomingBookings = usePersistedBookings("upcoming", 1, 1);
  const firstName = profile.fullName.trim().split(" ")[0] || "there";

  return (
    <AppShell title={`Hi, ${firstName}`} subtitle={profile.department}>
      <PersistedJourney
        projects={projects.data ?? []}
        upcoming={upcomingBookings.data?.data[0]}
        loading={projects.isPending}
      />
    </AppShell>
  );
}
