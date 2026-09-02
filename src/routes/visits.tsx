import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PersistedVisits } from "@/components/Visits/PersistedVisits";

export const Route = createFileRoute("/visits")({
  head: () => ({
    meta: [
      { title: "Visits — सृजन" },
      {
        name: "description",
        content: "Request a quick MakerSpace visit and review your visit history.",
      },
    ],
  }),
  component: VisitsPage,
});

function VisitsPage() {
  return (
    <AppShell title="Visits" subtitle="Quick visits and attendance">
      <PersistedVisits />
    </AppShell>
  );
}
