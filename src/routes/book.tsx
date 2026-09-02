import { createFileRoute } from "@tanstack/react-router";
import { PersistedAvailability } from "@/components/Booking/PersistedAvailability";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { project?: string } =>
    typeof search["project"] === "string" ? { project: search["project"] } : {},
  head: () => ({
    meta: [
      { title: "Slots — सृजन" },
      {
        name: "description",
        content: "Reserve a MakerSpace slot for your verified project and team.",
      },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { project } = Route.useSearch();
  return <PersistedAvailability preselectedProjectId={project} />;
}
