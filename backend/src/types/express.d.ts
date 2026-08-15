import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
        roles: UserRole[];
        profileComplete: boolean;
        isActive: boolean;
        sessionId: string;
      };
    }
  }
}
