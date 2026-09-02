import type { QuickVisit, Visit } from "@prisma/client";

export type QuickVisitAccess = {
  viewerId: string;
  canManage: boolean;
  canDecide: boolean;
  canCancelOwn: boolean;
  canReadPii: boolean;
  now?: Date;
};

export type VisitAccess = {
  viewerId: string;
  canManage: boolean;
  canReadPii: boolean;
  now?: Date;
};

export const quickVisitDto = (quickVisit: QuickVisit, access: QuickVisitAccess) => {
  const now = access.now ?? new Date();
  const isOwner = quickVisit.userId === access.viewerId;
  const canReadPii = access.canReadPii || isOwner;
  const isLive =
    quickVisit.status === "REQUESTED" ||
    quickVisit.status === "CONFIRMED" ||
    quickVisit.status === "ACTIVE";
  return {
    id: quickVisit.id,
    labId: quickVisit.labId,
    labSlotId: quickVisit.labSlotId,
    userId: quickVisit.userId,
    labName: quickVisit.labNameSnapshot,
    timeZone: quickVisit.timeZoneSnapshot,
    purpose: quickVisit.purpose,
    status: quickVisit.status,
    statusLabel: quickVisitStatusLabel(quickVisit),
    startsAt: quickVisit.slotStartsAtSnapshot.toISOString(),
    endsAt: quickVisit.slotEndsAtSnapshot.toISOString(),
    visitor: {
      userId: quickVisit.userId,
      name: quickVisit.userNameSnapshot,
      ...(canReadPii ? { email: quickVisit.userEmailSnapshot } : {}),
      ...(canReadPii && quickVisit.userPrnSnapshot ? { prn: quickVisit.userPrnSnapshot } : {}),
    },
    decidedAt: quickVisit.decidedAt?.toISOString() ?? null,
    decisionReason: quickVisit.decisionReason,
    cancelledAt: quickVisit.cancelledAt?.toISOString() ?? null,
    cancellationReason: quickVisit.cancellationReason,
    cancellationSource: quickVisit.cancellationSource,
    canDecide: access.canDecide && quickVisit.status === "REQUESTED",
    canCancel:
      isLive &&
      quickVisit.status !== "ACTIVE" &&
      (access.canManage ||
        (isOwner && access.canCancelOwn && quickVisit.slotStartsAtSnapshot > now)),
    createdAt: quickVisit.createdAt.toISOString(),
    updatedAt: quickVisit.updatedAt.toISOString(),
  };
};

function quickVisitStatusLabel(quickVisit: QuickVisit) {
  switch (quickVisit.status) {
    case "REQUESTED":
      return "Awaiting approval";
    case "CONFIRMED":
      return "Confirmed";
    case "ACTIVE":
      return "In the MakerSpace";
    case "COMPLETED":
      return "Completed";
    case "NO_SHOW":
      return "No Show";
    default:
      return sourceLabel(quickVisit.cancellationSource);
  }
}

function sourceLabel(source: QuickVisit["cancellationSource"]) {
  if (source === "STUDENT") return "Cancelled by Student";
  if (source === "LAB_ASSISTANT") return "Cancelled by Lab Assistant";
  if (source === "SUPER_ADMIN") return "Cancelled by Super Admin";
  if (source === "ADMIN") return "Cancelled by Admin";
  return "Cancelled";
}

/**
 * `lateArrivalGraceMinutes` / `overstayGraceMinutes` come from the lab's current
 * policy rather than the visit row: the stored deltas are raw truth, and the
 * grace threshold is only ever a presentation concern.
 */
export const visitDto = (
  visit: Visit,
  access: VisitAccess,
  policy?: { lateArrivalGraceMinutes: number; overstayGraceMinutes: number },
) => {
  const isSelf = visit.userId === access.viewerId;
  const canReadPii = access.canReadPii || isSelf;
  const lateGrace = policy?.lateArrivalGraceMinutes ?? 0;
  const overstayGrace = policy?.overstayGraceMinutes ?? 0;
  return {
    id: visit.id,
    labId: visit.labId,
    userId: visit.userId,
    bookingId: visit.bookingId,
    quickVisitId: visit.quickVisitId,
    projectId: visit.projectId,
    source: visit.source,
    status: visit.status,
    statusLabel: visit.status === "CHECKED_IN" ? "In the MakerSpace" : "Checked out",
    labName: visit.labNameSnapshot,
    timeZone: visit.timeZoneSnapshot,
    projectTitle: visit.projectTitleSnapshot,
    visitor: {
      userId: visit.userId,
      name: visit.userNameSnapshot,
      ...(canReadPii ? { email: visit.userEmailSnapshot } : {}),
      ...(canReadPii && visit.userPrnSnapshot ? { prn: visit.userPrnSnapshot } : {}),
    },
    expectedStartAt: visit.expectedStartAt.toISOString(),
    expectedEndAt: visit.expectedEndAt.toISOString(),
    checkedInAt: visit.checkedInAt.toISOString(),
    checkedOutAt: visit.checkedOutAt?.toISOString() ?? null,
    lateByMinutes: visit.lateByMinutes,
    isLateArrival: visit.lateByMinutes > lateGrace,
    overstayByMinutes: visit.overstayByMinutes,
    isOverstay: visit.overstayByMinutes > overstayGrace,
    closeReason: visit.closeReason,
    notes: visit.notes,
    durationMinutes: visit.checkedOutAt
      ? Math.max(
          0,
          Math.round((visit.checkedOutAt.getTime() - visit.checkedInAt.getTime()) / 60_000),
        )
      : null,
    canCheckOut: access.canManage && visit.status === "CHECKED_IN",
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  };
};
