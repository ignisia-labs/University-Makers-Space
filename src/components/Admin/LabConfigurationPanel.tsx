import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ApiError,
  labsApi,
  referenceApi,
  type DateExceptionInput,
  type LabConfiguration,
  type UpdateLabConfigurationInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const configurationKey = (labId: string) => ["lab-configuration", labId] as const;

export function LabConfigurationPanel() {
  const queryClient = useQueryClient();
  const labs = useQuery({
    queryKey: ["reference-labs"],
    queryFn: () => referenceApi.labs().then((response) => response.data),
  });
  const labId = labs.data?.[0]?.id ?? "";
  const configuration = useQuery({
    queryKey: configurationKey(labId),
    queryFn: () => labsApi.configuration(labId).then((response) => response.data),
    enabled: Boolean(labId),
  });
  const [form, setForm] = useState<UpdateLabConfigurationInput | null>(null);

  useEffect(() => {
    if (configuration.data) setForm(configurationInput(configuration.data));
  }, [configuration.data]);

  const save = useMutation({
    mutationFn: (input: UpdateLabConfigurationInput) => labsApi.updateConfiguration(labId, input),
    onSuccess: async ({ data }) => {
      queryClient.setQueryData(configurationKey(labId), data);
      setForm(configurationInput(data));
      toast.success("MakerSpace policy saved and future slots regenerated");
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.code === "CONFIGURATION_CHANGED") {
        await configuration.refetch();
        toast.error("Another Admin changed this policy. The latest version has been loaded.");
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Configuration could not be saved");
    },
  });
  const regenerate = useMutation({
    mutationFn: () => labsApi.regenerateSlots(labId),
    onSuccess: ({ data }) =>
      toast.success(`Slot plan refreshed: ${data.created} created, ${data.updated} synchronized`),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Slots could not be regenerated"),
  });

  if (labs.isLoading || configuration.isLoading || !form) {
    return <ConfigurationLoading />;
  }
  if (labs.isError || configuration.isError || !configuration.data) {
    return (
      <div className="card-surface px-6 py-14 text-center">
        <p className="text-sm text-destructive">MakerSpace configuration could not be loaded.</p>
        <button
          type="button"
          onClick={() => void Promise.all([labs.refetch(), configuration.refetch()])}
          className="mt-4 text-sm font-semibold text-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PolicySummary configuration={configuration.data} />

      <section className="card-surface overflow-hidden">
        <div className="border-b border-border px-5 py-5 sm:px-7">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
            Operating policy
          </p>
          <h2 className="mt-2 font-serif text-2xl font-light">The rules behind every slot</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Changes regenerate future availability. Existing booking history is preserved.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
          <Field label="MakerSpace name" className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="Time zone">
            <Input
              value={form.timeZone}
              onChange={(event) => setForm({ ...form, timeZone: event.target.value })}
            />
          </Field>
          <NumberField
            label="Slot duration"
            suffix="minutes"
            value={form.slotDurationMinutes}
            min={5}
            max={240}
            onChange={(value) => setForm({ ...form, slotDurationMinutes: value })}
          />
          <NumberField
            label="Student capacity"
            suffix="people"
            value={form.bookingCapacity}
            min={1}
            max={500}
            onChange={(value) => setForm({ ...form, bookingCapacity: value })}
          />
          <NumberField
            label="Booking horizon"
            suffix="days"
            value={form.bookingHorizonDays}
            min={1}
            max={365}
            onChange={(value) => setForm({ ...form, bookingHorizonDays: value })}
          />
          <NumberField
            label="Cancellation window"
            suffix="hours"
            value={form.cancellationWindowHours}
            min={0}
            max={168}
            onChange={(value) => setForm({ ...form, cancellationWindowHours: value })}
          />
          <Field label="Maximum future bookings" hint="Leave blank for no project-level limit.">
            <Input
              type="number"
              min={1}
              max={100}
              value={form.maxFutureBookingsPerProject ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  maxFutureBookingsPerProject: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </Field>
          <ToggleField
            label="Require Faculty verification"
            hint="Only eligible verified projects can proceed to booking."
            checked={form.projectVerificationRequired}
            onCheckedChange={(checked) =>
              setForm({ ...form, projectVerificationRequired: checked })
            }
          />
          <ToggleField
            label="Require Team Leader attendance"
            hint="Keeps the Team Leader selected when a project booking is created."
            checked={form.teamLeaderAttendanceRequired}
            onCheckedChange={(checked) =>
              setForm({ ...form, teamLeaderAttendanceRequired: checked })
            }
          />
          <ToggleField
            label="Quick Visits enabled"
            hint="The detailed visit workflow is connected in Phase 5."
            checked={form.quickVisitsEnabled}
            onCheckedChange={(checked) => setForm({ ...form, quickVisitsEnabled: checked })}
          />
          <NumberField
            label="Quick Visit capacity"
            suffix="people"
            value={form.quickVisitCapacity}
            min={1}
            max={500}
            disabled={!form.quickVisitsEnabled}
            onChange={(value) => setForm({ ...form, quickVisitCapacity: value })}
          />
        </div>
      </section>

      <WeeklyScheduleEditor
        rows={form.weeklySchedule}
        onChange={(weeklySchedule) => setForm({ ...form, weeklySchedule })}
      />

      <DateExceptions
        labId={labId}
        configuration={configuration.data}
        onChanged={async () => {
          await queryClient.invalidateQueries({ queryKey: configurationKey(labId) });
        }}
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", regenerate.isPending && "animate-spin")} />
          Regenerate slots
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={save.isPending}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save operating policy
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Publish this operating policy?</AlertDialogTitle>
              <AlertDialogDescription>
                Future dates and slots will be regenerated immediately. Historical bookings will not
                be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction onClick={() => save.mutate(form)}>Save changes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function PolicySummary({ configuration }: { configuration: LabConfiguration }) {
  const openDays = configuration.weeklySchedule.filter((row) => row.isOpen);
  const first = openDays[0];
  const uniformHours = openDays.every(
    (row) => row.opensAt === first?.opensAt && row.closesAt === first?.closesAt,
  );
  const metrics = [
    {
      icon: CalendarDays,
      label: "Open days",
      value: `${openDays.length} / 7`,
      note: uniformHours && first ? `${first.opensAt}–${first.closesAt}` : "Variable hours",
    },
    {
      icon: Clock3,
      label: "Slot rhythm",
      value: `${configuration.slotDurationMinutes} min`,
      note: `${configuration.bookingHorizonDays}-day window`,
    },
    {
      icon: Users,
      label: "Room capacity",
      value: String(configuration.bookingCapacity),
      note: "Attendee places per slot",
    },
    {
      icon: ShieldCheck,
      label: "Project gate",
      value: configuration.projectVerificationRequired ? "Verified" : "Open",
      note: configuration.projectVerificationRequired
        ? "Mentor approval required"
        : "No approval gate",
    },
  ];
  return (
    <section className="grid overflow-hidden rounded-2xl border border-primary/15 bg-primary text-primary-foreground shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ icon: Icon, label, value, note }, index) => (
        <div
          key={label}
          className={cn(
            "p-5 sm:p-6",
            index > 0 && "border-t border-white/15 sm:border-l",
            index === 2 && "sm:border-l-0 lg:border-l",
          )}
        >
          <div className="flex items-center gap-2 text-white/65">
            <Icon className="size-4" />
            <p className="text-[10px] font-mono uppercase tracking-[0.16em]">{label}</p>
          </div>
          <p className="mt-3 font-serif text-3xl font-light">{value}</p>
          <p className="mt-1 text-xs text-white/65">{note}</p>
        </div>
      ))}
    </section>
  );
}

function WeeklyScheduleEditor({
  rows,
  onChange,
}: {
  rows: UpdateLabConfigurationInput["weeklySchedule"];
  onChange: (rows: UpdateLabConfigurationInput["weeklySchedule"]) => void;
}) {
  const ordered = useMemo(() => [...rows].sort((a, b) => a.dayOfWeek - b.dayOfWeek), [rows]);
  const update = (dayOfWeek: number, patch: Partial<(typeof rows)[number]>) =>
    onChange(rows.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));
  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-border px-5 py-5 sm:px-7">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
          Weekly rhythm
        </p>
        <h2 className="mt-2 font-serif text-2xl font-light">Regular operating hours</h2>
      </div>
      <div className="divide-y divide-border">
        {ordered.map((row) => (
          <div
            key={row.dayOfWeek}
            className="grid gap-4 px-5 py-4 sm:grid-cols-[9rem_1fr_1fr] sm:items-center sm:px-7"
          >
            <div className="flex items-center justify-between gap-4 sm:justify-start">
              <Switch
                checked={row.isOpen}
                onCheckedChange={(checked) => update(row.dayOfWeek, { isOpen: checked })}
                aria-label={`${weekdayNames[row.dayOfWeek]} open`}
              />
              <p className="min-w-24 text-sm font-semibold">{weekdayNames[row.dayOfWeek]}</p>
            </div>
            <TimeField
              label="Opens"
              value={row.opensAt}
              disabled={!row.isOpen}
              onChange={(opensAt) => update(row.dayOfWeek, { opensAt })}
            />
            <TimeField
              label="Closes"
              value={row.closesAt}
              disabled={!row.isOpen}
              onChange={(closesAt) => update(row.dayOfWeek, { closesAt })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function DateExceptions({
  labId,
  configuration,
  onChanged,
}: {
  labId: string;
  configuration: LabConfiguration;
  onChanged: () => Promise<void>;
}) {
  const [input, setInput] = useState<DateExceptionInput>({
    date: "",
    isClosed: true,
    opensAt: null,
    closesAt: null,
    reason: "",
  });
  const save = useMutation({
    mutationFn: () => labsApi.upsertDateException(labId, input),
    onSuccess: async () => {
      await onChanged();
      setInput({ date: "", isClosed: true, opensAt: null, closesAt: null, reason: "" });
      toast.success("Date exception saved and availability updated");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Date exception could not be saved"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => labsApi.deleteDateException(labId, id),
    onSuccess: async () => {
      await onChanged();
      toast.success("Date exception removed and regular hours restored");
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Date exception could not be removed",
      ),
  });
  const canSave =
    input.date &&
    input.reason.trim().length >= 3 &&
    (input.isClosed || Boolean(input.opensAt && input.closesAt));
  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-border px-5 py-5 sm:px-7">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
          Calendar overrides
        </p>
        <h2 className="mt-2 font-serif text-2xl font-light">Closures and special hours</h2>
      </div>
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input
                type="date"
                min={configuration.bookingWindow.fromDate}
                value={input.date}
                onChange={(event) => setInput({ ...input, date: event.target.value })}
              />
            </Field>
            <Field label="Override type">
              <select
                value={input.isClosed ? "closed" : "special"}
                onChange={(event) =>
                  setInput({
                    ...input,
                    isClosed: event.target.value === "closed",
                    opensAt: event.target.value === "closed" ? null : "08:30",
                    closesAt: event.target.value === "closed" ? null : "18:30",
                  })
                }
                className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/20"
              >
                <option value="closed">Closed all day</option>
                <option value="special">Special hours</option>
              </select>
            </Field>
          </div>
          {!input.isClosed && (
            <div className="grid grid-cols-2 gap-4">
              <TimeField
                label="Opens"
                value={input.opensAt ?? "08:30"}
                onChange={(opensAt) => setInput({ ...input, opensAt })}
              />
              <TimeField
                label="Closes"
                value={input.closesAt ?? "18:30"}
                onChange={(closesAt) => setInput({ ...input, closesAt })}
              />
            </div>
          )}
          <Field label="Reason" hint="Shown to Students when availability changes.">
            <Input
              value={input.reason}
              placeholder="University holiday"
              onChange={(event) => setInput({ ...input, reason: event.target.value })}
            />
          </Field>
          <button
            type="button"
            disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Add calendar override
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            Upcoming overrides
          </p>
          <div className="mt-3 space-y-2">
            {configuration.dateExceptions.length ? (
              configuration.dateExceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{formatLocalDate(exception.date)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exception.isClosed
                        ? "Closed all day"
                        : `${exception.opensAt}–${exception.closesAt}`}{" "}
                      · {exception.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(exception.id)}
                    aria-label={`Remove override for ${exception.date}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Regular weekly hours apply throughout the booking window.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type="number"
          min={min}
          max={max}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="pr-20"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-24 items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function ConfigurationLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5" aria-label="Loading MakerSpace configuration">
      <div className="h-36 animate-pulse rounded-2xl bg-primary/10" />
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}

function configurationInput(configuration: LabConfiguration): UpdateLabConfigurationInput {
  return {
    configurationVersion: configuration.configurationVersion,
    name: configuration.name,
    description: configuration.description,
    timeZone: configuration.timeZone,
    slotDurationMinutes: configuration.slotDurationMinutes,
    bookingCapacity: configuration.bookingCapacity,
    quickVisitsEnabled: configuration.quickVisitsEnabled,
    quickVisitCapacity: configuration.quickVisitCapacity,
    bookingHorizonDays: configuration.bookingHorizonDays,
    cancellationWindowHours: configuration.cancellationWindowHours,
    maxFutureBookingsPerProject: configuration.maxFutureBookingsPerProject,
    projectVerificationRequired: configuration.projectVerificationRequired,
    teamLeaderAttendanceRequired: configuration.teamLeaderAttendanceRequired,
    weeklySchedule: configuration.weeklySchedule,
  };
}

function formatLocalDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
