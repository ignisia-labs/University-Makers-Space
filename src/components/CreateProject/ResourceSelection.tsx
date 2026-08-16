import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import type { ProjectResourceCatalog } from "@/lib/project-types";
import { cn } from "@/lib/utils";

export function ResourceSelection({
  labId,
  equipmentIds,
  consumableIds,
  onEquipmentChange,
  onConsumableChange,
}: {
  labId: string;
  equipmentIds: string[];
  consumableIds: string[];
  onEquipmentChange: (ids: string[]) => void;
  onConsumableChange: (ids: string[]) => void;
}) {
  const { client } = useAuth();
  const [search, setSearch] = useState("");
  const catalogue = useQuery({
    queryKey: ["project-resources", labId],
    queryFn: () =>
      client.api.request<ProjectResourceCatalog>(
        `/reference-data/project-resources?labId=${encodeURIComponent(labId)}`,
      ),
    enabled: Boolean(labId),
    staleTime: 60_000,
  });
  const term = search.trim().toLowerCase();
  const equipment = (catalogue.data?.equipment ?? []).filter(
    (item) =>
      item.name.toLowerCase().includes(term) || item.category.name.toLowerCase().includes(term),
  );
  const consumables = (catalogue.data?.consumables ?? []).filter(
    (item) =>
      item.name.toLowerCase().includes(term) || item.category.name.toLowerCase().includes(term),
  );

  return (
    <section aria-labelledby="resource-selection-title" className="min-w-0">
      <h2 id="resource-selection-title" className="text-lg font-semibold">
        Expected resources
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These choices help the lab plan. They do not reserve machines, stock, or time.
      </p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search the configured catalogue"
          className="h-12 pl-10"
        />
      </div>
      {catalogue.isLoading && (
        <p className="mt-4 flex min-h-24 items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading configured resources…
        </p>
      )}
      {catalogue.isError && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The resource catalogue could not be loaded.
          <button type="button" onClick={() => void catalogue.refetch()} className="ml-2 font-bold">
            Retry
          </button>
        </div>
      )}
      {catalogue.data && (
        <Tabs defaultValue="equipment" className="mt-4 min-w-0">
          <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="equipment">
              Equipment{equipmentIds.length ? ` · ${equipmentIds.length}` : ""}
            </TabsTrigger>
            <TabsTrigger value="consumables">
              Consumables{consumableIds.length ? ` · ${consumableIds.length}` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="equipment">
            <ResourceGrid
              items={equipment.map((item) => ({
                id: item.id,
                name: item.name,
                detail: `${item.category.name} · ${humanEquipmentStatus(item.status)}`,
              }))}
              selected={equipmentIds}
              onChange={onEquipmentChange}
              empty="No configured equipment matches this search."
            />
          </TabsContent>
          <TabsContent value="consumables">
            <ResourceGrid
              items={consumables.map((item) => ({
                id: item.id,
                name: item.name,
                detail: `${item.category.name} · ${item.unit}`,
              }))}
              selected={consumableIds}
              onChange={onConsumableChange}
              empty="No configured consumables match this search."
            />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

function ResourceGrid({
  items,
  selected,
  onChange,
  empty,
}: {
  items: Array<{ id: string; name: string; detail: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  if (!items.length) {
    return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(active ? selected.filter((id) => id !== item.id) : [...selected, item.id])
              }
              className={cn(
                "min-h-16 w-full rounded-xl border px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">{item.name}</span>
              <span
                className={cn(
                  "mt-0.5 block text-xs",
                  active ? "opacity-80" : "text-muted-foreground",
                )}
              >
                {item.detail}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function humanEquipmentStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
