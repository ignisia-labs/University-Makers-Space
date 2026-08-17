import {
  CalendarDays,
  CalendarClock,
  Check,
  Clock3,
  Cpu,
  FlaskConical,
  GraduationCap,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { InvitationStatus, Project, Reservation, StudentProfile } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";

export function ProjectDetailPanel({
  project,
  profile,
  reservations = [],
  onSubmitForVerification,
  onEdit,
  onDelete,
  onVerify,
}: {
  project: Project;
  profile: StudentProfile;
  reservations?: Reservation[];
  onSubmitForVerification?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onVerify?: () => void;
}) {
  const memberEmails = new Set(
    project.members.map((member) => member.email?.toLowerCase()).filter(Boolean),
  );
  const invitations = (
    project.teamInvitations ??
    project.invitedEmails.map((email) => ({ email, name: email, status: "Pending" as const }))
  ).filter((invitation) => !memberEmails.has(invitation.email.toLowerCase()));
  const consumables = project.consumables ?? [];
  const equipment = project.resources.filter((resource) => !consumables.includes(resource));
  const avatarNames = [project.leader, ...project.members.map((member) => member.name)];
  const isLeader = project.leader === profile.fullName;

  return (
    <div className="min-w-0 space-y-3">
      <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              MakerSpace project
            </p>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> Created {project.createdAt}
              </span>
              {project.reviewedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5" /> Reviewed {project.reviewedAt}
                </span>
              )}
            </p>
          </div>
          <StatusBadge label={project.status} className="shrink-0 bg-card/80" />
        </div>
      </section>

      {project.rejectionReason && (
        <section className="rounded-2xl border border-destructive/25 bg-destructive/[0.06] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-destructive">
            Faculty feedback
          </p>
          <p className="mt-2 text-sm leading-6">{project.rejectionReason}</p>
        </section>
      )}

      <div className="grid gap-4">
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          <DetailCard icon={Clock3} title="Project abstract">
            <p className="text-sm leading-7 text-muted-foreground">{project.description}</p>
          </DetailCard>

          <DetailCard icon={Users} title="Project team">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex -space-x-2"
                aria-label={`${avatarNames.length} accepted ${avatarNames.length === 1 ? "member" : "members"}`}
              >
                {avatarNames.slice(0, 5).map((name, index) => (
                  <Avatar key={`${name}-${index}`} name={name} />
                ))}
                {avatarNames.length > 5 && (
                  <span className="grid size-10 place-items-center rounded-full border-2 border-card bg-muted text-xs font-bold text-muted-foreground">
                    +{avatarNames.length - 5}
                  </span>
                )}
              </div>
              <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                {avatarNames.length} accepted
              </span>
            </div>

            <div className="mt-4 divide-y divide-border rounded-xl border">
              <TeamRow
                name={project.leader}
                detail={isLeader ? "Team Leader · You" : "Team Leader"}
                status="Accepted"
                leader
              />
              {project.members.map((member) => (
                <TeamRow
                  key={member.id}
                  name={member.name}
                  detail={`${member.department} · PRN ${member.prn}`}
                  status="Accepted"
                />
              ))}
              {invitations.map((invitation) => (
                <TeamRow
                  key={invitation.email}
                  name={invitation.name || invitation.email}
                  detail={invitation.email}
                  status={invitation.status}
                  invited
                />
              ))}
            </div>
          </DetailCard>
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-4 lg:gap-4 lg:space-y-0">
          <DetailCard icon={GraduationCap} title="Faculty mentor">
            <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {initials(project.mentor)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 break-words">{project.mentor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Assigned Faculty Mentor</p>
                  <div className="mt-2">
                    <StatusBadge
                      label={
                        project.status === "Verified"
                          ? "Approved"
                          : project.status === "Rejected"
                            ? "Rejected"
                            : "Awaiting review"
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

          <DetailCard icon={Cpu} title="Required equipment">
            <TagList items={equipment} empty="No equipment selected." tone="primary" />
          </DetailCard>

          <DetailCard icon={FlaskConical} title="Estimated consumables">
            <TagList items={consumables} empty="No consumables selected." tone="neutral" />
          </DetailCard>

          <DetailCard icon={CalendarClock} title="Project bookings">
            {reservations.length ? (
              <div className="space-y-2">
                {reservations.map((reservation) => (
                  <article
                    key={reservation.id}
                    className="rounded-xl border border-border bg-muted/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{reservation.date}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{reservation.slot}</p>
                      </div>
                      <StatusBadge label={reservation.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {reservation.attendees}{" "}
                      {reservation.attendees === 1 ? "attendee" : "attendees"}
                      {reservation.resources.length
                        ? ` · ${reservation.resources.length} session resources`
                        : ""}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No project bookings yet. Booking becomes available after verification.
              </p>
            )}
          </DetailCard>
        </div>
      </div>

      {isLeader && project.status === "Draft" && onSubmitForVerification && (
        <button
          type="button"
          onClick={onSubmitForVerification}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
        >
          Submit for verification
        </button>
      )}

      {isLeader && (onEdit || onDelete || onVerify) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Changing the kit sends the project back for re-verification.
          </p>
          <div className="flex flex-wrap gap-2">
            {onVerify && project.status !== "Verified" && (
              <button
                type="button"
                onClick={onVerify}
                title="Simulate team acceptance and mentor approval"
                className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              >
                <ShieldCheck className="size-3.5" /> Verify
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="pressable inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
              >
                Edit project
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="pressable inline-flex min-h-11 items-center rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-[0_8px_28px_-24px_rgba(15,23,42,0.65)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary">
          <Icon className="size-4.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function TeamRow({
  name,
  detail,
  status,
  leader = false,
  invited = false,
}: {
  name: string;
  detail: string;
  status: InvitationStatus | "Accepted";
  leader?: boolean;
  invited?: boolean;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2">
      <Avatar name={name} small invited={invited} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <StatusBadge label={leader ? "Leader" : status} className="shrink-0" />
    </div>
  );
}

function Avatar({
  name,
  small = false,
  invited = false,
}: {
  name: string;
  small?: boolean;
  invited?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 border-card font-bold",
        small ? "size-9 text-[10px]" : "size-10 text-xs",
        invited ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
      )}
      title={name}
    >
      {invited ? <Mail className="size-3.5" /> : initials(name)}
    </span>
  );
}

function TagList({
  items,
  empty,
  tone,
}: {
  items: string[];
  empty: string;
  tone: "primary" | "neutral";
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold",
            tone === "primary"
              ? "border-primary/20 bg-primary/[0.06] text-primary"
              : "border-border bg-muted/70 text-muted-foreground",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function initials(name: string) {
  return name
    .replace(/^(Dr\.|Prof\.)\s*/i, "")
    .split(/[\s—-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
