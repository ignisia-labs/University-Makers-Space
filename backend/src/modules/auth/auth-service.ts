import crypto from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env, isProduction } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { verifyMitWpuCredential } from "./google-identity.js";

const REFRESH_COOKIE = "ums_refresh_token";
const LOGIN_CSRF_COOKIE = "ums_login_csrf";
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

type AccessPayload = { sub: string; sid: string; type: "access" };
type RefreshPayload = { sub: string; sid: string; type: "refresh" };
type RequestMetadata = Pick<Request, "ip"> & {
  userAgent?: string;
  requestId?: string;
};

export function createLoginCsrf(res: Response) {
  const token = crypto.randomBytes(32).toString("base64url");
  // Same reasoning as the refresh cookie: a cross-site deployment never gets a
  // same-site cookie back, so the sign-in handshake would fail its own CSRF
  // check on every attempt.
  res.cookie(LOGIN_CSRF_COOKIE, token, {
    httpOnly: true,
    secure: isProduction || env.CROSS_SITE_COOKIES,
    sameSite: env.CROSS_SITE_COOKIES ? "none" : "strict",
    path: "/api/v1/auth/google",
    maxAge: 10 * 60 * 1000,
  });
  return token;
}

export async function googleSignIn(
  credential: string,
  csrfToken: string,
  cookieToken: string | undefined,
  metadata: RequestMetadata,
  res: Response,
) {
  assertMatchingCsrf(csrfToken, cookieToken);
  const identity = await verifyMitWpuCredential(credential);

  const user = await prisma.$transaction(async (tx) => {
    const provision = await tx.userProvisioning.findUnique({ where: { email: identity.email } });
    if (provision && !provision.isActive) {
      throw new ApiError(403, "ACCOUNT_DISABLED", "This institutional account is disabled");
    }

    const existing = await tx.user.findFirst({
      where: {
        OR: [{ googleSubject: identity.subject }, { email: identity.email }],
        deletedAt: null,
      },
    });
    if (existing && !existing.isActive) {
      throw new ApiError(403, "ACCOUNT_DISABLED", "This institutional account is disabled");
    }
    if (existing?.googleSubject && existing.googleSubject !== identity.subject) {
      throw new ApiError(409, "IDENTITY_CONFLICT", "This email is linked to another identity");
    }

    const roles = provision?.roles ?? existing?.roles ?? [UserRole.STUDENT];
    const profileComplete = roles.includes(UserRole.STUDENT)
      ? (existing?.profileComplete ?? false)
      : true;
    const identityData = {
      googleSubject: identity.subject,
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.avatarUrl,
      roles,
      profileComplete,
      lastLoginAt: new Date(),
    };
    const nextUser = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: identityData,
          include: {
            studentProfile: { include: { department: true, programme: true } },
          },
        })
      : await tx.user.create({
          data: identityData,
          include: {
            studentProfile: { include: { department: true, programme: true } },
          },
        });

    if (provision && !provision.claimedById) {
      await tx.userProvisioning.update({
        where: { id: provision.id },
        data: { claimedById: nextUser.id, claimedAt: new Date() },
      });
    }
    if (nextUser.roles.includes(UserRole.STUDENT)) {
      const pendingInvitations = await tx.projectMember.findMany({
        where: {
          email: nextUser.email,
          userId: null,
          status: "PENDING",
          removedAt: null,
        },
        include: {
          project: { select: { id: true, title: true, creator: { select: { name: true } } } },
        },
      });
      if (pendingInvitations.length) {
        await tx.projectMember.updateMany({
          where: { id: { in: pendingInvitations.map((invitation) => invitation.id) } },
          data: { userId: nextUser.id },
        });
        await tx.notification.createMany({
          data: pendingInvitations.map((invitation) => ({
            userId: nextUser.id,
            type: "PROJECT_INVITATION",
            title: `Invitation to join ${invitation.project.title}`,
            body: `${invitation.project.creator.name} invited you to join their MakerSpace project.`,
            href: `/invitations/${invitation.project.id}`,
          })),
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorUserId: nextUser.id,
        action: "auth.google_sign_in",
        entityType: "User",
        entityId: nextUser.id,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        requestId: metadata.requestId,
      },
    });
    return nextUser;
  });

  const accessToken = await createSession(user.id, metadata, res);
  clearLoginCsrf(res);
  return { user, accessToken };
}

export async function refresh(rawToken: string | undefined, res: Response) {
  if (!rawToken) throw new ApiError(401, "UNAUTHENTICATED", "Refresh token is required");
  let payload: RefreshPayload;
  try {
    payload = jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as RefreshPayload;
  } catch {
    // The cookie is HttpOnly, so the browser will keep replaying a dead token
    // on every page load unless the server explicitly retires it here.
    clearRefreshCookie(res);
    throw new ApiError(401, "UNAUTHENTICATED", "Refresh token is invalid or expired");
  }
  if (payload.type !== "refresh") {
    clearRefreshCookie(res);
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid token");
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.user.isActive ||
    session.user.deletedAt
  ) {
    // Revoked, expired, suspended or deleted: the credential can never work
    // again, so drop it rather than letting the browser resend it forever.
    clearRefreshCookie(res);
    throw new ApiError(401, "UNAUTHENTICATED", "Session is no longer valid");
  }

  const currentHash = hashToken(rawToken);
  if (!safeEqual(currentHash, session.refreshTokenHash)) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    clearRefreshCookie(res);
    throw new ApiError(401, "REFRESH_TOKEN_REUSED", "Session was revoked for security");
  }

  const nextRefreshToken = signRefreshToken(session.userId, session.id);
  const rotated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: currentHash, revokedAt: null },
    data: { refreshTokenHash: hashToken(nextRefreshToken), lastUsedAt: new Date() },
  });
  if (rotated.count !== 1) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    throw new ApiError(401, "REFRESH_TOKEN_REUSED", "Session was revoked for security");
  }

  setRefreshCookie(res, nextRefreshToken);
  return signAccessToken(session.userId, session.id);
}

export async function logout(userId: string, sessionId: string, res: Response) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  clearRefreshCookie(res);
}

export function getCurrentUser(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      studentProfile: {
        include: { department: true, programme: true },
      },
    },
  });
}

export async function completeOnboarding(
  userId: string,
  input: {
    fullName: string;
    prn: string;
    departmentId: string;
    programmeId: string;
    academicYear: number;
    division?: string;
    phone?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }
    if (!user.roles.includes(UserRole.STUDENT)) {
      throw new ApiError(403, "STUDENT_PROFILE_NOT_REQUIRED", "This account is not a student");
    }
    const [programme, academicYear] = await Promise.all([
      tx.programme.findFirst({
        where: {
          id: input.programmeId,
          departmentId: input.departmentId,
          isActive: true,
          department: { isActive: true },
        },
      }),
      tx.academicYearOption.findFirst({
        where: { value: input.academicYear, isActive: true },
      }),
    ]);
    if (!programme) {
      throw new ApiError(
        400,
        "INVALID_ACADEMIC_SELECTION",
        "Programme does not belong to the selected active department",
      );
    }
    if (!academicYear) {
      throw new ApiError(400, "INVALID_ACADEMIC_YEAR", "Academic year is not active");
    }
    const profile = await tx.studentProfile.upsert({
      where: { userId },
      update: {
        prn: input.prn,
        departmentId: input.departmentId,
        programmeId: input.programmeId,
        academicYear: input.academicYear,
        division: input.division,
        phone: input.phone,
      },
      create: {
        userId,
        prn: input.prn,
        departmentId: input.departmentId,
        programmeId: input.programmeId,
        academicYear: input.academicYear,
        division: input.division,
        phone: input.phone,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { name: input.fullName, profileComplete: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: userId,
        action: "profile.student_completed",
        entityType: "StudentProfile",
        entityId: userId,
      },
    });
    return profile;
  });
}

async function createSession(userId: string, metadata: RequestMetadata, res: Response) {
  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken(userId, sessionId);
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      ipAddress: metadata.ip,
      userAgent: metadata.userAgent,
    },
  });
  setRefreshCookie(res, refreshToken);
  return signAccessToken(userId, sessionId);
}

function signAccessToken(userId: string, sessionId: string) {
  const payload: AccessPayload = { sub: userId, sid: sessionId, type: "access" };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
}

function signRefreshToken(userId: string, sessionId: string) {
  const payload: RefreshPayload = { sub: userId, sid: sessionId, type: "refresh" };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TTL_SECONDS,
    jwtid: crypto.randomUUID(),
  });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function assertMatchingCsrf(bodyToken: string, cookieToken: string | undefined) {
  if (!cookieToken || !safeEqual(bodyToken, cookieToken)) {
    throw new ApiError(403, "LOGIN_CSRF_MISMATCH", "Sign-in request could not be verified");
  }
}

/**
 * How the refresh cookie is scoped.
 *
 * Same-site by default, which is the safest thing a session cookie can be. When
 * the app and API are deployed to different hosts the browser will not send a
 * same-site cookie at all — sign-in appears to work and the next request is
 * anonymous — so a cross-site deployment must opt in, and SameSite=None is only
 * honoured on a secure connection.
 */
function refreshCookieOptions() {
  const crossSite = env.CROSS_SITE_COOKIES;
  return {
    httpOnly: true,
    secure: isProduction || crossSite,
    sameSite: crossSite ? ("none" as const) : ("strict" as const),
    path: "/api/v1/auth/refresh",
  };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(),
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  // The attributes must match the ones it was set with, or the browser keeps
  // the cookie and a signed-out session quietly resurrects itself.
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

function clearLoginCsrf(res: Response) {
  res.clearCookie(LOGIN_CSRF_COOKIE, {
    path: "/api/v1/auth/google",
    sameSite: env.CROSS_SITE_COOKIES ? "none" : "strict",
    secure: isProduction || env.CROSS_SITE_COOKIES,
  });
}

export const authCookieNames = {
  refresh: REFRESH_COOKIE,
  loginCsrf: LOGIN_CSRF_COOKIE,
} as const;
