import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import {
  adminApi,
  adminDomainsApi,
  equipmentApi,
  readableError,
  uploadsApi,
  type EquipmentDto,
  type EquipmentStatusValue,
  type ReferenceCategory,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const statuses: EquipmentStatusValue[] = [
  "AVAILABLE",
  "PARTIALLY_AVAILABLE",
  "IN_USE",
  "UNAVAILABLE",
  "UNDER_MAINTENANCE",
  "DAMAGED",
  "OUT_OF_SERVICE",
];

type Draft = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  totalQuantity: string;
  specs: string;
  domainId: string;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  categoryId: "",
  totalQuantity: "1",
  specs: "",
  domainId: "",
};

/**
 * The machine catalogue, editable.
 *
 * One component serves both the Lab Assistant console and Administration.
 * They hold the same `equipment.manage` authority and need the same picture of
 * the floor, so giving them two screens would only guarantee the two drift.
 */
export function EquipmentManager({ labId }: { labId: string | null }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EquipmentDto | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");

  const equipment = useQuery({
    queryKey: ["equipment", "manage", labId, page],
    queryFn: () => equipmentApi.list({ labId: labId!, page: String(page), limit: "24" }),
    enabled: Boolean(labId),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
  const domains = useQuery({
    queryKey: ["admin-domains", labId],
    queryFn: () => adminDomainsApi.list(labId!).then((r) => r.data),
    enabled: Boolean(labId),
    staleTime: 60_000,
  });
  const categories = useQuery({
    queryKey: ["equipment-categories", "manage", labId],
    queryFn: () => adminApi.equipmentCategories(labId!).then((r) => r.data),
    enabled: Boolean(labId),
    staleTime: 60_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["equipment"] });
    await queryClient.invalidateQueries({ queryKey: ["equipment-categories"] });
  };

  const save = useMutation({
    mutationFn: (draft: Draft) => {
      const total = Math.max(1, Number(draft.totalQuantity) || 1);
      const specs = draft.specs
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return draft.id
        ? equipmentApi.update(draft.id, {
            name: draft.name.trim(),
            description: draft.description.trim(),
            categoryId: draft.categoryId,
            domainId: draft.domainId || null,
            totalQuantity: total,
            specs,
          })
        : equipmentApi.create({
            labId: labId!,
            name: draft.name.trim(),
            description: draft.description.trim(),
            categoryId: draft.categoryId,
            domainId: draft.domainId || null,
            totalQuantity: total,
            availableQuantity: total,
            specs,
          });
    },
    onSuccess: async (_result, draft) => {
      await refresh();
      setEditing(null);
      toast.success(draft.id ? "Equipment updated" : "Equipment added");
    },
    onError: (error) => toast.error(readableError(error, "That change could not be saved")),
  });

  const availability = useMutation({
    mutationFn: (input: {
      id: string;
      status?: EquipmentStatusValue;
      availableQuantity?: number;
      imageUrl?: string;
    }) =>
      equipmentApi.updateAvailability(input.id, {
        ...(input.status ? { status: input.status } : {}),
        ...(input.availableQuantity !== undefined
          ? { availableQuantity: input.availableQuantity }
          : {}),
        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
        reason: "Updated from the MakerSpace console",
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Equipment updated");
    },
    onError: (error) => toast.error(readableError(error, "That change could not be saved")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => equipmentApi.delete(id),
    onSuccess: async () => {
      await refresh();
      setConfirmDelete(null);
      toast.success("Equipment removed");
    },
    onError: (error) => toast.error(readableError(error, "That machine could not be removed")),
  });

  const addCategory = useMutation({
    mutationFn: () =>
      adminApi.createEquipmentCategory({ labId: labId!, name: categoryDraft.trim() }),
    onSuccess: async () => {
      await refresh();
      setCategoryDraft("");
      toast.success("Category created");
    },
    onError: (error) => toast.error(readableError(error, "That category could not be created")),
  });

  const toggleCategory = useMutation({
    mutationFn: (category: ReferenceCategory) =>
      adminApi.updateEquipmentCategory(category.id, { isActive: !category.isActive }),
    onSuccess: async () => {
      await refresh();
      toast.success("Category updated");
    },
    onError: (error) => toast.error(readableError(error, "That category could not be updated")),
  });

  if (!labId || equipment.isPending || categories.isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card-surface h-56 animate-pulse bg-muted/40" aria-busy />
        ))}
      </div>
    );
  }

  const items = equipment.data?.data ?? [];
  const totalEquipment = equipment.data?.meta?.total ?? items.length;
  const allCategories = categories.data ?? [];
  const activeCategories = allCategories.filter((category) => category.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          {totalEquipment} {totalEquipment === 1 ? "machine" : "machines"}
        </p>
        <button
          type="button"
          disabled={activeCategories.length === 0}
          onClick={() => setEditing({ ...emptyDraft, categoryId: activeCategories[0]?.id ?? "" })}
          className="pressable inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-45"
        >
          <Plus className="size-4" /> Add equipment
        </button>
      </div>

      {activeCategories.length === 0 && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-5 text-warning-foreground">
          Add a category first — every machine belongs to one.
        </p>
      )}

      {items.length === 0 ? (
        <div className="card-surface px-6 py-14 text-center text-sm text-muted-foreground">
          No machines are listed yet.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((item) => (
            <ManagedEquipmentCard
              key={item.id}
              item={item}
              busy={availability.isPending || remove.isPending}
              onStatus={(status) => availability.mutate({ id: item.id, status })}
              onUnits={(availableQuantity) =>
                availability.mutate({ id: item.id, availableQuantity })
              }
              onPhoto={(imageUrl) => availability.mutate({ id: item.id, imageUrl })}
              onEdit={() =>
                setEditing({
                  id: item.id,
                  name: item.name,
                  description: item.description ?? "",
                  categoryId: item.categoryId,
                  totalQuantity: String(item.totalQuantity),
                  specs: item.specs.join("\n"),
                  domainId: item.domainId ?? "",
                })
              }
              onDelete={() => setConfirmDelete(item)}
            />
          ))}
        </div>
      )}

      <Pagination
        meta={equipment.data?.meta}
        onPage={setPage}
        busy={equipment.isFetching}
        noun="machines"
      />

      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Categories</p>
        <ul className="mt-4 divide-y divide-border">
          {allCategories.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-3 py-2.5">
              <p className="min-w-0 truncate text-sm">
                {category.name}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {category._count?.equipment ?? 0} items
                  {category.isActive ? "" : " · inactive"}
                </span>
              </p>
              <button
                type="button"
                disabled={toggleCategory.isPending}
                onClick={() => toggleCategory.mutate(category)}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted disabled:opacity-40"
              >
                {category.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
          {allCategories.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No categories yet.</li>
          )}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addCategory.mutate();
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={categoryDraft}
            onChange={(event) => setCategoryDraft(event.target.value)}
            placeholder="New category"
            aria-label="New equipment category"
            required
            minLength={2}
            maxLength={120}
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={addCategory.isPending || !categoryDraft.trim()}
            className="pressable inline-flex min-h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-45"
          >
            {addCategory.isPending && <Loader2 className="size-3 animate-spin" aria-hidden />}
            Add
          </button>
        </form>
      </section>

      <ResponsiveModal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? "Edit equipment" : "Add equipment"}
        description="Name, category, description, unit count and specifications."
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(editing);
            }}
          >
            <Field label="Name">
              <input
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                required
                minLength={2}
                maxLength={160}
                className="form-input"
              />
            </Field>
            <Field label="Category">
              <select
                value={editing.categoryId}
                onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}
                required
                className="form-input"
              >
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Domain" hint="The themed area students browse. Optional.">
              <select
                value={editing.domainId}
                onChange={(event) => setEditing({ ...editing, domainId: event.target.value })}
                className="form-input"
              >
                <option value="">Unassigned</option>
                {(domains.data ?? [])
                  .filter((domain) => domain.isActive)
                  .map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                required
                minLength={2}
                maxLength={500}
                className="form-input min-h-20 resize-none py-2"
              />
            </Field>
            <Field label="Total units">
              <input
                type="number"
                min={1}
                max={999}
                value={editing.totalQuantity}
                onChange={(event) => setEditing({ ...editing, totalQuantity: event.target.value })}
                required
                className="form-input"
              />
            </Field>
            <Field label="Specifications" hint="One per line.">
              <textarea
                value={editing.specs}
                onChange={(event) => setEditing({ ...editing, specs: event.target.value })}
                placeholder={"350 x 350 x 400 mm\nPLA / PETG / TPU"}
                className="form-input min-h-20 resize-none py-2"
              />
            </Field>
            <button
              type="submit"
              disabled={save.isPending}
              className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {editing.id ? "Save changes" : "Add equipment"}
            </button>
          </form>
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name ?? "equipment"}?`}
        description="It disappears from the catalogue and from project kit lists. Past bookings keep their record."
      >
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
          className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          {remove.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Remove permanently
        </button>
      </ResponsiveModal>
    </div>
  );
}

function ManagedEquipmentCard({
  item,
  busy,
  onStatus,
  onUnits,
  onPhoto,
  onEdit,
  onDelete,
}: {
  item: EquipmentDto;
  busy: boolean;
  onStatus: (status: EquipmentStatusValue) => void;
  onUnits: (availableQuantity: number) => void;
  onPhoto: (imageUrl: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const usable = item.status === "AVAILABLE" || item.status === "PARTIALLY_AVAILABLE";
  return (
    <section className="card-surface overflow-hidden">
      <EquipmentPhotoField item={item} disabled={busy} onUploaded={onPhoto} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-serif text-lg font-light tracking-wide">{item.name}</h3>
            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {item.category ?? "Uncategorised"}
            </p>
          </div>
          <StatusBadge label={statusLabel(item.status)} className="shrink-0" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {item.availableQuantity} of {item.totalQuantity} free
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy || item.availableQuantity === 0}
              onClick={() => onUnits(item.availableQuantity - 1)}
              aria-label={`Mark one ${item.name} unit as busy`}
              className="pressable size-9 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-secondary disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              disabled={busy || item.availableQuantity >= item.totalQuantity}
              onClick={() => onUnits(item.availableQuantity + 1)}
              aria-label={`Return one ${item.name} unit to service`}
              className="pressable size-9 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-secondary disabled:opacity-40"
            >
              +
            </button>
          </div>
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

        <select
          value={item.status}
          disabled={busy}
          aria-label={`Status for ${item.name}`}
          onChange={(event) => onStatus(event.target.value as EquipmentStatusValue)}
          className="mt-4 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-xs disabled:opacity-40"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-secondary"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-destructive/40 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * The machine's photo, replaceable in place.
 *
 * The file goes to the image host first and only the returned URL is saved, so
 * a failed upload never leaves the catalogue pointing at nothing.
 */
function EquipmentPhotoField({
  item,
  disabled,
  onUploaded,
}: {
  item: EquipmentDto;
  disabled: boolean;
  onUploaded: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Images must be 5MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const response = await uploadsApi.upload(file);
      onUploaded(response.data.url);
    } catch (error) {
      toast.error(readableError(error, "The photo could not be uploaded"));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => input.current?.click()}
        aria-label={`${item.imageUrl ? "Replace" : "Add"} photo for ${item.name}`}
        className="group relative block aspect-[4/3] w-full overflow-hidden bg-secondary/60 disabled:opacity-60"
      >
        {uploading ? (
          <span className="grid size-full place-items-center">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          </span>
        ) : item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={800}
            height={600}
            className="size-full object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center gap-1 text-muted-foreground">
            <ImagePlus className="size-6" aria-hidden />
            <span className="text-[10px] font-mono uppercase tracking-widest">Add photo</span>
          </span>
        )}
        <span className="absolute inset-0 hidden place-items-center bg-black/45 text-[10px] font-mono uppercase tracking-widest text-white group-hover:grid">
          {item.imageUrl ? "Replace photo" : "Add photo"}
        </span>
      </button>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
