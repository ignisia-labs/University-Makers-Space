import type {
  Booking,
  BookingParticipant,
  Equipment,
  EquipmentCategory,
  Event,
  LabSlot,
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
  labSlot?: LabSlot;
  participants?: BookingParticipant[];
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

export const bookingDto = (booking: BookingWithDetails) => ({
  id: booking.id,
  labId: booking.labId,
  labSlotId: booking.labSlotId,
  projectId: booking.projectId,
  createdById: booking.createdById,
  attendeeCount: booking.attendeeCount,
  status: booking.status,
  notes: booking.notes,
  cancellationReason: booking.cancellationReason,
  startsAt: booking.labSlot?.startsAt.toISOString(),
  endsAt: booking.labSlot?.endsAt.toISOString(),
  participantIds: booking.participants?.map((participant) => participant.userId),
  createdAt: booking.createdAt.toISOString(),
  updatedAt: booking.updatedAt.toISOString(),
});

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
