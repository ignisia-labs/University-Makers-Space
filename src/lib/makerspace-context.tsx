import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  defaultProfile,
  initialProjects,
  initialReservations,
  initialVisits,
  type Project,
  type Reservation,
  type StudentProfile,
  type Visit,
} from "./makerspace-data";

type MakerSpaceState = {
  profile: StudentProfile;
  onboarded: boolean;
  projects: Project[];
  reservations: Reservation[];
  visits: Visit[];
  completeOnboarding: (profile: StudentProfile) => void;
  addProject: (project: Omit<Project, "id">) => void;
  addReservation: (reservation: Omit<Reservation, "id">) => void;
  addVisit: (visit: Omit<Visit, "id">) => void;
  acceptProjectInvitation: (projectId: string, student: StudentProfile) => void;
};

const MakerSpaceContext = createContext<MakerSpaceState | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10);

export function MakerSpaceProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile>(defaultProfile);
  const [onboarded, setOnboarded] = useState(false);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);

  const value = useMemo<MakerSpaceState>(
    () => ({
      profile,
      onboarded,
      projects,
      reservations,
      visits,
      completeOnboarding: (next) => {
        setProfile(next);
        setOnboarded(true);
      },
      addProject: (project) => setProjects((prev) => [{ ...project, id: uid() }, ...prev]),
      addReservation: (reservation) =>
        setReservations((prev) => [{ ...reservation, id: uid() }, ...prev]),
      addVisit: (visit) => setVisits((prev) => [{ ...visit, id: uid() }, ...prev]),
      acceptProjectInvitation: (projectId, student) =>
        setProjects((prev) =>
          prev.map((project) => {
            const email = student.email.trim().toLowerCase();
            if (
              project.id !== projectId ||
              !project.invitedEmails.some((invited) => invited.toLowerCase() === email) ||
              project.members.some((member) => member.email?.toLowerCase() === email)
            ) {
              return project;
            }

            const invitedEmails = project.invitedEmails.filter(
              (invited) => invited.toLowerCase() !== email,
            );

            return {
              ...project,
              members: [
                ...project.members,
                {
                  id: uid(),
                  name: student.fullName,
                  prn: student.prn,
                  department: student.department,
                  email: student.email,
                },
              ],
              invitedEmails,
              status:
                invitedEmails.length === 0 && project.status === "Team Acceptance Pending"
                  ? "Mentor Approval Pending"
                  : project.status,
            };
          }),
        ),
    }),
    [profile, onboarded, projects, reservations, visits],
  );

  return <MakerSpaceContext.Provider value={value}>{children}</MakerSpaceContext.Provider>;
}

export function useMakerSpace() {
  const ctx = useContext(MakerSpaceContext);
  if (!ctx) throw new Error("useMakerSpace must be used inside MakerSpaceProvider");
  return ctx;
}
