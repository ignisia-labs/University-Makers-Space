import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AdminConsole } from "@/components/Admin/AdminConsole";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — सृजन" },
      { name: "description", content: "MakerSpace administration and oversight." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <AppShell title="Administration" subtitle="MakerSpace oversight">
      <AdminConsole />
    </AppShell>
  );
}
