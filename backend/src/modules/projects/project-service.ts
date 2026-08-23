import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  DeliveryStatus,
  MentorRequestStatus,
  NotificationChannel,
  Prisma,
  ProjectMemberStatus,
  ProjectStatus,
  UserRole,
} from "@prisma/client";
import { hasPermission } from "../../config/permissions.js";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";

const sortFields = new Set(["title", "status", "createdAt", "updatedAt"]);
type Viewer = NonNullable<Express.Request["user"]>;
type MentorEmailActionToken = {
  type: "mentor_email_action";
  requestId: string;
  facultyId: string;
};

function summaryInclude(now: Date) {
  return {
    creator: { select: { id: true, name: true, email: true } },
    currentMentor: { select: { id: true, name: true, email: true } },
    members: { select: { id: true, userId: true, email: true, status: true, role: true } },
    mentorRequests: {
      select: { status: true, requestedAt: true, respondedAt: true },
      orderBy: { requestedAt: "desc" },
      take: 1,
    },
    bookings: {
      where: {
        status: { in: ["CONFIRMED", "ACTIVE"] },
        slotEndsAtSnapshot: { gt: now },
      },
      orderBy: [{ slotStartsAtSnapshot: "asc" }, { id: "asc" }],
      take: 1,
    },
  } satisfies Prisma.ProjectInclude;
}

const detailInclude = {
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
      studentProfile: { select: { department: { select: { id: true, code: true, name: true } } } },
    },
  },
  currentMentor: { select: { id: true, name: true, email: true } },
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: {
            select: { department: { select: { id: true, code: true, name: true } } },
          },
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  },
  mentorRequests: {
    include: { faculty: { select: { id: true, name: true, email: true } } },
    orderBy: { requestedAt: "desc" },
  },
  equipmentRequirements: {
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          status: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  consumableRequirements: {
    include: {
      consumable: {
        select: {
          id: true,
          name: true,
          unit: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  bookings: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
  },
} satisfies Prisma.ProjectInclude;

const mentorEmailActionSecret = crypto
  .createHash("sha256")
  .update(`${env.JWT_SECRET}:mentor-email-action`)
  .digest("hex");

function mentorEmailReviewHref(requestId: string, facultyId: string) {
  const token = jwt.sign(
    { type: "mentor_email_action", requestId, facultyId } satisfies MentorEmailActionToken,
    mentorEmailActionSecret,
    { expiresIn: "7d" },
  );
  const reviewUrl = new URL(`/mentor-review/${requestId}`, env.FRONTEND_URL);
  return `${reviewUrl.toString()}#token=${encodeURIComponent(token)}`;
}

function assertMentorEmailActionToken(token: string, requestId: string) {
  try {
    const payload = jwt.verify(token, mentorEmailActionSecret) as MentorEmailActionToken;
    if (
      payload.type !== "mentor_email_action" ||
      payload.requestId !== requestId ||
      !payload.facultyId
    ) {
      throw new Error("Invalid mentor action token");
    }
    return payload;
  } catch {
    throw new ApiError(
      410,
      "MENTOR_ACTION_LINK_INVALID",
      "This Faculty Mentor email link is invalid or has expired",
    );
  }
}

type SummaryProject = Prisma.ProjectGetPayload<{ include: ReturnType<typeof summaryInclude> }>;
type DetailProject = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

function scopeFor(viewer: Viewer): Prisma.ProjectWhereInput {
  if (hasPermission(viewer.roles, "project.read.any")) return {};
  if (hasPermission(viewer.roles, "project.read.mentored")) {
    return { currentMentorId: viewer.id };
  }
  return {
    OR: [
      { creatorId: viewer.id },
      {
        members: {
          some: {
            OR: [{ userId: viewer.id }, { email: viewer.email }],
            status: { notIn: [ProjectMemberStatus.CANCELLED, ProjectMemberStatus.EXPIRED] },
          },
        },
      },
    ],
  };
}

function projectStatusMessage(
  project: Pick<SummaryProject, "status" | "rejectionReason">,
  pendingMemberCount: number,
  declinedMemberCount: number,
  mentorRequestStatus: MentorRequestStatus | null,
) {
  if (project.status === ProjectStatus.VERIFIED) return "Project verified";
  if (project.status === ProjectStatus.ARCHIVED) return "Project archived";
  if (project.status === ProjectStatus.REJECTED) {
    return project.rejectionReason
      ? `Faculty Mentor requested changes: ${project.rejectionReason}`
      : "Faculty Mentor requested changes";
  }
  if (declinedMemberCount > 0) {
    return `${declinedMemberCount} member invitation${declinedMemberCount === 1 ? "" : "s"} declined`;
  }
  if (pendingMemberCount > 0) {
    return `Waiting for ${pendingMemberCount} team member${pendingMemberCount === 1 ? "" : "s"}`;
  }
  if (mentorRequestStatus === MentorRequestStatus.APPROVED) return "Project verified";
  return "Waiting for Faculty Mentor approval";
}

function viewerMetadata(project: SummaryProject, viewer: Viewer) {
  if (project.creatorId === viewer.id) {
    return { viewerRelationship: "LEADER", viewerMemberStatus: ProjectMemberStatus.ACCEPTED };
  }
  const membership = project.members.find(
    (member) => member.userId === viewer.id || member.email === viewer.email,
  );
  if (membership) {
    return { viewerRelationship: "MEMBER", viewerMemberStatus: membership.status };
  }
  if (project.currentMentorId === viewer.id) {
    return { viewerRelationship: "MENTOR", viewerMemberStatus: null };
  }
  return { viewerRelationship: "OVERSIGHT", viewerMemberStatus: null };
}

function summaryDto(project: SummaryProject, viewer: Viewer) {
  const activeMembers = project.members.filter(
    (member) =>
      member.status !== ProjectMemberStatus.CANCELLED &&
      member.status !== ProjectMemberStatus.EXPIRED,
  );
  const now = Date.now();
  const nextBooking = project.bookings
    .filter(
      (booking) =>
        (booking.status === "CONFIRMED" || booking.status === "ACTIVE") &&
        booking.slotEndsAtSnapshot.getTime() > now,
    )
    .sort(
      (left, right) =>
        left.slotStartsAtSnapshot.getTime() - right.slotStartsAtSnapshot.getTime() ||
        left.id.localeCompare(right.id),
    )[0];
  const pendingMemberCount = activeMembers.filter(
    (member) => member.status === ProjectMemberStatus.PENDING,
  ).length;
  const declinedMemberCount = activeMembers.filter(
    (member) => member.status === ProjectMemberStatus.DECLINED,
  ).length;
  const mentorRequestStatus = project.mentorRequests[0]?.status ?? null;
  return {
    id: project.id,
    labId: project.labId,
    title: project.title,
    description: project.description,
    status: project.status,
    creatorId: project.creatorId,
    leader: project.creator,
    mentor: project.currentMentor,
    memberCount: activeMembers.length,
    pendingMemberCount,
    declinedMemberCount,
    mentorRequestStatus,
    statusMessage: projectStatusMessage(
      project,
      pendingMemberCount,
      declinedMemberCount,
      mentorRequestStatus,
    ),
    ...viewerMetadata(project, viewer),
    nextBooking: nextBooking
      ? {
          id: nextBooking.id,
          startsAt: nextBooking.slotStartsAtSnapshot.toISOString(),
          endsAt: nextBooking.slotEndsAtSnapshot.toISOString(),
        }
      : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function detailDto(project: DetailProject, viewer: Viewer) {
  const summary = summaryDto(project, viewer);
  return {
    ...summary,
    domain: project.domain,
    tags: project.tags,
    rejectionReason: project.rejectionReason,
    submittedAt: project.submittedAt?.toISOString() ?? null,
    members: project.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      email: member.email,
      role: member.role,
      status: member.status,
      name: member.user?.name ?? member.email,
      department: member.user?.studentProfile?.department ?? null,
      invitationExpiresAt: member.invitationExpiresAt?.toISOString() ?? null,
      invitationEmailStatus: member.invitationEmailStatus,
      respondedAt: member.respondedAt?.toISOString() ?? null,
    })),
    mentorRequests: project.mentorRequests.map((request) => ({
      id: request.id,
      faculty: request.faculty,
      status: request.status,
      reason: request.reason,
      requestedAt: request.requestedAt.toISOString(),
      respondedAt: request.respondedAt?.toISOString() ?? null,
    })),
    equipment: project.equipmentRequirements.map((item) => ({
      id: item.equipment.id,
      name: item.equipment.name,
      category: item.equipment.category.name,
      status: item.equipment.status,
    })),
    consumables: project.consumableRequirements.map((item) => ({
      id: item.consumable.id,
      name: item.consumable.name,
      category: item.consumable.category.name,
      unit: item.consumable.unit,
    })),
    bookings: project.bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      startsAt: booking.slotStartsAtSnapshot.toISOString(),
      endsAt: booking.slotEndsAtSnapshot.toISOString(),
    })),
  };
}

export async function list(query: Record<string, unknown>, viewer: Viewer) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const sortBy = sortFields.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    AND: [scopeFor(viewer)],
    ...(query.search
      ? {
          OR: [
            { title: { contains: String(query.search), mode: "insensitive" } },
            { description: { contains: String(query.search), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status as Prisma.EnumProjectStatusFilter } : {}),
    ...(query.creatorId ? { creatorId: String(query.creatorId) } : {}),
    ...(query.labId ? { labId: String(query.labId) } : {}),
    ...(query.mentorRequestStatus
      ? {
          mentorRequests: {
            some: {
              status: query.mentorRequestStatus as MentorRequestStatus,
              ...(hasPermission(viewer.roles, "project.read.mentored")
                ? { facultyId: viewer.id }
                : {}),
            },
          },
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: summaryInclude(new Date()),
      orderBy: { [sortBy]: query.order ?? "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: rows.map((row) => summaryDto(row, viewer)), meta: meta(page, limit, total) };
}

export async function get(id: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null, AND: [scopeFor(viewer)] },
    include: detailInclude,
  });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  return detailDto(project, viewer);
}

type CreateInput = {
  idempotencyKey: string;
  labId: string;
  title: string;
  description: string;
  teamMemberEmails: string[];
  mentorId: string;
  equipmentIds: string[];
  consumableIds: string[];
};

export async function create(viewer: Viewer, data: CreateInput) {
  const existing = await prisma.project.findUnique({
    where: {
      creatorId_idempotencyKey: { creatorId: viewer.id, idempotencyKey: data.idempotencyKey },
    },
  });
  if (existing) return get(existing.id, viewer);

  const teamEmails = [...new Set(data.teamMemberEmails.map((email) => email.toLowerCase()))].filter(
    (email) => email !== viewer.email,
  );
  const equipmentIds = [...new Set(data.equipmentIds)];
  const consumableIds = [...new Set(data.consumableIds)];

  try {
    const projectId = await prisma.$transaction(async (tx) => {
      const [creator, lab, mentor, teamUsers, teamProvisions, equipment, consumables] =
        await Promise.all([
          tx.user.findFirst({
            where: {
              id: viewer.id,
              isActive: true,
              deletedAt: null,
              profileComplete: true,
              roles: { has: UserRole.STUDENT },
            },
          }),
          tx.lab.findFirst({ where: { id: data.labId, isActive: true } }),
          tx.user.findFirst({
            where: {
              id: data.mentorId,
              roles: { has: UserRole.FACULTY_MENTOR },
              isActive: true,
              deletedAt: null,
            },
          }),
          tx.user.findMany({
            where: {
              email: { in: teamEmails },
            },
            select: {
              id: true,
              email: true,
              name: true,
              roles: true,
              isActive: true,
              deletedAt: true,
            },
          }),
          tx.userProvisioning.findMany({
            where: { email: { in: teamEmails }, isActive: true },
            select: { email: true, roles: true },
          }),
          tx.equipment.findMany({
            where: { id: { in: equipmentIds }, labId: data.labId, visible: true, deletedAt: null },
            select: { id: true },
          }),
          tx.consumable.findMany({
            where: { id: { in: consumableIds }, labId: data.labId, isActive: true },
            select: { id: true },
          }),
        ]);
      if (!creator) {
        throw new ApiError(409, "PROFILE_INCOMPLETE", "Complete your student profile first");
      }
      if (!lab) throw new ApiError(404, "NOT_FOUND", "MakerSpace is not available");
      if (!mentor) throw new ApiError(400, "INVALID_MENTOR", "Select an authorized Faculty Mentor");
      const nonStudentProvision = teamProvisions.find(
        (provision) => !provision.roles.includes(UserRole.STUDENT),
      );
      const unavailableStudentAccount = teamUsers.find(
        (account) =>
          !account.roles.includes(UserRole.STUDENT) || !account.isActive || account.deletedAt,
      );
      if (nonStudentProvision || unavailableStudentAccount) {
        const unavailableEmail = nonStudentProvision?.email ?? unavailableStudentAccount!.email;
        throw new ApiError(
          400,
          "INVALID_TEAM_MEMBER",
          `${unavailableEmail} belongs to a staff or disabled account and cannot be invited as a student`,
        );
      }
      if (equipment.length !== equipmentIds.length || consumables.length !== consumableIds.length) {
        throw new ApiError(
          400,
          "INVALID_PROJECT_RESOURCE",
          "One or more selected resources are no longer available in the catalogue",
        );
      }

      const submittedAt = new Date();
      const project = await tx.project.create({
        data: {
          idempotencyKey: data.idempotencyKey,
          labId: data.labId,
          creatorId: viewer.id,
          currentMentorId: mentor.id,
          title: data.title,
          description: data.description,
          submittedAt,
          status:
            teamEmails.length > 0
              ? ProjectStatus.TEAM_ACCEPTANCE_PENDING
              : ProjectStatus.MENTOR_APPROVAL_PENDING,
        },
      });
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: creator.id,
          email: creator.email,
          role: "LEADER",
          status: ProjectMemberStatus.ACCEPTED,
          acceptedAt: submittedAt,
          respondedAt: submittedAt,
        },
      });
      if (teamEmails.length) {
        const usersByEmail = new Map(teamUsers.map((member) => [member.email, member]));
        await tx.projectMember.createMany({
          data: teamEmails.map((email) => ({
            projectId: project.id,
            userId: usersByEmail.get(email)?.id,
            email,
            status: ProjectMemberStatus.PENDING,
            invitationTokenHash: hashToken(crypto.randomBytes(32).toString("base64url")),
            invitationExpiresAt: new Date(submittedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
            invitationEmailStatus: DeliveryStatus.PENDING,
          })),
        });
      }
      const mentorRequest = await tx.mentorRequest.create({
        data: { projectId: project.id, facultyId: mentor.id },
      });
      if (equipment.length) {
        await tx.projectEquipmentRequirement.createMany({
          data: equipment.map((item) => ({ projectId: project.id, equipmentId: item.id })),
        });
      }
      if (consumables.length) {
        await tx.projectConsumableRequirement.createMany({
          data: consumables.map((item) => ({ projectId: project.id, consumableId: item.id })),
        });
      }

      for (const member of teamUsers) {
        await createNotification(tx, {
          userId: member.id,
          type: "PROJECT_INVITATION",
          title: `Invitation to join ${project.title}`,
          body: `${creator.name} invited you to join their MakerSpace project.`,
          href: `/invitations/${project.id}`,
        });
      }
      await createNotification(tx, {
        userId: mentor.id,
        type: "MENTOR_REQUEST",
        title: `Review ${project.title}`,
        body: `${creator.name} requested your verification as Faculty Mentor.`,
        href: mentorEmailReviewHref(mentorRequest.id, mentor.id),
      });
      await tx.auditLog.create({
        data: {
          actorUserId: viewer.id,
          action: "project.submitted",
          entityType: "Project",
          entityId: project.id,
          metadata: {
            teamMemberCount: teamEmails.length,
            mentorId: mentor.id,
            equipmentCount: equipment.length,
            consumableCount: consumables.length,
          },
        },
      });
      return project.id;
    });
    return get(projectId, viewer);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.project.findUnique({
        where: {
          creatorId_idempotencyKey: {
            creatorId: viewer.id,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });
      if (duplicate) return get(duplicate.id, viewer);
    }
    throw error;
  }
}

type UpdateInput = {
  title?: string;
  description?: string;
  equipmentIds?: string[];
  consumableIds?: string[];
};

export async function update(id: string, data: UpdateInput, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  assertLeader(project, viewer);
  if (project!.status === ProjectStatus.ARCHIVED) {
    throw new ApiError(409, "PROJECT_LOCKED", "Archived projects cannot be edited");
  }

  const majorDetailsChanged =
    (data.title !== undefined && data.title !== project!.title) ||
    (data.description !== undefined && data.description !== project!.description);
  await prisma.$transaction(async (tx) => {
    if (data.equipmentIds) {
      const ids = [...new Set(data.equipmentIds)];
      const valid = await tx.equipment.findMany({
        where: { id: { in: ids }, labId: project!.labId, visible: true, deletedAt: null },
        select: { id: true },
      });
      if (valid.length !== ids.length) {
        throw new ApiError(400, "INVALID_PROJECT_RESOURCE", "An equipment selection is invalid");
      }
      await tx.projectEquipmentRequirement.deleteMany({ where: { projectId: id } });
      if (ids.length) {
        await tx.projectEquipmentRequirement.createMany({
          data: ids.map((equipmentId) => ({ projectId: id, equipmentId })),
        });
      }
    }
    if (data.consumableIds) {
      const ids = [...new Set(data.consumableIds)];
      const valid = await tx.consumable.findMany({
        where: { id: { in: ids }, labId: project!.labId, isActive: true },
        select: { id: true },
      });
      if (valid.length !== ids.length) {
        throw new ApiError(400, "INVALID_PROJECT_RESOURCE", "A consumable selection is invalid");
      }
      await tx.projectConsumableRequirement.deleteMany({ where: { projectId: id } });
      if (ids.length) {
        await tx.projectConsumableRequirement.createMany({
          data: ids.map((consumableId) => ({ projectId: id, consumableId })),
        });
      }
    }

    let status = project!.status;
    if (majorDetailsChanged && project!.currentMentorId) {
      await tx.mentorRequest.updateMany({
        where: { projectId: id, status: MentorRequestStatus.PENDING },
        data: { status: MentorRequestStatus.CANCELLED, respondedAt: new Date() },
      });
      const mentorRequest = await tx.mentorRequest.create({
        data: { projectId: id, facultyId: project!.currentMentorId },
      });
      status = await pendingStatus(tx, id);
      await createNotification(tx, {
        userId: project!.currentMentorId,
        type: "MENTOR_REQUEST",
        title: `Review updated project ${data.title ?? project!.title}`,
        body: "Major project details changed and require renewed Faculty Mentor verification.",
        href: mentorEmailReviewHref(mentorRequest.id, project!.currentMentorId),
      });
    }
    await tx.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        status,
        rejectionReason: majorDetailsChanged ? null : undefined,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "project.updated",
        entityType: "Project",
        entityId: id,
        metadata: {
          majorDetailsChanged,
          equipmentChanged: data.equipmentIds !== undefined,
          consumablesChanged: data.consumableIds !== undefined,
        },
      },
    });
  });
  return get(id, viewer);
}

export async function inviteMember(projectId: string, email: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  assertLeader(project, viewer);
  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail === viewer.email) {
    throw new ApiError(400, "INVALID_TEAM_MEMBER", "The Team Leader is already a member");
  }
  const [user, provision] = await prisma.$transaction([
    prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        deletedAt: null,
      },
    }),
    prisma.userProvisioning.findUnique({ where: { email: normalizedEmail } }),
  ]);
  if (
    (user && (!user.isActive || !user.roles.includes(UserRole.STUDENT))) ||
    (provision?.isActive && !provision.roles.includes(UserRole.STUDENT))
  ) {
    throw new ApiError(
      400,
      "INVALID_TEAM_MEMBER",
      "That institutional email belongs to a staff or disabled account",
    );
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.projectMember.findUnique({
      where: { projectId_email: { projectId, email: normalizedEmail } },
    });
    if (existing?.status === ProjectMemberStatus.ACCEPTED) return;
    await tx.projectMember.upsert({
      where: { projectId_email: { projectId, email: normalizedEmail } },
      update: {
        userId: user?.id,
        status: ProjectMemberStatus.PENDING,
        invitationTokenHash: hashToken(crypto.randomBytes(32).toString("base64url")),
        invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitationEmailStatus: DeliveryStatus.PENDING,
        invitationEmailAttempts: 0,
        invitationEmailSentAt: null,
        respondedAt: null,
        removedAt: null,
      },
      create: {
        projectId,
        userId: user?.id,
        email: normalizedEmail,
        status: ProjectMemberStatus.PENDING,
        invitationTokenHash: hashToken(crypto.randomBytes(32).toString("base64url")),
        invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitationEmailStatus: DeliveryStatus.PENDING,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.TEAM_ACCEPTANCE_PENDING, rejectionReason: null },
    });
    if (project!.status === ProjectStatus.VERIFIED && project!.currentMentorId) {
      const mentorRequest = await tx.mentorRequest.create({
        data: { projectId, facultyId: project!.currentMentorId },
      });
      await createNotification(tx, {
        userId: project!.currentMentorId,
        type: "MENTOR_REQUEST",
        title: `Review team change for ${project!.title}`,
        body: "A new teammate was invited and the updated team requires renewed approval.",
        href: mentorEmailReviewHref(mentorRequest.id, project!.currentMentorId),
      });
    }
    if (user) {
      await createNotification(tx, {
        userId: user.id,
        type: "PROJECT_INVITATION",
        title: `Invitation to join ${project!.title}`,
        body: `${viewer.name} invited you to join their MakerSpace project.`,
        href: `/invitations/${projectId}`,
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "project.member_invited",
        entityType: "ProjectMember",
        entityId: projectId,
        metadata: { email: normalizedEmail, userId: user?.id ?? null },
      },
    });
  });
  return get(projectId, viewer);
}

export async function respondToInvitation(
  projectId: string,
  decision: "ACCEPTED" | "DECLINED",
  viewer: Viewer,
) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, OR: [{ userId: viewer.id }, { email: viewer.email }] },
    include: { project: true },
  });
  if (!member || member.role === "LEADER") {
    throw new ApiError(404, "NOT_FOUND", "Project invitation not found");
  }
  if (member.status === decision) return get(projectId, viewer);
  if (member.status !== ProjectMemberStatus.PENDING) {
    throw new ApiError(409, "INVITATION_RESOLVED", "This invitation has already been resolved");
  }
  if (member.invitationExpiresAt && member.invitationExpiresAt <= new Date()) {
    await prisma.projectMember.update({
      where: { id: member.id },
      data: { status: ProjectMemberStatus.EXPIRED, respondedAt: new Date() },
    });
    throw new ApiError(410, "INVITATION_EXPIRED", "This invitation has expired");
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.update({
      where: { id: member.id },
      data: {
        userId: viewer.id,
        status: decision,
        respondedAt: new Date(),
        acceptedAt: decision === "ACCEPTED" ? new Date() : null,
      },
    });
    const status = await recomputeProjectStatus(tx, projectId);
    await createNotification(tx, {
      userId: member.project.creatorId,
      type: decision === "ACCEPTED" ? "TEAM_INVITATION_ACCEPTED" : "TEAM_INVITATION_DECLINED",
      title: `${viewer.name} ${decision === "ACCEPTED" ? "joined" : "declined"} ${member.project.title}`,
      body:
        decision === "ACCEPTED"
          ? "The project team has been updated."
          : "The declined invitation is visible in the project and can be cancelled or replaced.",
      href: `/projects/${projectId}`,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action:
          decision === "ACCEPTED" ? "project.invitation_accepted" : "project.invitation_declined",
        entityType: "ProjectMember",
        entityId: member.id,
      },
    });
    if (status === ProjectStatus.VERIFIED && member.project.status !== ProjectStatus.VERIFIED) {
      await notifyProjectVerified(tx, projectId, member.project.title);
    }
  });
  return get(projectId, viewer);
}

export async function cancelOrRemoveMember(projectId: string, memberId: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  assertLeader(project, viewer);
  const member = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
  if (!member) throw new ApiError(404, "NOT_FOUND", "Project member not found");
  if (member.role === "LEADER")
    throw new ApiError(409, "LEADER_REQUIRED", "The Team Leader cannot be removed");
  if (
    member.status === ProjectMemberStatus.CANCELLED ||
    member.status === ProjectMemberStatus.EXPIRED
  ) {
    return get(projectId, viewer);
  }
  const latestMentorRequest = await prisma.mentorRequest.findFirst({
    where: { projectId },
    orderBy: { requestedAt: "desc" },
    select: { status: true },
  });
  const needsRenewedMentorApproval =
    member.status === ProjectMemberStatus.ACCEPTED &&
    latestMentorRequest?.status === MentorRequestStatus.APPROVED &&
    Boolean(project!.currentMentorId);

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.update({
      where: { id: memberId },
      data: {
        status: ProjectMemberStatus.CANCELLED,
        removedAt: new Date(),
        respondedAt: new Date(),
      },
    });
    if (needsRenewedMentorApproval && project!.currentMentorId) {
      const mentorRequest = await tx.mentorRequest.create({
        data: { projectId, facultyId: project!.currentMentorId },
      });
      const status = await pendingStatus(tx, projectId);
      await tx.project.update({ where: { id: projectId }, data: { status } });
      await createNotification(tx, {
        userId: project!.currentMentorId,
        type: "MENTOR_REQUEST",
        title: `Review team change for ${project!.title}`,
        body: "The verified team changed and requires renewed Faculty Mentor approval.",
        href: mentorEmailReviewHref(mentorRequest.id, project!.currentMentorId),
      });
    } else {
      await recomputeProjectStatus(tx, projectId);
    }
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action:
          member.status === ProjectMemberStatus.ACCEPTED
            ? "project.member_removed"
            : "project.invitation_cancelled",
        entityType: "ProjectMember",
        entityId: member.id,
      },
    });
  });
  return get(projectId, viewer);
}

export async function requestMentor(projectId: string, facultyId: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  assertLeader(project, viewer);
  const faculty = await prisma.user.findFirst({
    where: {
      id: facultyId,
      roles: { has: UserRole.FACULTY_MENTOR },
      isActive: true,
      deletedAt: null,
    },
  });
  if (!faculty) {
    throw new ApiError(400, "INVALID_MENTOR", "Selected user is not an active Faculty Mentor");
  }
  const pending = await prisma.mentorRequest.findFirst({
    where: { projectId, facultyId, status: MentorRequestStatus.PENDING },
  });
  if (pending && project!.currentMentorId === facultyId) return get(projectId, viewer);

  await prisma.$transaction(async (tx) => {
    await tx.mentorRequest.updateMany({
      where: { projectId, status: MentorRequestStatus.PENDING },
      data: { status: MentorRequestStatus.CANCELLED, respondedAt: new Date() },
    });
    const mentorRequest = await tx.mentorRequest.create({ data: { projectId, facultyId } });
    const teamStatus = await pendingStatus(tx, projectId);
    await tx.project.update({
      where: { id: projectId },
      data: { currentMentorId: facultyId, status: teamStatus, rejectionReason: null },
    });
    await createNotification(tx, {
      userId: facultyId,
      type: "MENTOR_REQUEST",
      title: `Review ${project!.title}`,
      body: `${viewer.name} selected you as Faculty Mentor.`,
      href: mentorEmailReviewHref(mentorRequest.id, facultyId),
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "project.mentor_changed",
        entityType: "Project",
        entityId: projectId,
        metadata: { previousMentorId: project!.currentMentorId, facultyId },
      },
    });
  });
  return get(projectId, viewer);
}

export async function decideMentorRequest(
  projectId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | undefined,
  viewer: Viewer,
) {
  const request = await prisma.mentorRequest.findFirst({
    where: {
      projectId,
      facultyId: viewer.id,
      project: { currentMentorId: viewer.id, deletedAt: null },
    },
    include: { project: true },
    orderBy: { requestedAt: "desc" },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Mentor request not found");
  if (request.status === decision) return get(projectId, viewer);
  if (request.status !== MentorRequestStatus.PENDING) {
    throw new ApiError(409, "REQUEST_RESOLVED", "This mentor request has already been resolved");
  }

  await prisma.$transaction(async (tx) => {
    await tx.mentorRequest.update({
      where: { id: request.id },
      data: { status: decision, reason, respondedAt: new Date() },
    });
    const status =
      decision === "REJECTED"
        ? ProjectStatus.REJECTED
        : await recomputeProjectStatus(tx, projectId);
    if (decision === "REJECTED") {
      await tx.project.update({
        where: { id: projectId },
        data: { status, rejectionReason: reason },
      });
    }
    await createNotification(tx, {
      userId: request.project.creatorId,
      type: decision === "APPROVED" ? "MENTOR_APPROVED" : "MENTOR_REJECTED",
      title:
        decision === "APPROVED"
          ? `${request.project.title} was approved`
          : `${request.project.title} needs changes`,
      body:
        decision === "APPROVED"
          ? status === ProjectStatus.VERIFIED
            ? "Your project is verified and ready for booking."
            : "Faculty approved. The project is still waiting for team responses."
          : reason!,
      href: `/projects/${projectId}`,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: decision === "APPROVED" ? "project.approved" : "project.rejected",
        entityType: "Project",
        entityId: projectId,
        metadata: { reason },
      },
    });
    if (status === ProjectStatus.VERIFIED) {
      await notifyProjectVerified(tx, projectId, request.project.title);
    }
  });
  return get(projectId, viewer);
}

export async function getMentorEmailReview(requestId: string, token: string) {
  const action = assertMentorEmailActionToken(token, requestId);
  const request = await prisma.mentorRequest.findUnique({
    where: { id: requestId },
    include: {
      faculty: { select: { name: true, email: true } },
      project: {
        include: {
          creator: { select: { name: true, email: true } },
          members: {
            include: { user: { select: { name: true } } },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
          equipmentRequirements: {
            include: {
              equipment: { select: { name: true, category: { select: { name: true } } } },
            },
          },
          consumableRequirements: {
            include: { consumable: { select: { name: true, unit: true } } },
          },
        },
      },
    },
  });
  if (!request || request.facultyId !== action.facultyId) {
    throw new ApiError(404, "NOT_FOUND", "Faculty Mentor review request not found");
  }
  return {
    requestId: request.id,
    status: request.status,
    reason: request.reason,
    requestedAt: request.requestedAt.toISOString(),
    respondedAt: request.respondedAt?.toISOString() ?? null,
    faculty: request.faculty,
    project: {
      id: request.project.id,
      title: request.project.title,
      description: request.project.description,
      status: request.project.status,
      submittedAt: request.project.submittedAt?.toISOString() ?? null,
      leader: request.project.creator,
      members: request.project.members.map((member) => ({
        name: member.user?.name ?? member.email,
        email: member.email,
        role: member.role,
        status: member.status,
      })),
      equipment: request.project.equipmentRequirements.map((item) => ({
        name: item.equipment.name,
        category: item.equipment.category.name,
      })),
      consumables: request.project.consumableRequirements.map((item) => ({
        name: item.consumable.name,
        unit: item.consumable.unit,
      })),
    },
  };
}

export async function decideMentorEmailRequest(
  requestId: string,
  token: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | undefined,
) {
  const action = assertMentorEmailActionToken(token, requestId);
  const request = await prisma.mentorRequest.findUnique({
    where: { id: requestId },
    include: { project: true },
  });
  if (!request || request.facultyId !== action.facultyId) {
    throw new ApiError(404, "NOT_FOUND", "Faculty Mentor review request not found");
  }
  if (request.status === decision) {
    return { projectId: request.projectId, projectStatus: request.project.status, decision };
  }
  if (request.status !== MentorRequestStatus.PENDING) {
    throw new ApiError(
      409,
      "REQUEST_RESOLVED",
      "This Faculty Mentor request has already been resolved",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.mentorRequest.updateMany({
      where: { id: request.id, facultyId: action.facultyId, status: MentorRequestStatus.PENDING },
      data: { status: decision, reason, respondedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ApiError(
        409,
        "REQUEST_RESOLVED",
        "This Faculty Mentor request has already been resolved",
      );
    }
    const projectStatus =
      decision === "REJECTED"
        ? ProjectStatus.REJECTED
        : await recomputeProjectStatus(tx, request.projectId);
    if (decision === "REJECTED") {
      await tx.project.update({
        where: { id: request.projectId },
        data: { status: projectStatus, rejectionReason: reason },
      });
    }
    await createNotification(tx, {
      userId: request.project.creatorId,
      type: decision === "APPROVED" ? "MENTOR_APPROVED" : "MENTOR_REJECTED",
      title:
        decision === "APPROVED"
          ? `${request.project.title} was approved`
          : `${request.project.title} needs changes`,
      body:
        decision === "APPROVED"
          ? projectStatus === ProjectStatus.VERIFIED
            ? "Your project is verified and ready for booking."
            : "Faculty approved. The project is still waiting for team responses."
          : reason!,
      href: `/projects/${request.projectId}`,
    });
    await tx.auditLog.create({
      data: {
        actorUserId: request.facultyId,
        action:
          decision === "APPROVED" ? "project.approved_email_link" : "project.rejected_email_link",
        entityType: "Project",
        entityId: request.projectId,
        metadata: { reason, channel: "EMAIL_ACTION_LINK" },
      },
    });
    if (projectStatus === ProjectStatus.VERIFIED) {
      await notifyProjectVerified(tx, request.projectId, request.project.title);
    }
    return { projectId: request.projectId, projectStatus, decision };
  });
  return result;
}

export async function remove(id: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  assertLeader(project, viewer);
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProjectStatus.ARCHIVED },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: viewer.id,
        action: "project.archived",
        entityType: "Project",
        entityId: id,
      },
    });
  });
}

function assertLeader(project: { creatorId: string } | null, viewer: Viewer) {
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  if (project.creatorId !== viewer.id && !hasPermission(viewer.roles, "project.manage.any")) {
    throw new ApiError(403, "FORBIDDEN", "Only the Team Leader can manage this project");
  }
}

async function pendingStatus(tx: Prisma.TransactionClient, projectId: string) {
  const unresolved = await tx.projectMember.count({
    where: {
      projectId,
      role: "MEMBER",
      status: { in: [ProjectMemberStatus.PENDING, ProjectMemberStatus.DECLINED] },
    },
  });
  return unresolved > 0
    ? ProjectStatus.TEAM_ACCEPTANCE_PENDING
    : ProjectStatus.MENTOR_APPROVAL_PENDING;
}

async function recomputeProjectStatus(tx: Prisma.TransactionClient, projectId: string) {
  const [project, unresolved] = await Promise.all([
    tx.project.findUnique({ where: { id: projectId }, select: { status: true } }),
    tx.projectMember.count({
      where: {
        projectId,
        role: "MEMBER",
        status: { in: [ProjectMemberStatus.PENDING, ProjectMemberStatus.DECLINED] },
      },
    }),
  ]);
  const mentorRequest = await tx.mentorRequest.findFirst({
    where: { projectId },
    orderBy: { requestedAt: "desc" },
    select: { status: true },
  });
  const status = deriveProjectStatus(unresolved, mentorRequest?.status ?? null);
  if (project?.status !== status) {
    await tx.project.update({ where: { id: projectId }, data: { status } });
  }
  return status;
}

export function deriveProjectStatus(
  unresolvedMembers: number,
  mentorStatus: MentorRequestStatus | null,
) {
  if (mentorStatus === MentorRequestStatus.REJECTED) return ProjectStatus.REJECTED;
  if (unresolvedMembers > 0) return ProjectStatus.TEAM_ACCEPTANCE_PENDING;
  if (mentorStatus === MentorRequestStatus.APPROVED) return ProjectStatus.VERIFIED;
  return ProjectStatus.MENTOR_APPROVAL_PENDING;
}

async function createNotification(
  tx: Prisma.TransactionClient,
  data: { userId: string; type: string; title: string; body: string; href: string },
) {
  return tx.notification.create({
    data: {
      ...data,
      deliveries: {
        create: [
          {
            channel: NotificationChannel.EMAIL,
            status: DeliveryStatus.PENDING,
          },
        ],
      },
    },
  });
}

async function notifyProjectVerified(
  tx: Prisma.TransactionClient,
  projectId: string,
  title: string,
) {
  const members = await tx.projectMember.findMany({
    where: { projectId, status: ProjectMemberStatus.ACCEPTED, userId: { not: null } },
    select: { userId: true },
  });
  for (const member of members) {
    await createNotification(tx, {
      userId: member.userId!,
      type: "PROJECT_VERIFIED",
      title: `${title} is verified`,
      body: "The Team Leader can now continue to slot booking.",
      href: `/projects/${projectId}`,
    });
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
