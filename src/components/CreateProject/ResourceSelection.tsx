import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import {
  resourceDomains,
  type ConsumableSelection,
  type DomainConsumable,
  type ResourceKit,
} from "@/lib/project-resources";
import { cn } from "@/lib/utils";

export function ResourceSelection({
  kit,
  onChange,
}: {
  kit: ResourceKit;
  onChange: (kit: ResourceKit) => void;
}) {
  const [domainId, setDomainId] = useState(resourceDomains[0]!.id);
  const domain = resourceDomains.find((d) => d.id === domainId) ?? resourceDomains[0]!;

  const toggleEquipment = (name: string) =>
    onChange({
      ...kit,
      equipment: kit.equipment.includes(name)
        ? kit.equipment.filter((item) => item !== name)
        : [...kit.equipment, name],
    });

  const setConsumable = (item: DomainConsumable, variant: string, qty: number) => {
    const others = kit.consumables.filter((c) => c.name !== item.name);
    onChange({
      ...kit,
      consumables:
        qty <= 0 ? others : [...others, { name: item.name, variant, qty: Math.min(qty, item.max) }],
    });
  };

  const domainCount = (id: string) => {
    const d = resourceDomains.find((entry) => entry.id === id)!;
    const equipmentCount = d.equipment.filter((e) => kit.equipment.includes(e.name)).length;
    const consumableCount = d.consumables.filter((c) =>
      kit.consumables.some((sel) => sel.name === c.name),
    ).length;
    return equipmentCount + consumableCount;
  };

  const totalCount = kit.equipment.length + kit.consumables.length;

  return (
    <section aria-labelledby="resource-selection-title" className="min-w-0 max-w-full">
      <h2 id="resource-selection-title" className="sr-only">
        Choose your resources
      </h2>

      {/* Domain selector — graphical entry point */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        role="tablist"
        aria-label="MakerSpace domains"
      >
        {resourceDomains.map((d) => {
          const active = d.id === domainId;
          const count = domainCount(d.id);
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDomainId(d.id)}
              className={cn(
                "group relative aspect-[4/3] overflow-hidden rounded-2xl text-left transition-all duration-300",
                active
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-80 hover:opacity-100",
              )}
            >
              <img
                src={d.image}
                alt=""
                className={cn(
                  "absolute inset-0 size-full object-cover transition-transform duration-500",
                  active ? "scale-105" : "group-hover:scale-105",
                )}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              {count > 0 && (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block font-serif text-sm font-medium leading-tight text-white">
                  {d.name}
                </span>
                <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-widest text-white/60">
                  {d.tagline}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Equipment in the selected domain */}
      <div className="mt-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Equipment</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {domain.equipment.map((item) => {
            const active = kit.equipment.includes(item.name);
            return (
              <li key={item.name}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleEquipment(item.name)}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                    active
                      ? "border-primary bg-primary/[0.05] shadow-sm"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    )}
                  >
                    {active && <Check className="size-3 stroke-[3]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {item.spec}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Consumables in the selected domain */}
      {domain.consumables.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Materials</p>
          <ul className="mt-3 space-y-2">
            {domain.consumables.map((item) => {
              const selection = kit.consumables.find((c) => c.name === item.name);
              return (
                <ConsumableRow
                  key={item.name}
                  item={item}
                  selection={selection}
                  onSelect={(variant, qty) => setConsumable(item, variant, qty)}
                />
              );
            })}
          </ul>
        </div>
      )}

      {/* Kit summary */}
      <div className="mt-6 rounded-xl border border-border bg-secondary/50 px-4 py-3">
        {totalCount ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Your kit
            </span>
            {kit.equipment.map((name) => (
              <span
                key={name}
                className="rounded-full border border-primary/20 bg-card px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {name}
              </span>
            ))}
            {kit.consumables.map((c) => (
              <span
                key={c.name}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {c.name} × {c.qty}
              </span>
            ))}
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

function ConsumableRow({
  item,
  selection,
  onSelect,
}: {
  item: DomainConsumable;
  selection: ConsumableSelection | undefined;
  onSelect: (variant: string, qty: number) => void;
}) {
  const variant = selection?.variant ?? item.variants[0]!;
  const qty = selection?.qty ?? 0;
  return (
    <li className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.name}</p>
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            per {item.unit} · max {item.max}
          </p>
        </div>
        <div className="flex items-center gap-1" aria-label={`${item.name} quantity`}>
          <button
            type="button"
            aria-label={`Fewer ${item.name}`}
            disabled={qty === 0}
            onClick={() => onSelect(variant, qty - 1)}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-35"
          >
            <Minus className="size-3.5" />
          </button>
          <span
            className={cn(
              "w-8 text-center font-mono text-sm",
              qty ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {qty}
          </span>
          <button
            type="button"
            aria-label={`More ${item.name}`}
            disabled={qty >= item.max}
            onClick={() => onSelect(variant, qty + 1)}
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
              onClick={() => onSelect(option, qty || 1)}
              className={cn(
                "min-h-8 rounded-full border px-3 text-[11px] font-medium transition-colors",
                option === variant && qty
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
