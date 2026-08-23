import { Check, Info, Users, Wrench } from "lucide-react";
import { BookingCapacityBench } from "@/components/Booking/BookingCapacityBench";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import type { BookingParticipantDto, DailyAvailability } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdvisoryItem = DailyAvailability["equipmentAdvisory"][number];

export function BookingConfirmation({
  open,
  onOpenChange,
  projectTitle,
  date,
  time,
  participants,
  equipment,
  capacity,
  placesUsed,
  notes,
  onNotesChange,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  date: string;
  time: string;
  participants: BookingParticipantDto[];
  equipment: AdvisoryItem[];
  capacity: number;
  placesUsed: number;
  notes: string;
  onNotesChange: (value: string) => void;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}
      title="Confirm your MakerSpace slot"
      description="Review the team and timing. Capacity is verified again when you confirm."
      size="wide"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <div className="space-y-5">
          <dl className="divide-y divide-border rounded-2xl border border-border px-4">
            <ReviewRow label="Project" value={projectTitle} />
            <ReviewRow label="Date" value={date} />
            <ReviewRow label="Time" value={time} />
          </dl>

          <section aria-labelledby="confirmation-team-title">
            <div className="flex items-center justify-between gap-3">
              <h3
                id="confirmation-team-title"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <Users className="size-4 text-primary" aria-hidden /> Team attending
              </h3>
              <span className="text-xs text-muted-foreground">{participants.length} selected</span>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {participants.map((participant) => (
                <li
                  key={participant.userId}
                  className="rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <p className="truncate text-sm font-medium">{participant.name}</p>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {participant.role === "LEADER" ? "Team Leader" : "Project member"}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <label className="block text-sm font-medium" htmlFor="booking-notes">
            Visit note <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              id="booking-notes"
              value={notes}
              maxLength={500}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Anything the MakerSpace team should know"
              className="form-input mt-2 min-h-24 resize-none py-3"
            />
          </label>
        </div>

        <aside className="space-y-4">
          <BookingCapacityBench
            capacity={capacity}
            placesUsed={placesUsed}
            selectedCount={participants.length}
          />

          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="size-4 text-primary" aria-hidden /> Equipment advisory
            </h3>
            {equipment.length ? (
              <ul className="mt-3 space-y-2">
                {equipment.map((item) => (
                  <li
                    key={item.equipmentId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-mono uppercase tracking-wider",
                        item.available ? "text-success-foreground" : "text-warning-foreground",
                      )}
                    >
                      {item.available ? "Available" : "Unavailable"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                This project has no expected equipment.
              </p>
            )}
            <div className="mt-3 flex items-start gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              Equipment status is guidance only. This reserves MakerSpace capacity, not a machine.
            </div>
          </section>
        </aside>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending || participants.length === 0}
        onClick={onConfirm}
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Check className="size-5" aria-hidden />
        {pending ? "Confirming with live capacity…" : "Confirm booking"}
      </button>
    </ResponsiveModal>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[70%] text-right font-semibold">{value}</dd>
    </div>
  );
}
