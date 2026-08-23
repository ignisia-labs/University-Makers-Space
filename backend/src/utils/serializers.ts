import type {
  Booking,
  BookingParticipant,
  Equipment,
  EquipmentCategory,
  Event,
  Notification,
  Project,
  StudentProfile,
  User,
} from "@prisma/client";

type UserWithProfile = User & { studentProfile?: StudentProfile | null };
type UserWithAcademicProfile = User & {
  studentProfile?:
    | (StudentProfile & {
        department?: { id: string; code: string; name: string };
        programme?: { id: string; code: string; name: string; departmentId: string };
      })
    | null;
};
type EquipmentWithCategory = Equipment & { category?: EquipmentCategory };
type BookingWithDetails = Booking & {
  participants?: BookingParticipant[];
};
type BookingAccess = {
  viewerId: string;
  canManage: boolean;
  canCancelOwn: boolean;
  canReadParticipantPii: boolean;
  now?: Date;
};

export const userDto = (user: UserWithProfile | UserWithAcademicProfile) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  roles: user.roles,
  avatarUrl: user.avatarUrl,
  profileComplete: user.profileComplete,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  ...(user.studentProfile !== undefined
    ? {
        studentProfile: user.studentProfile
          ? {
              prn: user.studentProfile.prn,
              academicYear: user.studentProfile.academicYear,
              division: user.studentProfile.division,
              phone: user.studentProfile.phone,
              department:
                "department" in user.studentProfile ? user.studentProfile.department : undefined,
              programme:
                "programme" in user.studentProfile ? user.studentProfile.programme : undefined,
            }
          : null,
      }
    : {}),
});

export const equipmentDto = (equipment: EquipmentWithCategory) => ({
  id: equipment.id,
  labId: equipment.labId,
  categoryId: equipment.categoryId,
  category: equipment.category?.name,
  name: equipment.name,
  description: equipment.description,
  status: equipment.status,
  imageUrl: equipment.imageUrl,
  totalQuantity: equipment.totalQuantity,
  availableQuantity: equipment.availableQuantity,
  specs: equipment.specs,
  visible: equipment.visible,
  createdAt: equipment.createdAt.toISOString(),
  updatedAt: equipment.updatedAt.toISOString(),
});

export const bookingDto = (booking: BookingWithDetails, access?: BookingAccess) => {
  const cancellationDeadline = new Date(
    booking.slotStartsAtSnapshot.getTime() -
      booking.cancellationWindowHoursSnapshot * 60 * 60 * 1000,
  );
  const now = access?.now ?? new Date();
  const canCancel =
    booking.status === "CONFIRMED" &&
    Boolean(
      access &&
      (access.canManage ||
        (access.canCancelOwn &&
          access.viewerId === booking.createdById &&
          now <= cancellationDeadline)),
    );
  return {
    id: booking.id,
    labId: booking.labId,
    labSlotId: booking.labSlotId,
    projectId: booking.projectId,
    createdById: booking.createdById,
    projectTitle: booking.projectTitleSnapshot,
    labName: booking.labNameSnapshot,
    timeZone: booking.timeZoneSnapshot,
    attendeeCount: booking.attendeeCount,
    status: booking.status,
    statusLabel: bookingStatusLabel(booking),
    notes: booking.notes,
    cancellationReason: booking.cancellationReason,
    cancellationSource: booking.cancellationSource,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    startsAt: booking.slotStartsAtSnapshot.toISOString(),
    endsAt: booking.slotEndsAtSnapshot.toISOString(),
    participants:
      booking.participants?.map((participant) => {
        const canReadPii = access?.canReadParticipantPii || participant.userId === access?.viewerId;
        return {
          userId: participant.userId,
          name: participant.nameSnapshot,
          ...(canReadPii ? { email: participant.emailSnapshot } : {}),
          ...(canReadPii && participant.prnSnapshot ? { prn: participant.prnSnapshot } : {}),
          role: participant.projectRoleSnapshot,
        };
      }) ?? [],
    canCancel,
    cancellationDeadline: cancellationDeadline.toISOString(),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
};

function bookingStatusLabel(booking: BookingWithDetails) {
  if (booking.status === "ACTIVE") return "In Progress";
  if (booking.status === "COMPLETED") return "Completed";
  if (booking.status === "NO_SHOW") return "No Show";
  if (booking.status === "CANCELLED") {
    if (booking.cancellationSource === "STUDENT") return "Cancelled by Student";
    if (booking.cancellationSource === "LAB_ASSISTANT") return "Cancelled by Lab Assistant";
    if (booking.cancellationSource === "SUPER_ADMIN") return "Cancelled by Super Admin";
    return "Cancelled by Admin";
  }
  return "Confirmed";
}

export const projectDto = (project: Project) => ({
  id: project.id,
  labId: project.labId,
  title: project.title,
  description: project.description,
  creatorId: project.creatorId,
  currentMentorId: project.currentMentorId,
  status: project.status,
  tags: project.tags,
  domain: project.domain,
  rejectionReason: project.rejectionReason,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
});

export const eventDto = (event: Event) => ({
  id: event.id,
  labId: event.labId,
  title: event.title,
  description: event.description,
  organizerId: event.organizerId,
  location: event.location,
  startTime: event.startTime.toISOString(),
  endTime: event.endTime.toISOString(),
  capacity: event.capacity,
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString(),
});

export const notificationDto = (notification: Notification) => ({
  id: notification.id,
  userId: notification.userId,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  href: notification.href,
  isRead: notification.isRead,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
});
