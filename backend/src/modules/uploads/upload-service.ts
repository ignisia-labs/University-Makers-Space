import crypto from "node:crypto";
import type { Express } from "express";
import { cloudinary } from "../../config/cloudinary.js";
import { prisma } from "../../config/db.js";
import { ApiError } from "../../utils/api-error.js";

const allowed = new Map([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["application/pdf", [".pdf"]],
]);

export async function upload(ownerId: string, file: Express.Multer.File | undefined) {
  if (!file) throw new ApiError(400, "VALIDATION_ERROR", "File is required");
  const extensions = allowed.get(file.mimetype);
  const ext = file.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (!extensions || !ext || !extensions.includes(ext)) {
    throw new ApiError(400, "INVALID_FILE_TYPE", "Unsupported file type");
  }
  if (file.mimetype.startsWith("image/") && file.size > 5 * 1024 * 1024) {
    throw new ApiError(400, "FILE_TOO_LARGE", "Image file must be 5MB or smaller");
  }
  const publicId = `ums/${crypto.randomUUID()}`;
  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "auto" }, (err, value) => {
      if (err || !value) reject(err);
      else resolve(value);
    });
    stream.end(file.buffer);
  });
  return prisma.upload.create({
    data: { ownerId, url: result.secure_url, publicId: result.public_id, mimeType: file.mimetype, bytes: file.size },
    select: { id: true, url: true, mimeType: true, bytes: true, createdAt: true },
  });
}

export async function remove(ownerId: string, id: string) {
  const upload = await prisma.upload.findFirst({ where: { id, ownerId, deletedAt: null } });
  if (!upload) throw new ApiError(404, "NOT_FOUND", "Upload not found");
  await cloudinary.uploader.destroy(upload.publicId);
  await prisma.upload.update({ where: { id }, data: { deletedAt: new Date() } });
}
