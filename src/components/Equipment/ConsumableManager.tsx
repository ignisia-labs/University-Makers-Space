import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { adminApi, adminDomainsApi, readableError, type ReferenceConsumable } from "@/lib/api";
import { cn } from "@/lib/utils";

type Draft = {
  id?: string;
  name: string;
  unit: string;
  description: string;
  categoryId: string;
  domainId: string;
  variants: string;
  maxPerProject: string;
  stockQuantity: string;
  lowStockThreshold: string;
};

const emptyDraft: Draft = {
  name: "",
  unit: "",
  description: "",
  categoryId: "",
  domainId: "",
  variants: "",
  maxPerProject: "",
  stockQuantity: "0",
  lowStockThreshold: "",
};

/**
 * Materials, their forms, and what is left on the shelf.
 *
 * Stock here is a real count, not an estimate: issuing a claim spends it and
 * nothing returns it. Raising the number is a restock, and is the only way it
 * goes up — which is why it is edited deliberately rather than nudged.
 */
export function ConsumableManager({ labId }: { labId: string | null }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");

  const consumables = useQuery({
    queryKey: ["admin-consumables", labId],
    queryFn: () => adminApi.consumables(labId!).then((response) => response.data),
    enabled: Boolean(labId),
    staleTime: 30_000,
  });
  const categories = useQuery({
    queryKey: ["admin-consumable-categories", labId],
    queryFn: () => adminApi.consumableCategories(labId!).then((response) => response.data),
    enabled: Boolean(labId),
    staleTime: 60_000,
  });
  const domains = useQuery({
    queryKey: ["admin-domains", labId],
    queryFn: () => adminDomainsApi.list(labId!).then((response) => response.data),
    enabled: Boolean(labId),
    staleTime: 60_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-consumables"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-consumable-categories"] });
    await queryClient.invalidateQueries({ queryKey: ["project-resources"] });
  };

  const save = useMutation({
    mutationFn: (draft: Draft) => {
      const variants = draft.variants
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const shared = {
        domainId: draft.domainId || null,
        unit: draft.unit.trim(),
        description: draft.description.trim() || null,
        variants,
        maxPerProject: draft.maxPerProject ? Number(draft.maxPerProject) : null,
        stockQuantity: Math.max(0, Number(draft.stockQuantity) || 0),
        lowStockThreshold: draft.lowStockThreshold ? Number(draft.lowStockThreshold) : null,
      };
      return draft.id
        ? adminApi.updateConsumable(draft.id, {
            name: draft.name.trim(),
            categoryId: draft.categoryId,
            ...shared,
          })
        : adminApi.createConsumable({
            labId: labId!,
            categoryId: draft.categoryId,
            name: draft.name.trim(),
            ...shared,
          });
    },
    onSuccess: async (_result, draft) => {
      await refresh();
      setEditing(null);
      toast.success(draft.id ? "Material updated" : "Material added");
    },
    onError: (error) => toast.error(readableError(error, "That change could not be saved")),
  });

  const toggle = useMutation({
    mutationFn: (item: ReferenceConsumable) =>
      adminApi.updateConsumable(item.id, { isActive: !item.isActive }),
    onSuccess: async () => {
      await refresh();
      toast.success("Material updated");
    },
    onError: (error) => toast.error(readableError(error, "That change could not be saved")),
  });

  const addCategory = useMutation({
    mutationFn: () =>
      adminApi.createConsumableCategory({ labId: labId!, name: categoryDraft.trim() }),
    onSuccess: async () => {
      await refresh();
      setCategoryDraft("");
      toast.success("Category created");
    },
    onError: (error) => toast.error(readableError(error, "That category could not be created")),
  });

  if (!labId || consumables.isPending || categories.isPending) {
    return <div className="card-surface h-40 animate-pulse bg-muted/40" aria-busy="true" />;
  }
  const items = consumables.data ?? [];
  const activeCategories = (categories.data ?? []).filter((category) => category.isActive);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Materials ({items.length})
        </p>
        <button
          type="button"
          disabled={activeCategories.length === 0}
          onClick={() => setEditing({ ...emptyDraft, categoryId: activeCategories[0]?.id ?? "" })}
          className="pressable inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-45"
        >
          <Plus className="size-4" /> Add material
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card-surface px-6 py-12 text-center text-sm text-muted-foreground">
          No materials yet.
        </div>
      ) : (
        <ul className="card-surface divide-y divide-border overflow-hidden">
          {items.map((item) => {
            const low =
              item.lowStockThreshold !== null && item.stockQuantity <= item.lowStockThreshold;
            const out = item.stockQuantity === 0;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.name}
                    {!item.isActive && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        inactive
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.category.name} · per {item.unit}
                    {item.maxPerProject !== null && ` · max ${item.maxPerProject}/project`}
                    {item.variants.length > 0 && ` · ${item.variants.length} forms`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                      out
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : low
                          ? "border-warning/40 bg-warning/10 text-warning-foreground"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {out ? "out of stock" : `${item.stockQuantity} ${item.unit}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        name: item.name,
                        unit: item.unit,
                        description: item.description ?? "",
                        categoryId: item.categoryId,
                        domainId: item.domainId ?? "",
                        variants: item.variants.join("\n"),
                        maxPerProject:
                          item.maxPerProject === null ? "" : String(item.maxPerProject),
                        stockQuantity: String(item.stockQuantity),
                        lowStockThreshold:
                          item.lowStockThreshold === null ? "" : String(item.lowStockThreshold),
                      })
                    }
                    aria-label={`Edit ${item.name}`}
                    className="pressable grid size-9 place-items-center rounded-lg border border-border hover:bg-secondary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(item)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
                  >
                    {item.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="card-surface p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Material categories
        </p>
        <ul className="mt-3 divide-y divide-border">
          {(categories.data ?? []).map((category) => (
            <li key={category.id} className="py-2 text-sm">
              {category.name}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {category.isActive ? "" : "inactive"}
              </span>
            </li>
          ))}
          {(categories.data ?? []).length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">No categories yet.</li>
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
            aria-label="New material category"
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
            Add
          </button>
        </form>
      </section>

      <ResponsiveModal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? "Edit material" : "Add material"}
        description="Forms, per-project ceiling, and how much is on the shelf."
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(editing);
            }}
          >
            <FormField label="Name">
              <input
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                required
                minLength={2}
                maxLength={120}
                className="form-input"
              />
            </FormField>
            <FormField label="Unit" hint="What one of it is called — spool, sheet, gram.">
              <input
                value={editing.unit}
                onChange={(event) => setEditing({ ...editing, unit: event.target.value })}
                required
                maxLength={24}
                className="form-input"
              />
            </FormField>
            <FormField label="Category">
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
            </FormField>
            <FormField label="Domain" hint="Where students find it. Optional.">
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
            </FormField>
            <FormField label="Forms" hint="One per line, e.g. 1.75 mm White. Optional.">
              <textarea
                value={editing.variants}
                onChange={(event) => setEditing({ ...editing, variants: event.target.value })}
                className="form-input min-h-20 resize-none py-2"
              />
            </FormField>
            <FormField
              label="In stock"
              hint="Raising this is a restock. Issued material never returns on its own."
            >
              <input
                type="number"
                min={0}
                value={editing.stockQuantity}
                onChange={(event) => setEditing({ ...editing, stockQuantity: event.target.value })}
                required
                className="form-input"
              />
            </FormField>
            <FormField label="Max per project" hint="Leave blank for no ceiling.">
              <input
                type="number"
                min={1}
                value={editing.maxPerProject}
                onChange={(event) => setEditing({ ...editing, maxPerProject: event.target.value })}
                className="form-input"
              />
            </FormField>
            <FormField label="Low-stock warning at" hint="Optional.">
              <input
                type="number"
                min={0}
                value={editing.lowStockThreshold}
                onChange={(event) =>
                  setEditing({ ...editing, lowStockThreshold: event.target.value })
                }
                className="form-input"
              />
            </FormField>
            <button
              type="submit"
              disabled={save.isPending}
              className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {editing.id ? "Save changes" : "Add material"}
            </button>
          </form>
        )}
      </ResponsiveModal>
    </div>
  );
}

function FormField({
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
