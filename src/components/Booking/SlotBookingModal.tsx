import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import type { SlotEquipment } from "@/lib/api";

type SlotBookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  date: string;
  slot: string;
  attendees: number;
  /** The project's machines as they stand in the chosen slot. */
  equipment: SlotEquipment[];
  submitting?: boolean;
  onConfirm: (equipmentIds: string[]) => void;
};

export function SlotBookingModal({
  open,
  onOpenChange,
  projectName,
  date,
  slot,
  attendees,
  equipment,
  submitting = false,
  onConfirm,
}: SlotBookingModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  // Reopening for a different slot re-derives the default, because a machine
  // that was free at 10:00 may be taken at 14:00.
  useEffect(() => {
    if (!open) return;
    setSelected(equipment.filter((item) => item.available).map((item) => item.equipmentId));
  }, [open, equipment]);

  const toggle = (equipmentId: string) =>
    setSelected((current) =>
      current.includes(equipmentId)
        ? current.filter((entry) => entry !== equipmentId)
        : [...current, equipmentId],
    );

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm your reservation"
      description="Review the details and choose the machines your team will hold for this slot."
    >
      <dl className="space-y-3 text-sm">
        <Row label="Project" value={projectName} />
        <Row label="Date" value={date} />
        <Row label="Slot" value={slot} />
        <Row label="Attendees" value={`${attendees} student(s)`} />
      </dl>

      <section className="mt-6" aria-labelledby="booking-resources-title">
        <div>
          <h3 id="booking-resources-title" className="text-sm font-semibold">
            Machines for this slot
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Anything you keep is reserved for your team for this slot alone, and is released the
            moment you cancel or end the session.
          </p>
        </div>
        {equipment.length ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border px-3">
            {equipment.map((item) => (
              <li key={item.equipmentId}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2 text-sm font-medium has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted-foreground">
                  <Checkbox
                    checked={selected.includes(item.equipmentId)}
                    onCheckedChange={() => toggle(item.equipmentId)}
                    disabled={!item.available}
                    className="size-5"
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{item.name}</span>
                      {item.available && item.totalQuantity > 1 && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {item.remainingQuantity} of {item.totalQuantity} free at this time
                        </span>
                      )}
                    </span>
                    {!item.available && (
                      <StatusBadge
                        label={item.claimedQuantity > 0 ? "Taken this slot" : "Out of service"}
                      />
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            This project lists no machines. You can still reserve the slot.
          </p>
        )}
      </section>

      <button
        type="button"
        disabled={submitting}
        onClick={() => onConfirm(selected)}
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-5" />
        )}
        Confirm reservation
      </button>
    </ResponsiveModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
