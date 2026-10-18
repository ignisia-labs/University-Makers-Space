import { Minus, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { DomainConsumable, ProjectResources, ResourceDomain } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ConsumablePlan = { consumableId: string; quantity: number; variant?: string | null };
export type ResourceKit = { equipmentIds: string[]; consumables: ConsumablePlan[] };

export const emptyKit: ResourceKit = { equipmentIds: [], consumables: [] };

/**
 * Choosing what a project needs, by domain.
 *
 * A build is a kind of work before it is a particular machine, so the domain is
 * the entry point and everything inside it — machines from any category, and
 * the materials that go with them — follows from that choice. Quantities are
 * asked for here because the number the mentor approves becomes the ceiling on
 * what the team may collect later.
 */
export function ResourceSelection({
  resources,
  kit,
  onChange,
}: {
  resources: ProjectResources;
  kit: ResourceKit;
  onChange: (kit: ResourceKit) => void;
}) {
  const domains = resources.domains;
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  useEffect(() => {
    if (domains.length && !domains.some((entry) => entry.id === domainId)) {
      setDomainId(domains[0]!.id);
    }
  }, [domains, domainId]);
  const domain = domains.find((entry) => entry.id === domainId) ?? domains[0];

  // A stock room holds hundreds of parts — the electronics domain alone came in
  // at 24 machines and 150 materials. Scrolling that to find one resistor value
  // is not a choice anyone can make, so the domain's contents are filterable.
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const matches = (name: string, extra?: string) =>
    !needle || name.toLowerCase().includes(needle) || (extra ?? "").toLowerCase().includes(needle);
  const shownEquipment = (domain?.equipment ?? []).filter((item) =>
    matches(item.name, item.category.name),
  );
  const shownConsumables = (domain?.consumables ?? []).filter((item) =>
    matches(item.name, item.category.name),
  );

  const toggleEquipment = (id: string) =>
    onChange({
      ...kit,
      equipmentIds: kit.equipmentIds.includes(id)
        ? kit.equipmentIds.filter((entry) => entry !== id)
        : [...kit.equipmentIds, id],
    });

  const setConsumable = (item: DomainConsumable, quantity: number, variant: string | null) => {
    const others = kit.consumables.filter((entry) => entry.consumableId !== item.id);
    const ceiling = item.maxPerProject ?? 999;
    onChange({
      ...kit,
      consumables:
        quantity <= 0
          ? others
          : [...others, { consumableId: item.id, quantity: Math.min(quantity, ceiling), variant }],
    });
  };

  if (domains.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
        The MakerSpace catalogue is empty. Ask an administrator to add domains and equipment.
      </p>
    );
  }

  const chosenCount = kit.equipmentIds.length + kit.consumables.length;

  return (
    <section aria-labelledby="resource-selection-title" className="min-w-0 max-w-full">
      <h2 id="resource-selection-title" className="sr-only">
        Choose your resources
      </h2>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        role="tablist"
        aria-label="MakerSpace domains"
      >
        {domains.map((entry) => (
          <DomainTile
            key={entry.id}
            domain={entry}
            active={entry.id === domain?.id}
            count={countIn(entry, kit)}
            onSelect={() => {
              setDomainId(entry.id);
              // A filter typed for one domain means nothing in the next.
              setFilter("");
            }}
          />
        ))}
      </div>

      {domain && (
        <>
          {(domain.equipment.length + domain.consumables.length > 12 || needle) && (
            <div className="relative mt-5">
              <Search
                className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                aria-hidden
              />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={`Search ${domain.name.toLowerCase()} — name or category`}
                aria-label="Filter this domain"
                className="form-input pl-9"
              />
            </div>
          )}

          <div className="mt-6">
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              Equipment
              {needle && domain.equipment.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  {shownEquipment.length} of {domain.equipment.length}
                </span>
              )}
            </p>
            {shownEquipment.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {shownEquipment.map((item) => {
                  const active = kit.equipmentIds.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleEquipment(item.id)}
                        className={cn(
                          "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                          active
                            ? "border-primary bg-primary/[0.05] shadow-sm"
                            : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.name}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {item.specs[0] ?? item.category.name}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-md border text-[10px]",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                          aria-hidden
                        >
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {needle
                  ? `No machines here match “${filter.trim()}”.`
                  : "No machines are filed under this domain yet."}
              </p>
            )}
          </div>

          {domain.consumables.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                Materials
                {needle && (
                  <span className="ml-2 text-muted-foreground">
                    {shownConsumables.length} of {domain.consumables.length}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ask for what you expect to use. Your mentor approves this figure, and it is the most
                you can collect during your sessions.
              </p>
              <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                {shownConsumables.map((item) => (
                  <ConsumableRow
                    key={item.id}
                    item={item}
                    plan={kit.consumables.find((entry) => entry.consumableId === item.id)}
                    onChange={(quantity, variant) => setConsumable(item, quantity, variant)}
                  />
                ))}
                {shownConsumables.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">
                    No materials here match “{filter.trim()}”.
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-xl border border-border bg-secondary/50 px-4 py-3">
        {chosenCount ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Your kit
            </span>
            {kit.equipmentIds.map((id) => (
              <span
                key={id}
                className="rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {resources.equipment.find((item) => item.id === id)?.name ?? "Equipment"}
              </span>
            ))}
            {kit.consumables.map((entry) => {
              const item = resources.consumables.find((row) => row.id === entry.consumableId);
              return (
                <span
                  key={entry.consumableId}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {item?.name ?? "Material"} × {entry.quantity} {item?.unit ?? ""}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick a domain above, then select what your build needs.
          </p>
        )}
      </div>
    </section>
  );
}

function DomainTile({
  domain,
  active,
  count,
  onSelect,
}: {
  domain: ResourceDomain;
  active: boolean;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-2xl bg-secondary text-left transition-all duration-300",
        active
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "opacity-85 hover:opacity-100",
      )}
    >
      {domain.imageUrl ? (
        <img
          src={domain.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 size-full object-cover transition-transform duration-500",
            active ? "scale-105" : "group-hover:scale-105",
          )}
        />
      ) : (
        // Without a photo the tile still needs depth, or the wordmark sits on
        // flat grey and the grid reads as unfinished rather than unillustrated.
        <span className="absolute inset-0 bg-gradient-to-br from-primary/70 to-primary/30" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      {count > 0 && (
        <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
          {count}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 p-3">
        <span className="block font-serif text-sm font-medium leading-tight text-white">
          {domain.name}
        </span>
        {domain.tagline && (
          <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-widest text-white/60">
            {domain.tagline}
          </span>
        )}
      </span>
    </button>
  );
}

function ConsumableRow({
  item,
  plan,
  onChange,
}: {
  item: DomainConsumable;
  plan: ConsumablePlan | undefined;
  onChange: (quantity: number, variant: string | null) => void;
}) {
  const variant = plan?.variant ?? item.variants[0] ?? null;
  const quantity = plan?.quantity ?? 0;
  const ceiling = item.maxPerProject ?? 99;

  return (
    <li className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            per {item.unit}
            {item.maxPerProject !== null && ` · max ${item.maxPerProject}`}
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={`${item.name} quantity`}>
          <button
            type="button"
            aria-label={`Fewer ${item.name}`}
            disabled={quantity === 0}
            onClick={() => onChange(quantity - 1, variant)}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-35"
          >
            <Minus className="size-3.5" />
          </button>
          <span
            className={cn(
              "w-8 text-center font-mono text-sm",
              quantity ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label={`More ${item.name}`}
            disabled={quantity >= ceiling}
            onClick={() => onChange(quantity + 1, variant)}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-35"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      {item.variants.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.variants.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === variant}
              onClick={() => onChange(quantity || 1, option)}
              className={cn(
                "min-h-8 rounded-full border px-3 text-[11px] font-medium transition-colors",
                option === variant && quantity
                  ? "border-primary bg-primary text-primary-foreground"
                  : option === variant
                    ? "border-primary/50 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function countIn(domain: ResourceDomain, kit: ResourceKit) {
  const equipment = domain.equipment.filter((item) => kit.equipmentIds.includes(item.id)).length;
  const consumables = domain.consumables.filter((item) =>
    kit.consumables.some((entry) => entry.consumableId === item.id),
  ).length;
  return equipment + consumables;
}
