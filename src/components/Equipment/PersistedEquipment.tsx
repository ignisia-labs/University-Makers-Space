import { useQuery } from "@tanstack/react-query";
import { ImageOff, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Pagination } from "@/components/Pagination";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { equipmentApi, referenceApi, type EquipmentDto } from "@/lib/api";
import { cn } from "@/lib/utils";

const usableStatuses = new Set(["AVAILABLE", "PARTIALLY_AVAILABLE", "IN_USE"]);

/** The machine catalogue students browse before choosing a project's kit. */
export function PersistedEquipment() {
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ["equipment-categories"],
    queryFn: () => referenceApi.equipmentCategories().then((response) => response.data),
    staleTime: 300_000,
  });
  // Paged server-side, and filtered server-side too: narrowing to a category
  // client-side would only ever narrow the current page, so a machine on page
  // two would look as if it did not exist.
  const equipment = useQuery({
    queryKey: ["equipment", "catalogue", filter, page],
    queryFn: () =>
      equipmentApi.list({
        page: String(page),
        limit: "24",
        ...(filter === "All" ? {} : { category: filter }),
      }),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const items = useMemo(
    () => (equipment.data?.data ?? []).filter((item) => item.visible),
    [equipment.data],
  );
  const tabs = ["All", ...(categories.data ?? []).map((category) => category.name)];
  const selected = (equipment.data?.data ?? []).find((item) => item.id === selectedId) ?? null;

  if (equipment.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="card-surface h-72 animate-pulse bg-muted/40" aria-busy />
        ))}
      </div>
    );
  }

  return (
    <>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {tabs.map((category) => (
          <li key={category} className="shrink-0">
            <button
              type="button"
              aria-pressed={filter === category}
              onClick={() => {
                setFilter(category);
                setPage(1);
              }}
              className={cn(
                "min-h-10 rounded-full border px-4 text-[11px] font-mono uppercase tracking-wider transition-colors",
                filter === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {category}
            </button>
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <div className="card-surface mt-4 px-6 py-16 text-center text-sm text-muted-foreground">
          No machines are listed in this category yet.
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <EquipmentCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
          ))}
        </div>
      )}

      <Pagination
        meta={equipment.data?.meta}
        onPage={setPage}
        busy={equipment.isFetching}
        noun="machines"
      />

      <ResponsiveModal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.name ?? "Equipment"}
        description={selected?.category ?? ""}
      >
        {selected && <EquipmentDetail item={selected} />}
      </ResponsiveModal>
    </>
  );
}

function EquipmentCard({ item, onOpen }: { item: EquipmentDto; onOpen: () => void }) {
  const usable = usableStatuses.has(item.status);
  const freeRatio = Math.round((item.availableQuantity / Math.max(1, item.totalQuantity)) * 100);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-surface group overflow-hidden text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <EquipmentImage
          item={item}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute left-3 top-3">
          <StatusBadge label={statusLabel(item.status)} className="bg-card/90 backdrop-blur" />
        </span>
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <span className="min-w-0">
            <span className="block truncate font-serif text-lg font-light text-white">
              {item.name}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-white/70">
              <MapPin className="size-3" /> MakerSpace
            </span>
          </span>
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            {item.category}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {item.availableQuantity} of {item.totalQuantity} free
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              usable ? "bg-primary" : "bg-muted-foreground/40",
            )}
            style={{ width: `${freeRatio}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.specs.slice(0, 3).map((spec) => (
            <span
              key={spec}
              className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {spec}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

/**
 * A machine's photo, or a labelled placeholder.
 *
 * Photos are optional — a machine added this morning may not have one yet — so
 * the placeholder is a designed state rather than a broken image icon, and it
 * keeps the card's height stable either way. Images are lazy and sized, so a
 * long catalogue does not fetch thirty photos before the first paint.
 */
function EquipmentImage({ item, className }: { item: EquipmentDto; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageUrl || failed) {
    return (
      <span className="grid size-full place-items-center bg-secondary/60 text-muted-foreground">
        <ImageOff className="size-7" aria-hidden />
        <span className="sr-only">No photo yet for {item.name}</span>
      </span>
    );
  }
  return (
    <img
      src={item.imageUrl}
      alt={item.name}
      loading="lazy"
      decoding="async"
      width={800}
      height={600}
      onError={() => setFailed(true)}
      className={cn("size-full object-cover", className)}
    />
  );
}

function EquipmentDetail({ item }: { item: EquipmentDto }) {
  return (
    <div className="min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
        <EquipmentImage item={item} />
        <span className="absolute left-3 top-3">
          <StatusBadge label={statusLabel(item.status)} className="bg-card/90 backdrop-blur" />
        </span>
      </div>

      {item.description && (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <DetailFact label="Category" value={item.category ?? "—"} />
        <DetailFact
          label="Units free"
          value={`${item.availableQuantity} of ${item.totalQuantity}`}
        />
        <DetailFact label="Status" value={statusLabel(item.status)} />
        <DetailFact
          label="Last updated"
          value={new Date(item.updatedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        />
      </dl>

      {item.specs.length > 0 && (
        <>
          <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-primary">
            Specifications
          </p>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {item.specs.map((spec) => (
              <li key={spec} className="px-4 py-2.5 text-sm text-muted-foreground">
                {spec}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
      <dt className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
