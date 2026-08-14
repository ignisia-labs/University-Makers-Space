import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const categories = {
  prototyping: {
    label: "Prototyping Machines",
    items: ["FDM 3D Printer", "Resin 3D Printer", "CO2 Laser Cutter", "CAD Workstation"],
  },
  electronics: {
    label: "Electronics & Measurement",
    items: ["Soldering Station", "Oscilloscope", "Robotic Arm"],
  },
  fabrication: {
    label: "Fabrication Materials",
    items: ["PLA Filament", "Acrylic Sheets", "MDF Board"],
  },
  components: {
    label: "Components",
    items: ["Jumper Wires", "PCB Blanks"],
  },
} as const;

type CategoryId = keyof typeof categories;

export function ResourceSelection({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (resources: string[]) => void;
}) {
  const [tab, setTab] = useState<CategoryId>("prototyping");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const toggle = (resource: string) =>
    onChange(
      selected.includes(resource)
        ? selected.filter((item) => item !== resource)
        : [...selected, resource],
    );

  return (
    <section aria-labelledby="resource-selection-title">
      <h2 id="resource-selection-title" className="text-lg font-semibold">
        Resources for this project
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Select the equipment and consumables your team expects to need.
      </p>
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search resources"
        className="mt-5 h-12"
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as CategoryId)} className="mt-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl p-1">
          {Object.entries(categories).map(([id, category]) => (
            <TabsTrigger key={id} value={id} className="min-h-11 shrink-0 px-3 text-xs">
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(categories).map(([id, category]) => {
          const items = category.items.filter((item) =>
            item.toLowerCase().includes(debouncedSearch),
          );
          return (
            <TabsContent key={id} value={id}>
              {items.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {items.map((item) => {
                    const active = selected.includes(item);
                    return (
                      <li key={item}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggle(item)}
                          className={cn(
                            "min-h-14 w-full rounded-xl border px-4 text-left text-sm font-medium transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:bg-accent",
                          )}
                        >
                          {item}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                  No resources match this search in {category.label}.
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
