import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  defaultProfile,
  equipmentCatalogue,
  initialConfig,
  initialNotifications,
  initialProjects,
  initialReservations,
  initialUsers,
  initialVisits,
  type AppRole,
  type AppUser,
  type AuditEvent,
  type Equipment,
  type LabConfig,
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
  notifications: Notification[];
  users: AppUser[];
  auditLogs: AuditEvent[];
  config: LabConfig;
  completeOnboarding: (p: StudentProfile) => void;
  beginPrototypeSession: () => void;
  signOut: () => void;
  addProject: (p: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  addReservation: (r: Omit<Reservation, "id">) => void;
  cancelReservation: (id: string, reason: string) => void;
  markReservationNoShow: (id: string) => void;
  addVisit: (v: Omit<Visit, "id">) => void;
  updateVisit: (id: string, patch: Partial<Visit>) => void;
  acceptProjectInvitation: (id: string, s: StudentProfile) => void;
  updateEquipment: (id: string, patch: Partial<Equipment>) => void;
  addEquipment: (e: Omit<Equipment, "id">) => void;
  removeEquipment: (id: string) => void;
  saveConfig: (c: LabConfig) => void;
  updateUserRole: (id: string, role: AppRole) => void;
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
  const [notifications, setNotifications] = useState(initialNotifications);
  const [users, setUsers] = useState(initialUsers);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [config, setConfig] = useState(initialConfig);
  const audit = (action: string, entity: string) =>
    setAuditLogs((prev) => [
      { id: uid(), action, entity, actor: role, timestamp: new Date().toLocaleString("en-IN") },
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
      notifications,
      users,
      auditLogs,
      config,
      completeOnboarding(p) {
        setProfile(p);
        setOnboarded(true);
      },
      beginPrototypeSession() {
        setRole("Student");
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
        setReservations((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: "Cancelled", cancelledReason: reason } : r,
          ),
        );
        audit("Cancelled booking", id);
      },
      markReservationNoShow(id) {
        setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: "No Show" } : r)));
        audit("Marked booking no-show", id);
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
            return {
              ...p,
              invitedEmails: invitations,
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
        setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
        audit("Updated equipment", id);
      },
      addEquipment(e) {
        setEquipment((prev) => [{ ...e, id: uid() }, ...prev]);
        audit("Added equipment", e.name);
      },
      removeEquipment(id) {
        setEquipment((prev) => prev.filter((e) => e.id !== id));
        audit("Removed equipment", id);
      },
      saveConfig(c) {
        setConfig(c);
        audit("Updated lab configuration", c.labName);
      },
      updateUserRole(id, nextRole) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: nextRole } : u)));
        audit("Changed user role", id);
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
      notifications,
      users,
      auditLogs,
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
