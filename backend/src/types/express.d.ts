import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: Pick<User, "id" | "email" | "roles" | "tokenVersion" | "isActive">;
    }
  }
}
