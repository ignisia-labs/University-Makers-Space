import { createFileRoute } from "@tanstack/react-router";
import { FileUp, MapPin, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import type { Equipment } from "@/lib/makerspace-data";
import { useMakerSpace } from "@/lib/makerspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/equipment")({
  head: () => ({
    meta: [
      { title: "Equipment — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Browse MakerSpace 3D printers, laser cutters, robotics kits, electronics benches and CAD workstations.",
      },
    ],
  }),
  component: EquipmentPage,
});

function EquipmentPage() {
  const { equipment, equipmentCategories } = useMakerSpace();
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = ["All", ...equipmentCategories];
  const items = equipment.filter(
    (item) => item.visible && (filter === "All" || item.category === filter),
  );
  const selected = equipment.find((item) => item.id === selectedId);

  return (
    <AppShell title="Equipment" subtitle={`${items.length} machines`}>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {categories.map((category) => (
          <li key={category} className="shrink-0">
            <button
              type="button"
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
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

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const usable = item.status === "Available" || item.status === "Partially Available";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="card-surface group overflow-hidden text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  width={800}
                  height={600}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute left-3 top-3">
                  <StatusBadge label={item.status} className="bg-card/90 backdrop-blur" />
                </span>
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                  <span className="min-w-0">
                    <span className="block truncate font-serif text-lg font-light text-white">
                      {item.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-white/70">
                      <MapPin className="size-3" /> {item.lab}
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
                    style={{
                      width: `${Math.round((item.availableQuantity / Math.max(1, item.totalQuantity)) * 100)}%`,
                    }}
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
        })}
      </div>

      <ResponsiveModal
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        title={selected?.name ?? "Equipment"}
        description={selected?.category ?? ""}
      >
        {selected && <EquipmentDetail item={selected} />}
      </ResponsiveModal>
    </AppShell>
  );
}

function EquipmentDetail({ item }: { item: Equipment }) {
  const { profile, uploads, addUpload, removeUpload } = useMakerSpace();
  const fileInput = useRef<HTMLInputElement>(null);
  const myUploads = uploads.filter(
    (upload) =>
      upload.equipmentId === item.id &&
      upload.ownerEmail.toLowerCase() === profile.email.toLowerCase(),
  );

  return (
    <div className="min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
        <img src={item.image} alt={item.name} className="size-full object-cover" />
        <span className="absolute left-3 top-3">
          <StatusBadge label={item.status} className="bg-card/90 backdrop-blur" />
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>

      {item.availabilityReason && (
        <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-5 text-warning-foreground">
          {item.availabilityReason}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <DetailFact label="Location" value={item.lab} />
        <DetailFact
          label="Units free"
          value={`${item.availableQuantity} of ${item.totalQuantity}`}
        />
        <DetailFact label="Category" value={item.category} />
        <DetailFact label="Last updated" value={item.updatedAt} />
      </dl>

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

      {item.instructions && item.instructions.length > 0 && (
        <>
          <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-primary">
            Before you use it
          </p>
          <ol className="mt-2 space-y-2">
            {item.instructions.map((instruction, index) => (
              <li key={instruction} className="flex items-start gap-3 text-sm leading-6">
                <span className="mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-muted-foreground">{instruction}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {item.uploadSupport && (
        <div className="mt-5 rounded-xl border border-border bg-secondary/50 p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
            {item.uploadSupport.label}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Queue your file now — it will be ready on the machine when your session starts.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept={item.uploadSupport.accept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              addUpload({
                equipmentId: item.id,
                equipmentName: item.name,
                fileName: file.name,
                ownerEmail: profile.email,
              });
              toast.success(`${file.name} queued for your next session`);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="pressable mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <FileUp className="size-4" /> Choose file
          </button>
          <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Accepts {item.uploadSupport.accept.replaceAll(",", " · ")}
          </p>
          {myUploads.length > 0 && (
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {myUploads.map((upload) => (
                <li key={upload.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{upload.fileName}</span>
                    <span className="mt-0.5 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Queued · {upload.uploadedAt}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${upload.fileName}`}
                    onClick={() => {
                      removeUpload(upload.id);
                      toast.success("File removed from queue");
                    }}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-5 rounded-xl bg-secondary/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
        Add this to a project's kit to reserve it with your slot.
      </p>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5">
      <dt className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
