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
  res.cookie(LOGIN_CSRF_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
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
      ? await tx.user.update({ where: { id: existing.id }, data: identityData })
      : await tx.user.create({ data: identityData });

    if (provision && !provision.claimedById) {
      await tx.userProvisioning.update({
        where: { id: provision.id },
        data: { claimedById: nextUser.id, claimedAt: new Date() },
      });
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
    throw new ApiError(401, "UNAUTHENTICATED", "Refresh token is invalid or expired");
  }
  if (payload.type !== "refresh") throw new ApiError(401, "UNAUTHENTICATED", "Invalid token");

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

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/v1/auth/refresh",
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    path: "/api/v1/auth/refresh",
    sameSite: "strict",
    secure: isProduction,
  });
}

function clearLoginCsrf(res: Response) {
  res.clearCookie(LOGIN_CSRF_COOKIE, {
    path: "/api/v1/auth/google",
    sameSite: "strict",
    secure: isProduction,
  });
}

export const authCookieNames = {
  refresh: REFRESH_COOKIE,
  loginCsrf: LOGIN_CSRF_COOKIE,
} as const;
