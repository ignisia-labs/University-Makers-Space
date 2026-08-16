import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  defaultProfile,
  equipmentCatalogue,
  initialConfig,
  initialConsumables,
  initialNotifications,
  initialProjects,
  initialReservations,
  initialUsers,
  initialVisits,
  directoryStudents,
  type AppRole,
  type AppUser,
  type AuditEvent,
  type Equipment,
  type LabConfig,
  type Consumable,
  type Notification,
  type Project,
  type Reservation,
  type StudentProfile,
  type Visit,
} from "./makerspace-data";

type State = {
  profile: StudentProfile;
  role: AppRole;
  authenticated: boolean;
  onboarded: boolean;
  projects: Project[];
  reservations: Reservation[];
  visits: Visit[];
  equipment: Equipment[];
  consumables: Consumable[];
  notifications: Notification[];
  users: AppUser[];
  auditLogs: AuditEvent[];
  equipmentCategories: string[];
  config: LabConfig;
  completeOnboarding: (p: StudentProfile) => void;
  beginPrototypeSession: (role?: AppRole) => void;
  signOut: () => void;
  addProject: (p: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addReservation: (r: Omit<Reservation, "id">) => void;
  cancelReservation: (id: string, reason: string) => void;
  markReservationNoShow: (id: string, reason: string) => void;
  setBookingAttendance: (
    id: string,
    participantIds: string[],
    status: "Expected" | "Entered" | "Exited",
  ) => void;
  addBookingParticipant: (bookingId: string, participantId: string) => void;
  addVisit: (v: Omit<Visit, "id">) => void;
  updateVisit: (id: string, patch: Partial<Visit>) => void;
  acceptProjectInvitation: (id: string, s: StudentProfile) => void;
  updateEquipment: (id: string, patch: Partial<Equipment>) => void;
  addEquipment: (e: Omit<Equipment, "id">) => void;
  removeEquipment: (id: string) => void;
  addEquipmentCategory: (category: string) => void;
  addConsumable: (item: Omit<Consumable, "id">) => void;
  updateConsumable: (id: string, patch: Partial<Consumable>) => void;
  removeConsumable: (id: string) => void;
  saveConfig: (c: LabConfig) => void;
  updateUserRole: (id: string, role: AppRole) => void;
  provisionUser: (user: Omit<AppUser, "id">) => void;
  updateUserActive: (id: string, active: boolean) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
};
const Ctx = createContext<State | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

export function MakerSpaceProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(defaultProfile);
  const [role, setRole] = useState<AppRole>("Student");
  const [authenticated, setAuthenticated] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [reservations, setReservations] = useState(initialReservations);
  const [visits, setVisits] = useState(initialVisits);
  const [equipment, setEquipment] = useState(equipmentCatalogue);
  const [consumables, setConsumables] = useState(initialConsumables);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [users, setUsers] = useState(initialUsers);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [equipmentCategories, setEquipmentCategories] = useState(() => [
    ...new Set(equipmentCatalogue.map((item) => item.category)),
    "Sensors & Actuators",
  ]);
  const [config, setConfig] = useState(initialConfig);
  const actor =
    users.find((user) => user.role === role && user.active) ??
    users.find((user) => user.email === profile.email);
  const audit = (
    action: string,
    entity: string,
    details: Partial<Omit<AuditEvent, "id" | "action" | "entity" | "timestamp">> = {},
  ) =>
    setAuditLogs((prev) => [
      {
        id: uid(),
        action,
        entity,
        actorId: actor?.id ?? "prototype-user",
        actorName: actor?.name ?? profile.fullName,
        actorRole: role,
        entityType: details.entityType ?? "Record",
        timestamp: new Date().toLocaleString("en-IN"),
        ...details,
      },
      ...prev,
    ]);
  const value = useMemo<State>(
    () => ({
      profile,
      role,
      authenticated,
      onboarded,
      projects,
      reservations,
      visits,
      equipment,
      consumables,
      notifications,
      users,
      auditLogs,
      equipmentCategories,
      config,
      completeOnboarding(p) {
        setProfile(p);
        setOnboarded(true);
      },
      beginPrototypeSession(nextRole = "Student") {
        setRole(nextRole);
        setAuthenticated(true);
      },
      signOut() {
        setAuthenticated(false);
        setRole("Student");
        setOnboarded(false);
      },
      addProject(p) {
        setProjects((prev) => [
          { ...p, id: uid(), createdAt: new Date().toLocaleDateString("en-IN") },
          ...prev,
        ]);
        audit("Created project", p.name);
      },
      updateProject(id, patch) {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
        audit("Updated project", id);
      },
      addReservation(r) {
        setReservations((prev) => [{ ...r, id: uid() }, ...prev]);
        audit("Created booking", r.projectName);
      },
      cancelReservation(id, reason) {
        const timestamp = new Date().toLocaleString("en-IN");
        setReservations((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "Cancelled",
                  cancelledReason: reason,
                  cancelledAt: timestamp,
                  handledBy: actor?.name ?? profile.fullName,
                }
              : r,
          ),
        );
        audit("Cancelled booking", id, { entityType: "Booking", reason });
      },
      markReservationNoShow(id, reason) {
        const timestamp = new Date().toLocaleString("en-IN");
        setReservations((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "No Show",
                  noShowReason: reason,
                  noShowAt: timestamp,
                  handledBy: actor?.name ?? profile.fullName,
                }
              : r,
          ),
        );
        audit("Marked booking no-show", id, { entityType: "Booking", reason });
      },
      setBookingAttendance(id, participantIds, status) {
        const timestamp = new Date().toLocaleString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short",
        });
        const markedBy = actor?.name ?? profile.fullName;
        setReservations((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  attendance: {
                    ...r.attendance,
                    ...Object.fromEntries(
                      participantIds.map((participantId) => {
                        const current = r.attendance?.[participantId];
                        return [
                          participantId,
                          status === "Entered"
                            ? { status, enteredAt: timestamp, markedBy }
                            : status === "Exited"
                              ? {
                                  status,
                                  ...(current?.enteredAt ? { enteredAt: current.enteredAt } : {}),
                                  exitedAt: timestamp,
                                  markedBy,
                                }
                              : { status, markedBy },
                        ];
                      }),
                    ),
                  },
                }
              : r,
          ),
        );
        audit(`Marked attendees ${status.toLowerCase()}`, id, {
          entityType: "Attendance",
          metadata: { participantCount: String(participantIds.length) },
        });
      },
      addBookingParticipant(bookingId, participantId) {
        const student = directoryStudents.find((item) => item.id === participantId);
        if (!student) return;
        setReservations((prev) =>
          prev.map((reservation) =>
            reservation.id === bookingId && !reservation.participantIds.includes(participantId)
              ? {
                  ...reservation,
                  participantIds: [...reservation.participantIds, participantId],
                  attendees: reservation.attendees + 1,
                  attendance: {
                    ...reservation.attendance,
                    [participantId]: { status: "Expected" },
                  },
                }
              : reservation,
          ),
        );
        audit("Added attendee through fallback search", bookingId, {
          entityType: "Attendance",
          metadata: { student: student.name },
        });
      },
      addVisit(v) {
        setVisits((prev) => [{ ...v, id: uid() }, ...prev]);
        audit("Requested visit", v.title);
      },
      updateVisit(id, patch) {
        setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
        audit("Updated attendance", id);
      },
      acceptProjectInvitation(id, student) {
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== id || !p.invitedEmails.includes(student.email)) return p;
            const invitations = p.invitedEmails.filter((email) => email !== student.email);
            const updatedTeamInvitations = p.teamInvitations?.map((invitation) =>
              invitation.email.toLowerCase() === student.email.toLowerCase()
                ? { ...invitation, status: "Accepted" as const }
                : invitation,
            );
            return {
              ...p,
              invitedEmails: invitations,
              ...(updatedTeamInvitations ? { teamInvitations: updatedTeamInvitations } : {}),
              members: [
                ...p.members,
                {
                  id: uid(),
                  name: student.fullName,
                  prn: student.prn,
                  department: student.department,
                  email: student.email,
                },
              ],
              status: invitations.length === 0 ? "Mentor Approval Pending" : p.status,
            };
          }),
        );
      },
      updateEquipment(id, patch) {
        const previous = equipment.find((item) => item.id === id);
        setEquipment((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toLocaleDateString("en-IN") } : e,
          ),
        );
        audit("Updated equipment", id, {
          entityType: "Equipment",
          ...(patch.availabilityReason ? { reason: patch.availabilityReason } : {}),
          ...(previous?.status ? { previousValue: previous.status } : {}),
          ...(patch.status ? { newValue: patch.status } : {}),
        });
      },
      addEquipment(e) {
        setEquipment((prev) => [{ ...e, id: uid() }, ...prev]);
        audit("Added equipment", e.name);
      },
      removeEquipment(id) {
        setEquipment((prev) => prev.filter((e) => e.id !== id));
        audit("Removed equipment", id, { entityType: "Equipment" });
      },
      addEquipmentCategory(category) {
        const normalized = category.trim();
        if (!normalized) return;
        setEquipmentCategories((prev) =>
          prev.some((item) => item.toLowerCase() === normalized.toLowerCase())
            ? prev
            : [...prev, normalized],
        );
        audit("Added equipment category", normalized, { entityType: "Equipment Category" });
      },
      addConsumable(item) {
        setConsumables((prev) => [{ ...item, id: uid() }, ...prev]);
        audit("Added consumable", item.name);
      },
      updateConsumable(id, patch) {
        setConsumables((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
        audit("Updated consumable", id);
      },
      removeConsumable(id) {
        setConsumables((prev) => prev.filter((item) => item.id !== id));
        audit("Removed consumable", id);
      },
      saveConfig(c) {
        const previous = JSON.stringify(config);
        const next = JSON.stringify(c);
        setConfig(c);
        if (previous === next) {
          audit("Reviewed lab configuration", c.labName, {
            entityType: "Lab Configuration",
            metadata: { result: "No configuration values changed" },
          });
          return;
        }
        audit("Updated lab configuration", c.labName, {
          entityType: "Lab Configuration",
          previousValue: previous,
          newValue: next,
        });
      },
      updateUserRole(id, nextRole) {
        const previousRole = users.find((user) => user.id === id)?.role;
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: nextRole } : u)));
        audit("Changed user role", id, {
          entityType: "User",
          ...(previousRole ? { previousValue: previousRole } : {}),
          newValue: nextRole,
          metadata: { sessionAction: "Re-evaluate on next request" },
        });
      },
      provisionUser(user) {
        setUsers((prev) => [
          { ...user, id: uid(), provisionedAt: new Date().toLocaleString("en-IN") },
          ...prev,
        ]);
        audit("Pre-provisioned user", user.email, {
          entityType: "User",
          newValue: user.role,
        });
      },
      updateUserActive(id, active) {
        setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, active } : user)));
        audit(active ? "Activated user" : "Disabled user", id, {
          entityType: "User",
          newValue: active ? "Active" : "Inactive",
          metadata: { sessionAction: "Invalidate active sessions" },
        });
      },
      markNotificationRead(id) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      },
      markAllNotificationsRead() {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      },
    }),
    [
      profile,
      role,
      authenticated,
      onboarded,
      projects,
      reservations,
      visits,
      equipment,
      consumables,
      notifications,
      users,
      auditLogs,
      equipmentCategories,
      config,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useMakerSpace() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useMakerSpace must be used inside MakerSpaceProvider");
  return value;
}
