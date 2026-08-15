import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { env, isProduction } from "../../config/env.js";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";

type RefreshPayload = { sub: string; tokenVersion: number; type: "refresh" };

export async function register(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  return prisma.user.create({ data: { name: input.name, email: input.email, passwordHash } });
}

export async function login(email: string, password: string, res: Response) {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  setRefreshCookie(res, refreshToken(user.id, user.tokenVersion));
  return { user, accessToken: accessToken(user.id, user.tokenVersion) };
}

export async function refresh(rawToken: string | undefined, res: Response) {
  if (!rawToken) throw new ApiError(401, "UNAUTHENTICATED", "Refresh token is required");
  const payload = jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as RefreshPayload;
  if (payload.type !== "refresh") throw new ApiError(401, "UNAUTHENTICATED", "Invalid token");
  const user = await prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null } });
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "UNAUTHENTICATED", "Session is no longer valid");
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { tokenVersion: { increment: 1 } },
  });
  setRefreshCookie(res, refreshToken(updated.id, updated.tokenVersion));
  return accessToken(updated.id, updated.tokenVersion);
}

export async function logout(userId: string, res: Response) {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  clearRefreshCookie(res);
}

export function accessToken(userId: string, tokenVersion: number) {
  return jwt.sign({ sub: userId, tokenVersion, type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
}

function refreshToken(userId: string, tokenVersion: number) {
  return jwt.sign({ sub: userId, tokenVersion, type: "refresh" }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/v1/auth/refresh",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", { path: "/api/v1/auth/refresh", sameSite: "strict", secure: isProduction });
}
