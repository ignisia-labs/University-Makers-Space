import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/equipment")({
  head: () => ({
    meta: [
      { title: "Equipment catalogue — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Browse MakerSpace 3D printers, laser cutters, robotics kits, electronics benches and CAD workstations.",
      },
      { property: "og:title", content: "Equipment catalogue — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Live status and specifications for every MakerSpace machine.",
      },
    ],
  }),
  component: EquipmentPage,
});

function EquipmentPage() {
  const { equipment, equipmentCategories } = useMakerSpace();
  const [filter, setFilter] = useState("All");
  const categories = ["All", ...equipmentCategories];
  const items = equipment.filter(
    (item) => item.visible && (filter === "All" || item.category === filter),
  );

  return (
    <AppShell title="Equipment" subtitle={`${items.length} machines listed`}>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {categories.map((category) => (
          <li key={category} className="shrink-0">
            <button
              type="button"
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                filter === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {category}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="card-surface overflow-hidden">
            <div className="aspect-video overflow-hidden bg-muted">
              <img
                src={item.image}
                alt={item.name}
                loading="lazy"
                width={800}
                height={600}
                className="size-full object-cover"
              />
            </div>
            <div className="p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold">{item.name}</h2>
                <StatusBadge label={item.status} />
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{item.category}</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {item.specs.map((spec) => (
                  <li key={spec}>· {spec}</li>
                ))}
              </ul>
              {item.availabilityReason && (
                <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                  {item.availabilityReason}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
