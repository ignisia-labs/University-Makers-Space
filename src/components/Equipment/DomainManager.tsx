import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { adminDomainsApi, readableError, uploadsApi, type AdminDomain } from "@/lib/api";
import { cn } from "@/lib/utils";

type Draft = { id?: string; name: string; tagline: string; imageUrl: string | null };
const emptyDraft: Draft = { name: "", tagline: "", imageUrl: null };

/**
 * Domains — the themed areas a student browses before picking machines.
 *
 * Deleting one never deletes what is filed under it: the machines and materials
 * simply become unassigned and still appear to students, under "Everything
 * else". A grouping is not a container.
 */
export function DomainManager({ labId }: { labId: string | null }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminDomain | null>(null);

  const domains = useQuery({
    queryKey: ["admin-domains", labId],
    queryFn: () => adminDomainsApi.list(labId!).then((response) => response.data),
    enabled: Boolean(labId),
    staleTime: 60_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-domains"] });
    await queryClient.invalidateQueries({ queryKey: ["project-resources"] });
  };

  const save = useMutation({
    mutationFn: (draft: Draft) =>
      draft.id
        ? adminDomainsApi.update(draft.id, {
            name: draft.name.trim(),
            tagline: draft.tagline.trim() || null,
            imageUrl: draft.imageUrl,
          })
        : adminDomainsApi.create({
            labId: labId!,
            name: draft.name.trim(),
            tagline: draft.tagline.trim() || null,
            imageUrl: draft.imageUrl,
          }),
    onSuccess: async (_result, draft) => {
      await refresh();
      setEditing(null);
      toast.success(draft.id ? "Domain updated" : "Domain created");
    },
    onError: (error) => toast.error(readableError(error, "That domain could not be saved")),
  });

  const toggle = useMutation({
    mutationFn: (domain: AdminDomain) =>
      adminDomainsApi.update(domain.id, { isActive: !domain.isActive }),
    onSuccess: async () => {
      await refresh();
      toast.success("Domain updated");
    },
    onError: (error) => toast.error(readableError(error, "That domain could not be updated")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminDomainsApi.delete(id),
    onSuccess: async () => {
      await refresh();
      setConfirmDelete(null);
      toast.success("Domain removed — its equipment and materials are now unassigned");
    },
    onError: (error) => toast.error(readableError(error, "That domain could not be removed")),
  });

  if (!labId || domains.isPending) {
    return <div className="card-surface h-40 animate-pulse bg-muted/40" aria-busy="true" />;
  }
  const rows = domains.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Domains ({rows.length})
        </p>
        <button
          type="button"
          onClick={() => setEditing({ ...emptyDraft })}
          className="pressable inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Add domain
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card-surface px-6 py-12 text-center text-sm text-muted-foreground">
          No domains yet. Students see machines grouped under "Everything else" until you add some.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((domain) => (
            <section key={domain.id} className="card-surface overflow-hidden">
              <div className="relative aspect-[4/3] bg-secondary">
                {domain.imageUrl ? (
                  <img
                    src={domain.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 bg-gradient-to-br from-primary/70 to-primary/30" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="block font-serif text-base font-medium text-white">
                    {domain.name}
                  </span>
                  {domain.tagline && (
                    <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-widest text-white/70">
                      {domain.tagline}
                    </span>
                  )}
                </span>
                {!domain.isActive && (
                  <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                    Hidden
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {domain._count?.equipment ?? 0} machines · {domain._count?.consumables ?? 0}{" "}
                  materials
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: domain.id,
                        name: domain.name,
                        tagline: domain.tagline ?? "",
                        imageUrl: domain.imageUrl,
                      })
                    }
                    className="pressable inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-secondary"
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(domain)}
                    className="pressable min-h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    {domain.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(domain)}
                    aria-label={`Remove ${domain.name}`}
                    className="pressable grid min-h-9 w-9 place-items-center rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? "Edit domain" : "Add domain"}
        description="Name, tagline and the photo students see on the tile."
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(editing);
            }}
          >
            <DomainImageField
              imageUrl={editing.imageUrl}
              onUploaded={(url) => setEditing({ ...editing, imageUrl: url })}
            />
            <label className="block">
              <span className="text-sm font-medium">Name</span>
              <input
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                required
                minLength={2}
                maxLength={120}
                className="form-input mt-1.5"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Tagline</span>
              <input
                value={editing.tagline}
                onChange={(event) => setEditing({ ...editing, tagline: event.target.value })}
                placeholder="Print, cut & shape"
                maxLength={120}
                className="form-input mt-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={save.isPending}
              className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {editing.id ? "Save changes" : "Add domain"}
            </button>
          </form>
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name ?? "domain"}?`}
        description="Its machines and materials are kept — they simply stop being grouped under this domain."
      >
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
          className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          {remove.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Remove domain
        </button>
      </ResponsiveModal>
    </div>
  );
}

function DomainImageField({
  imageUrl,
  onUploaded,
}: {
  imageUrl: string | null;
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
        disabled={uploading}
        onClick={() => input.current?.click()}
        className={cn(
          "relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-secondary disabled:opacity-60",
        )}
      >
        {uploading ? (
          <span className="grid size-full place-items-center">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          </span>
        ) : imageUrl ? (
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center gap-1 text-muted-foreground">
            <ImagePlus className="size-6" aria-hidden />
            <span className="text-[10px] font-mono uppercase tracking-widest">Add photo</span>
          </span>
        )}
      </button>
    </>
  );
}
