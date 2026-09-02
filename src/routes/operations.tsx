import { createFileRoute } from "@tanstack/react-router";
import { Boxes, CalendarClock, Footprints, Layers, PackageCheck } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveConsole, type OperationsWorkspace } from "@/components/Operations/LiveConsole";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations — सृजन" },
      { name: "description", content: "Sessions, visits and live equipment control." },
    ],
  }),
  component: OperationsPage,
});

const workspaces = [
  { id: "sessions", label: "Sessions", icon: CalendarClock },
  { id: "visits", label: "Visits", icon: Footprints },
  { id: "materials", label: "Materials", icon: PackageCheck },
  { id: "equipment", label: "Equipment", icon: Boxes },
  { id: "catalogue", label: "Catalogue", icon: Layers },
] as const;

function OperationsPage() {
  const [workspace, setWorkspace] = useState<OperationsWorkspace>("sessions");
  return (
    <AppShell
      title="Operations"
      subtitle="Lab assistant workspace"
      workspaceNavigation={workspaces}
      activeWorkspace={workspace}
      onWorkspaceChange={(id) => setWorkspace(id as OperationsWorkspace)}
    >
      <LiveConsole workspace={workspace} />
    </AppShell>
  );
}
