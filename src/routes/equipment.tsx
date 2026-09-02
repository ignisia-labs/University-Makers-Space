import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PersistedEquipment } from "@/components/Equipment/PersistedEquipment";

export const Route = createFileRoute("/equipment")({
  head: () => ({
    meta: [
      { title: "Equipment — सृजन" },
      {
        name: "description",
        content: "Browse the MakerSpace machine catalogue before choosing your project's kit.",
      },
    ],
  }),
  component: EquipmentPage,
});

function EquipmentPage() {
  return (
    <AppShell title="Equipment" subtitle="MakerSpace catalogue">
      <PersistedEquipment />
    </AppShell>
  );
}
