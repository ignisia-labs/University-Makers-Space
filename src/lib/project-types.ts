export type ProjectStatus =
  | "DRAFT"
  | "TEAM_ACCEPTANCE_PENDING"
  | "MENTOR_APPROVAL_PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "ARCHIVED";

export type Person = { id: string; name: string; email: string };

export type DirectoryUser = Person & {
  department: { id: string; code: string; name: string } | null;
};

export type ProjectSummary = {
  id: string;
  labId: string;
  title: string;
  description: string;
  status: ProjectStatus;
  creatorId: string;
  leader: Person;
  mentor: Person | null;
  memberCount: number;
  pendingMemberCount: number;
  declinedMemberCount: number;
  mentorRequestStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | null;
  nextBooking: { id: string; startsAt: string; endsAt: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  id: string;
  userId: string | null;
  email: string;
  role: "LEADER" | "MEMBER";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  name: string;
  department: { id: string; code: string; name: string } | null;
  invitationExpiresAt: string | null;
  invitationEmailStatus: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | null;
  respondedAt: string | null;
};

export type ProjectDetail = {
  id: string;
  labId: string;
  title: string;
  description: string;
  domain: string | null;
  tags: string[];
  status: ProjectStatus;
  rejectionReason: string | null;
  creatorId: string;
  leader: Person & { studentProfile?: unknown };
  mentor: Person | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  mentorRequests: Array<{
    id: string;
    faculty: Person;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    reason: string | null;
    requestedAt: string;
    respondedAt: string | null;
  }>;
  equipment: Array<{ id: string; name: string; category: string; status: string }>;
  consumables: Array<{ id: string; name: string; category: string; unit: string }>;
  bookings: Array<{ id: string; status: string; startsAt: string; endsAt: string }>;
};

export type LabReference = { id: string; code: string; name: string; description: string | null };

export type ProjectResourceCatalog = {
  equipment: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    category: { id: string; name: string };
  }>;
  consumables: Array<{
    id: string;
    name: string;
    unit: string;
    description: string | null;
    category: { id: string; name: string };
  }>;
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  TEAM_ACCEPTANCE_PENDING: "Waiting for team responses",
  MENTOR_APPROVAL_PENDING: "Waiting for Faculty Mentor approval",
  VERIFIED: "Verified",
  REJECTED: "Changes requested",
  ARCHIVED: "Archived",
};

export function invitationStatusLabel(status: ProjectMember["status"]) {
  return {
    PENDING: "Invitation pending",
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    CANCELLED: "Invitation cancelled",
    EXPIRED: "Invitation expired",
  }[status];
}
