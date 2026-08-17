import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Checkbox } from "@/components/ui/checkbox";

type SlotBookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  date: string;
  slot: string;
  attendees: number;
  projectResources: string[];
  unavailableResources?: string[];
  onConfirm: (resources: string[]) => void;
};

export function SlotBookingModal({
  open,
  onOpenChange,
  projectName,
  date,
  slot,
  attendees,
  projectResources,
  unavailableResources = [],
  onConfirm,
}: SlotBookingModalProps) {
  const [resources, setResources] = useState(projectResources);

  useEffect(() => {
    if (open)
      setResources(projectResources.filter((resource) => !unavailableResources.includes(resource)));
  }, [open, projectResources, unavailableResources]);

  const toggle = (resource: string) =>
    setResources((current) =>
      current.includes(resource)
        ? current.filter((item) => item !== resource)
        : [...current, resource],
    );

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm your reservation"
      description="Review the details and choose the project resources you will use in this slot."
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
            Resources for this slot
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Your project lists these resources. Toggle only what your team expects to use during
            this visit.
          </p>
        </div>
        {projectResources.length ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border px-3">
            {projectResources.map((resource) => (
              <li key={resource}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2 text-sm font-medium has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted-foreground">
                  <Checkbox
                    checked={resources.includes(resource)}
                    onCheckedChange={() => toggle(resource)}
                    disabled={unavailableResources.includes(resource)}
                    className="size-5"
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span>{resource}</span>
                    {unavailableResources.includes(resource) && (
                      <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
                        Unavailable
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            No project resources have been added yet. You can still reserve the slot.
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={() => onConfirm(resources)}
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Check className="size-5" /> Confirm Reservation
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
