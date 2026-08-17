import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  defaultProfile,
  equipmentCatalogue,
  initialConfig,
  initialBookingSlots,
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
  type BookingSlot,
  type Equipment,
  type EquipmentUpload,
  type LabConfig,
  type Consumable,
  type Notification,
  type Project,
  type Reservation,
  type StudentProfile,
  type Visit,
} from "./makerspace-data";

export type NotificationPreferences = {
  projectActivity: boolean;
  bookingUpdates: boolean;
  equipmentUpdates: boolean;
  systemAnnouncements: boolean;
  emailBookingReminders: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  projectActivity: true,
  bookingUpdates: true,
  equipmentUpdates: true,
  systemAnnouncements: true,
  emailBookingReminders: true,
};

type State = {
  profile: StudentProfile;
  role: AppRole;
  authenticated: boolean;
  onboarded: boolean;
  /** False until the persisted session has been read, so guards don't redirect too early. */
  hydrated: boolean;
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
  slots: BookingSlot[];
  uploads: EquipmentUpload[];
  notificationPreferences: NotificationPreferences;
  addUpload: (upload: Omit<EquipmentUpload, "id" | "uploadedAt">) => void;
  removeUpload: (id: string) => void;
  completeOnboarding: (p: StudentProfile) => void;
  beginPrototypeSession: (role?: AppRole) => void;
  beginNewStudentSession: () => void;
  signOut: () => void;
  addProject: (p: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  verifyProject: (id: string) => void;
  addReservation: (r: Omit<Reservation, "id">) => void;
  cancelReservation: (id: string, reason: string) => void;
  completeReservation: (id: string) => void;
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
  addSlot: (slot: Omit<BookingSlot, "id">) => void;
  updateSlot: (id: string, patch: Partial<BookingSlot>) => void;
  updateUserRole: (id: string, role: AppRole) => void;
  provisionUser: (user: Omit<AppUser, "id">) => void;
  updateUserActive: (id: string, active: boolean) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateNotificationPreferences: (patch: Partial<NotificationPreferences>) => void;
};
const Ctx = createContext<State | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);
// "isha.kulkarni@mitwpu.edu.in" → "Isha Kulkarni"
const nameFromEmail = (email: string) =>
  email
    .split("@")[0]!
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
const STORAGE_KEY = "mitwpu-makerspace-mock-state-v3";

type SharedSnapshot = Pick<
  State,
  | "profile"
  | "authenticated"
  | "onboarded"
  | "projects"
  | "reservations"
  | "visits"
  | "equipment"
  | "consumables"
  | "notifications"
  | "users"
  | "auditLogs"
  | "equipmentCategories"
  | "config"
  | "slots"
  | "uploads"
  | "notificationPreferences"
>;

function readSnapshot(value: string | null): SharedSnapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as SharedSnapshot;
  } catch {
    return null;
  }
}

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
    ...new Set([...equipmentCatalogue.map((item) => item.category), "Sensors & Actuators"]),
  ]);
  const [config, setConfig] = useState(initialConfig);
  const [slots, setSlots] = useState(initialBookingSlots);
  const [uploads, setUploads] = useState<EquipmentUpload[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    defaultNotificationPreferences,
  );
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const skipInitialPersist = useRef(true);
  const lastSerialized = useRef("");

  useEffect(() => {
    const applySnapshot = (snapshot: SharedSnapshot) => {
      setProfile(snapshot.profile ?? defaultProfile);
      setAuthenticated(snapshot.authenticated ?? false);
      setOnboarded(snapshot.onboarded ?? false);
      setProjects(snapshot.projects ?? initialProjects);
      setReservations(snapshot.reservations ?? initialReservations);
      setVisits(snapshot.visits ?? initialVisits);
      setEquipment(snapshot.equipment ?? equipmentCatalogue);
      setConsumables(snapshot.consumables ?? initialConsumables);
      setNotifications(snapshot.notifications ?? initialNotifications);
      setUsers(snapshot.users ?? initialUsers);
      setAuditLogs(snapshot.auditLogs ?? []);
      setEquipmentCategories([
        ...new Set(
          snapshot.equipmentCategories ?? [
            ...equipmentCatalogue.map((item) => item.category),
            "Sensors & Actuators",
          ],
        ),
      ]);
      setConfig(snapshot.config ?? initialConfig);
      setSlots(snapshot.slots ?? initialBookingSlots);
      setUploads(snapshot.uploads ?? []);
      setNotificationPreferences(
        snapshot.notificationPreferences ?? defaultNotificationPreferences,
      );
    };
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const snapshot = readSnapshot(saved);
    if (snapshot) applySnapshot(snapshot);
    lastSerialized.current = saved ?? "";
    hydratedRef.current = true;
    setHydrated(true);

    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const next = readSnapshot(event.newValue);
      if (!next) return;
      lastSerialized.current = event.newValue;
      applySnapshot(next);
    };
    window.addEventListener("storage", syncAcrossTabs);
    return () => window.removeEventListener("storage", syncAcrossTabs);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    const snapshot: SharedSnapshot = {
      profile,
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
      slots,
      uploads,
      notificationPreferences,
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSerialized.current) return;
    window.localStorage.setItem(STORAGE_KEY, serialized);
    lastSerialized.current = serialized;
  }, [
    profile,
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
    slots,
    uploads,
    notificationPreferences,
  ]);
  const actor =
    users.find((user) => user.role === role && user.active) ??
    users.find((user) => user.email === profile.email);
  const audit = useCallback(
    (
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
      ]),
    [actor?.id, actor?.name, profile.fullName, role],
  );
  const value = useMemo<State>(
    () => ({
      profile,
      role,
      authenticated,
      onboarded,
      hydrated,
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
      slots,
      uploads,
      notificationPreferences,
      addUpload(upload) {
        setUploads((prev) => [
          { ...upload, id: uid(), uploadedAt: new Date().toLocaleString("en-IN") },
          ...prev,
        ]);
        audit("Uploaded file", upload.fileName, { entityType: "Equipment Upload" });
      },
      removeUpload(id) {
        setUploads((prev) => prev.filter((upload) => upload.id !== id));
      },
      completeOnboarding(p) {
        setProfile(p);
        setOnboarded(true);
        // Register the real student so staff workspaces reflect actual sign-ins.
        setUsers((prev) =>
          prev.some((user) => user.email.toLowerCase() === p.email.toLowerCase())
            ? prev
            : [
                {
                  id: uid(),
                  name: p.fullName,
                  email: p.email,
                  prn: p.prn,
                  role: "Student",
                  active: true,
                  firstSignInAt: new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
                },
                ...prev,
              ],
        );
      },
      beginPrototypeSession(nextRole = "Student") {
        setRole(nextRole);
        setAuthenticated(true);
      },
      beginNewStudentSession() {
        // Development sign-in mirrors the institutional identity returned by Google.
        // A returning user keeps their persisted profile and onboarding state.
        setRole("Student");
        setAuthenticated(true);
        if (!onboarded) setProfile(defaultProfile);
      },
      signOut() {
        // A deliberate sign-out clears the identity, so the next sign-in starts at onboarding.
        setAuthenticated(false);
        setOnboarded(false);
        setProfile(defaultProfile);
        setRole("Student");
        window.location.href = "/";
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
      verifyProject(id) {
        const reviewedAt = new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        // The override simulates the whole chain: every invited teammate accepts
        // (their onboarding auto-completes), then the mentor approves.
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== id) return p;
            const memberEmails = new Set(
              p.members.map((member) => member.email?.toLowerCase()).filter(Boolean),
            );
            const joiningMembers = p.invitedEmails
              .filter((email) => !memberEmails.has(email.toLowerCase()))
              .map((email) => ({
                id: uid(),
                name: nameFromEmail(email),
                prn: `10322${String(Math.floor(10000 + Math.random() * 90000))}`,
                department: "MIT-WPU",
                email,
              }));
            return {
              ...p,
              members: [...p.members, ...joiningMembers],
              invitedEmails: [],
              ...(p.teamInvitations
                ? {
                    teamInvitations: p.teamInvitations.map((invitation) =>
                      invitation.status === "Pending"
                        ? { ...invitation, status: "Accepted" as const }
                        : invitation,
                    ),
                  }
                : {}),
              status: "Verified" as const,
              reviewedAt,
              reviewedBy: p.mentor.split(" — ")[0]!,
            };
          }),
        );
        audit("Verified project", id, { entityType: "Project", newValue: "Verified" });
      },
      deleteProject(id) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setReservations((prev) =>
          prev.filter((r) => !(r.projectId === id && r.status === "Active")),
        );
        audit("Deleted project", id, { entityType: "Project" });
      },
      addReservation(r) {
        setReservations((prev) => [
          {
            ...r,
            id: uid(),
            attendance:
              r.attendance ??
              Object.fromEntries(r.participantIds.map((id) => [id, { status: "Expected" }])),
          },
          ...prev,
        ]);
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
      completeReservation(id) {
        const booking = reservations.find((item) => item.id === id);
        setReservations((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "Completed" } : r)),
        );
        // A completed session is a real visit — record it so history and lab time are accurate.
        if (booking) {
          const now = new Date();
          const [entry = "", exit = ""] = booking.slot.split(/\s*–\s*/);
          setVisits((prev) => [
            {
              id: `booking-${booking.id}`,
              ownerEmail: profile.email,
              type: "Project Slot",
              title: booking.projectName,
              date: now.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              entry,
              exit,
              status: "Completed",
            },
            ...prev.filter((visit) => visit.id !== `booking-${booking.id}`),
          ]);
        }
        audit("Completed session", id, { entityType: "Booking" });
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
        const booking = reservations.find((item) => item.id === id);
        const project = booking
          ? projects.find((item) => item.id === booking.projectId)
          : undefined;
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
        if (booking && project && status !== "Expected") {
          const time = new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          setVisits((previousVisits) => {
            let nextVisits = previousVisits;
            participantIds.forEach((participantId) => {
              const ownerEmail =
                participantId === "leader"
                  ? (project.leaderEmail ??
                    (project.leader === defaultProfile.fullName ? defaultProfile.email : undefined))
                  : project.members.find((member) => member.id === participantId)?.email;
              if (!ownerEmail) return;
              const visitId = `booking-${booking.id}-${participantId}`;
              const existing = nextVisits.find((visit) => visit.id === visitId);
              const visit: Visit = {
                id: visitId,
                ownerEmail,
                type: "Project Slot",
                title: booking.projectName,
                date: booking.date,
                entry: existing?.entry ?? time,
                exit: status === "Exited" ? time : null,
                status: status === "Exited" ? "Completed" : "Active",
              };
              nextVisits = existing
                ? nextVisits.map((item) => (item.id === visitId ? visit : item))
                : [visit, ...nextVisits];
            });
            return nextVisits;
          });
        }
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
        setVisits((prev) => [
          { ...v, ownerEmail: v.ownerEmail ?? profile.email, id: uid() },
          ...prev,
        ]);
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
      addSlot(slot) {
        setSlots((prev) => [{ ...slot, id: uid() }, ...prev]);
        audit(slot.published ? "Published booking slot" : "Created booking slot", slot.label, {
          entityType: "Booking Slot",
          metadata: { date: `${slot.day}, ${slot.date} ${slot.month}` },
        });
      },
      updateSlot(id, patch) {
        setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
        audit(patch.published ? "Published booking slot" : "Updated booking slot", id, {
          entityType: "Booking Slot",
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
      updateNotificationPreferences(patch) {
        setNotificationPreferences((previous) => ({ ...previous, ...patch }));
      },
    }),
    [
      profile,
      role,
      authenticated,
      onboarded,
      hydrated,
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
      slots,
      uploads,
      notificationPreferences,
      actor?.name,
      audit,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useMakerSpace() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useMakerSpace must be used inside MakerSpaceProvider");
  return value;
}
