import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { Equipment } from "@/lib/makerspace-data";
export const Route = createFileRoute("/admin")({ component: Admin });
function Admin() {
  const { config, saveConfig, equipment, updateEquipment, addEquipment, removeEquipment } =
    useMakerSpace();
  const [draft, setDraft] = useState(config);
  const [open, setOpen] = useState(false);
  const blank: Omit<Equipment, "id"> = {
    name: "",
    category: "Electronics",
    status: "Available",
    image: "",
    specs: [],
    description: "",
    totalQuantity: 1,
    availableQuantity: 1,
    visible: true,
  };
  const [item, setItem] = useState(blank);
  return (
    <AppShell title="Administration" subtitle="Lab configuration and catalogue">
      <section className="card-surface p-5">
        <h2 className="font-semibold">Lab operational settings</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["openingTime", "Opening"],
              ["closingTime", "Closing"],
              ["slotDuration", "Slot duration"],
              ["capacity", "Capacity"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs font-medium text-muted-foreground">
              {label}
              <input
                value={draft[key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [key]:
                      key === "slotDuration" || key === "capacity"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
                className="mt-1 h-11 w-full rounded-xl border bg-card px-3 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
        <button
          onClick={() => saveConfig(draft)}
          className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Save configuration
        </button>
      </section>
      <section className="mt-6">
        <div className="flex justify-between">
          <h2 className="font-semibold">Equipment catalogue</h2>
          <button
            onClick={() => setOpen(true)}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Add equipment
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {equipment.map((e) => (
            <article
              key={e.id}
              className="card-surface flex items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {e.category} · {e.availableQuantity}/{e.totalQuantity}
                </p>
                <StatusBadge label={e.status} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateEquipment(e.id, { visible: !e.visible })}
                  className="min-h-10 rounded-lg border px-3 text-xs"
                >
                  {e.visible ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => removeEquipment(e.id)}
                  className="min-h-10 rounded-lg border border-destructive/40 px-3 text-xs text-destructive"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ResponsiveModal open={open} onOpenChange={setOpen} title="Add equipment">
        <div className="space-y-3">
          <input
            value={item.name}
            onChange={(e) => setItem({ ...item, name: e.target.value })}
            placeholder="Equipment name"
            className="h-12 w-full rounded-xl border px-3"
          />
          <input
            value={item.category}
            onChange={(e) =>
              setItem({ ...item, category: e.target.value as Equipment["category"] })
            }
            placeholder="Category"
            className="h-12 w-full rounded-xl border px-3"
          />
          <input
            type="number"
            value={item.totalQuantity}
            onChange={(e) =>
              setItem({
                ...item,
                totalQuantity: Number(e.target.value),
                availableQuantity: Number(e.target.value),
              })
            }
            className="h-12 w-full rounded-xl border px-3"
          />
          <button
            onClick={() => {
              addEquipment(item);
              setOpen(false);
            }}
            className="min-h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Add to catalogue
          </button>
        </div>
      </ResponsiveModal>
    </AppShell>
  );
}
