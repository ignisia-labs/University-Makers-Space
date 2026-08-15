import crypto from "node:crypto";
import { MentorRequestStatus, Prisma, ProjectStatus, UserRole } from "@prisma/client";
import { hasPermission } from "../../config/permissions.js";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";
import { meta } from "../../utils/pagination.js";
import { projectDto } from "../../utils/serializers.js";

const sortFields = new Set(["title", "status", "createdAt", "updatedAt"]);
type Viewer = NonNullable<Express.Request["user"]>;

function scopeFor(viewer: Viewer): Prisma.ProjectWhereInput {
  if (hasPermission(viewer.roles, "project.read.any")) return {};
  if (hasPermission(viewer.roles, "project.read.mentored")) {
    return {
      OR: [{ currentMentorId: viewer.id }, { mentorRequests: { some: { facultyId: viewer.id } } }],
    };
  }
  return {
    OR: [
      { creatorId: viewer.id },
      { members: { some: { userId: viewer.id, status: "ACCEPTED" } } },
    ],
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
  };
  const [total, rows] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { [sortBy]: query.order ?? "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { data: rows.map(projectDto), meta: meta(page, limit, total) };
}

export async function get(id: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null, AND: [scopeFor(viewer)] },
    include: {
      members: true,
      mentorRequests: true,
      equipmentRequirements: true,
      consumableRequirements: true,
    },
  });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  return project;
}

export async function create(
  creatorId: string,
  data: {
    labId: string;
    title: string;
    description: string;
    domain?: string | null;
    tags: string[];
  },
) {
  const [creator, lab] = await Promise.all([
    prisma.user.findUnique({ where: { id: creatorId } }),
    prisma.lab.findFirst({ where: { id: data.labId, isActive: true } }),
  ]);
  if (!creator?.profileComplete) {
    throw new ApiError(
      409,
      "PROFILE_INCOMPLETE",
      "Complete student onboarding before creating a project",
    );
  }
  if (!lab) throw new ApiError(404, "NOT_FOUND", "Lab not found");
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({ data: { ...data, creatorId } });
    await tx.projectMember.create({
      data: {
        projectId: created.id,
        userId: creatorId,
        email: creator.email,
        role: "LEADER",
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: creatorId,
        action: "project.created",
        entityType: "Project",
        entityId: created.id,
      },
    });
    return created;
  });
  return projectDto(project);
}

export async function update(id: string, data: Prisma.ProjectUncheckedUpdateInput, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  const canManage = hasPermission(viewer.roles, "project.manage.any");
  if (project.creatorId !== viewer.id && !canManage) {
    throw new ApiError(403, "FORBIDDEN", "Only the project leader can update this project");
  }
  if (
    !canManage &&
    project.status !== ProjectStatus.DRAFT &&
    project.status !== ProjectStatus.REJECTED
  ) {
    throw new ApiError(409, "PROJECT_LOCKED", "This project cannot be edited in its current state");
  }
  return projectDto(await prisma.project.update({ where: { id }, data }));
}

export async function inviteMember(projectId: string, email: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  if (project.creatorId !== viewer.id && !hasPermission(viewer.roles, "project.manage.any")) {
    throw new ApiError(403, "FORBIDDEN", "Only the project leader can invite members");
  }
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const user = await prisma.user.findUnique({ where: { email } });
  const member = await prisma.projectMember.upsert({
    where: { projectId_email: { projectId, email } },
    update: {
      userId: user?.id,
      status: "INVITED",
      invitationTokenHash: hashToken(rawToken),
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      removedAt: null,
    },
    create: {
      projectId,
      userId: user?.id,
      email,
      invitationTokenHash: hashToken(rawToken),
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.TEAM_ACCEPTANCE_PENDING },
  });
  return { member, invitationToken: rawToken };
}

export async function requestMentor(projectId: string, facultyId: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { members: true },
  });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  if (project.creatorId !== viewer.id && !hasPermission(viewer.roles, "project.manage.any")) {
    throw new ApiError(403, "FORBIDDEN", "Only the project leader can select a mentor");
  }
  if (project.members.some((member) => member.status === "INVITED")) {
    throw new ApiError(
      409,
      "TEAM_ACCEPTANCE_PENDING",
      "All team invitations must be resolved first",
    );
  }
  const faculty = await prisma.user.findFirst({
    where: {
      id: facultyId,
      roles: { has: UserRole.FACULTY_MENTOR },
      isActive: true,
      deletedAt: null,
    },
  });
  if (!faculty)
    throw new ApiError(400, "INVALID_MENTOR", "Selected user is not an active Faculty Mentor");
  return prisma.$transaction(async (tx) => {
    await tx.mentorRequest.updateMany({
      where: { projectId, status: MentorRequestStatus.PENDING },
      data: { status: MentorRequestStatus.CANCELLED, respondedAt: new Date() },
    });
    const request = await tx.mentorRequest.create({ data: { projectId, facultyId } });
    await tx.project.update({
      where: { id: projectId },
      data: { currentMentorId: facultyId, status: ProjectStatus.MENTOR_APPROVAL_PENDING },
    });
    return request;
  });
}

export async function decideMentorRequest(
  projectId: string,
  decision: "APPROVED" | "REJECTED",
  reason: string | undefined,
  viewer: Viewer,
) {
  const request = await prisma.mentorRequest.findFirst({
    where: { projectId, facultyId: viewer.id, status: MentorRequestStatus.PENDING },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Pending mentor request not found");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.mentorRequest.update({
      where: { id: request.id },
      data: { status: decision, reason, respondedAt: new Date() },
    });
    await tx.project.update({
      where: { id: projectId },
      data: {
        status: decision === "APPROVED" ? ProjectStatus.VERIFIED : ProjectStatus.REJECTED,
        rejectionReason: decision === "REJECTED" ? reason : null,
      },
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
    return updated;
  });
}

export async function remove(id: string, viewer: Viewer) {
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
  if (project.creatorId !== viewer.id && !hasPermission(viewer.roles, "project.manage.any")) {
    throw new ApiError(403, "FORBIDDEN", "Only the project leader can archive this project");
  }
  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date(), status: ProjectStatus.ARCHIVED },
  });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
