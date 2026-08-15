import eq3dPrinter from "@/assets/eq-3dprinter.jpg";
import eqLaser from "@/assets/eq-laser.jpg";
import eqElectronics from "@/assets/eq-electronics.jpg";
import eqRobotics from "@/assets/eq-robotics.jpg";
import eqWorkstation from "@/assets/eq-workstation.jpg";

export type AppRole = "Student" | "Faculty Mentor" | "Lab Assistant" | "Admin" | "Super Admin";
export type ProjectStatus =
  | "Draft"
  | "Team Acceptance Pending"
  | "Mentor Approval Pending"
  | "Verified"
  | "Rejected"
  | "Archived";
export type BookingStatus = "Active" | "Completed" | "Cancelled" | "No Show";
export type EquipmentStatus =
  | "Available"
  | "Partially Available"
  | "In Use"
  | "Reserved"
  | "Unavailable"
  | "Under Maintenance"
  | "Damaged"
  | "Out of Service";

export type Student = {
  id: string;
  name: string;
  prn: string;
  department: string;
  email?: string;
  present?: boolean;
};
export type Project = {
  id: string;
  name: string;
  description: string;
  leader: string;
  members: Student[];
  mentor: string;
  status: ProjectStatus;
  resources: string[];
  invitedEmails: string[];
  rejectionReason?: string;
  createdAt: string;
};
export type Reservation = {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  slot: string;
  attendees: number;
  participantIds: string[];
  status: BookingStatus;
  resources: string[];
  cancelledReason?: string;
};
export type Visit = {
  id: string;
  type: "Project Slot" | "Quick Visit";
  title: string;
  date: string;
  entry: string;
  exit: string | null;
  status: "Requested" | "Active" | "Completed";
};
export type EquipmentCategory =
  "3D Printing" | "Laser" | "Robotics" | "Electronics" | "Workstations" | "Sensors & Actuators";
export type Equipment = {
  id: string;
  name: string;
  category: EquipmentCategory;
  status: EquipmentStatus;
  image: string;
  specs: string[];
  description: string;
  totalQuantity: number;
  availableQuantity: number;
  visible: boolean;
};
export type StudentProfile = {
  email: string;
  fullName: string;
  prn: string;
  department: string;
  programme: string;
  academicYear: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};
export type AppUser = { id: string; name: string; email: string; role: AppRole; active: boolean };
export type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  entity: string;
  timestamp: string;
};
export type LabConfig = {
  labName: string;
  openingTime: string;
  closingTime: string;
  slotDuration: number;
  capacity: number;
  bookingHorizon: number;
  cancellationWindow: number;
  closureDates: string[];
};

export const defaultProfile: StudentProfile = {
  email: "aarav.deshmukh@mitwpu.edu.in",
  fullName: "Aarav Deshmukh",
  prn: "1032220845",
  department: "Computer Science & Engineering",
  programme: "B.Tech",
  academicYear: "Third Year",
};
export const departments = [
  "Computer Science & Engineering",
  "Electronics & Communication",
  "Mechanical Engineering",
  "Robotics & Automation",
  "Civil Engineering",
  "Design",
];
export const programmes = ["B.Tech", "B.Des", "M.Tech", "MBA Tech", "Ph.D"];
export const academicYears = ["First Year", "Second Year", "Third Year", "Final Year"];
export const facultyMentors = [
  "Dr. Neha Kulkarni — CSE",
  "Prof. Rohan Bhide — E&TC",
  "Dr. Sanjana Rao — Mechanical",
  "Prof. Amit Shirke — Robotics",
  "Dr. Priya Nair — Design",
];
export const directoryStudents: Student[] = [
  {
    id: "s2",
    name: "Isha Kulkarni",
    prn: "1032220912",
    department: "CSE",
    email: "isha.kulkarni@mitwpu.edu.in",
  },
  {
    id: "s3",
    name: "Rehan Shaikh",
    prn: "1032221044",
    department: "E&TC",
    email: "rehan.shaikh@mitwpu.edu.in",
  },
  {
    id: "s4",
    name: "Meera Joshi",
    prn: "1032220778",
    department: "Mechanical",
    email: "meera.joshi@mitwpu.edu.in",
  },
  {
    id: "s5",
    name: "Kabir Menon",
    prn: "1032221190",
    department: "Robotics",
    email: "kabir.menon@mitwpu.edu.in",
  },
];
export const resourceOptions = {
  Equipment: [
    "FDM 3D Printer",
    "Resin 3D Printer",
    "CO2 Laser Cutter",
    "Soldering Station",
    "Oscilloscope",
    "Robotic Arm",
    "CAD Workstation",
    "ESP32 Kit",
    "Ultrasonic Sensor",
  ],
  Consumables: ["PLA Filament", "Acrylic Sheets", "Jumper Wires", "PCB Blanks", "MDF Board"],
};
export const initialProjects: Project[] = [
  {
    id: "p1",
    name: "Autonomous Campus Rover",
    description: "A LiDAR-guided rover that maps and patrols the campus perimeter autonomously.",
    leader: "Aarav Deshmukh",
    members: [directoryStudents[0]!, directoryStudents[3]!],
    mentor: "Prof. Amit Shirke — Robotics",
    status: "Verified",
    resources: ["Robotic Arm", "CAD Workstation", "Jumper Wires"],
    invitedEmails: [],
    createdAt: "12 Aug 2026",
  },
  {
    id: "p2",
    name: "IoT Air Quality Grid",
    description: "Distributed ESP32 sensor nodes streaming live AQI data across the campus.",
    leader: "Aarav Deshmukh",
    members: [directoryStudents[1]!],
    mentor: "Prof. Rohan Bhide — E&TC",
    status: "Mentor Approval Pending",
    resources: ["Soldering Station", "PCB Blanks", "Oscilloscope"],
    invitedEmails: [],
    createdAt: "13 Aug 2026",
  },
  {
    id: "p3",
    name: "Modular Prosthetic Hand",
    description: "3D printed low-cost prosthetic hand with servo-driven articulated fingers.",
    leader: "Aarav Deshmukh",
    members: [directoryStudents[2]!],
    mentor: "Dr. Sanjana Rao — Mechanical",
    status: "Draft",
    resources: ["FDM 3D Printer", "PLA Filament"],
    invitedEmails: [],
    createdAt: "14 Aug 2026",
  },
];
export const initialReservations: Reservation[] = [
  {
    id: "r1",
    projectId: "p1",
    projectName: "Autonomous Campus Rover",
    date: "Mon, 17 Aug",
    slot: "10:30 – 11:30",
    attendees: 3,
    participantIds: ["leader", "s2", "s5"],
    status: "Active",
    resources: ["Robotic Arm", "CAD Workstation"],
  },
];
export const initialVisits: Visit[] = [
  {
    id: "v1",
    type: "Project Slot",
    title: "Autonomous Campus Rover",
    date: "12 Aug 2026",
    entry: "10:32",
    exit: "11:28",
    status: "Completed",
  },
  {
    id: "v2",
    type: "Quick Visit",
    title: "Component pickup",
    date: "09 Aug 2026",
    entry: "15:04",
    exit: "15:21",
    status: "Completed",
  },
];
export const equipmentCatalogue: Equipment[] = [
  {
    id: "e1",
    name: "Creality Ender-5 Plus",
    category: "3D Printing",
    status: "Available",
    image: eq3dPrinter,
    specs: ["350 × 350 × 400 mm", "PLA / PETG / TPU"],
    description: "Large-format FDM prototyping printer.",
    totalQuantity: 4,
    availableQuantity: 3,
    visible: true,
  },
  {
    id: "e2",
    name: "Trotec Speedy 100 Laser",
    category: "Laser",
    status: "Under Maintenance",
    image: eqLaser,
    specs: ["60 W CO2", "610 × 305 mm bed"],
    description: "Laser fabrication for acrylic, MDF and ply.",
    totalQuantity: 1,
    availableQuantity: 0,
    visible: true,
  },
  {
    id: "e3",
    name: "Electronics Bench 02",
    category: "Electronics",
    status: "Available",
    image: eqElectronics,
    specs: ["Hakko FX-888D", "100 MHz DSO"],
    description: "Soldering and measurement bench.",
    totalQuantity: 8,
    availableQuantity: 6,
    visible: true,
  },
  {
    id: "e4",
    name: "Dobot Magician Arm",
    category: "Robotics",
    status: "In Use",
    image: eqRobotics,
    specs: ["4-axis", "500 g payload"],
    description: "Desktop robotic arm for prototyping.",
    totalQuantity: 2,
    availableQuantity: 1,
    visible: true,
  },
  {
    id: "e5",
    name: "CAD Workstation Pod",
    category: "Workstations",
    status: "Available",
    image: eqWorkstation,
    specs: ["i7 / 32 GB / RTX", "SolidWorks"],
    description: "Design and simulation workstation.",
    totalQuantity: 8,
    availableQuantity: 8,
    visible: true,
  },
];
export const bookingDates = [
  { id: "d1", day: "Mon", date: "17", month: "Aug" },
  { id: "d2", day: "Tue", date: "18", month: "Aug" },
  { id: "d3", day: "Wed", date: "19", month: "Aug" },
  { id: "d4", day: "Thu", date: "20", month: "Aug" },
  { id: "d5", day: "Fri", date: "21", month: "Aug" },
];
export const timeSlots = [
  {
    id: "t1",
    label: "09:00 – 10:00",
    capacity: 20,
    booked: 9,
    equipment: [
      { name: "3D Printer", available: true },
      { name: "Laser Cutter", available: false },
    ],
  },
  {
    id: "t2",
    label: "10:30 – 11:30",
    capacity: 20,
    booked: 6,
    equipment: [
      { name: "3D Printer", available: true },
      { name: "Robotic Arm", available: true },
    ],
  },
  {
    id: "t3",
    label: "12:00 – 13:00",
    capacity: 20,
    booked: 20,
    equipment: [{ name: "Electronics Bench", available: true }],
  },
  {
    id: "t4",
    label: "14:30 – 15:30",
    capacity: 20,
    booked: 4,
    equipment: [
      { name: "3D Printer", available: true },
      { name: "Electronics Bench", available: true },
    ],
  },
];
export const quickVisitPurposes = [
  "Component pickup",
  "Consult lab assistant",
  "Measure / test part",
  "Return material",
  "Explore equipment",
];
export const initialNotifications: Notification[] = [
  {
    id: "n1",
    title: "Mentor approval pending",
    body: "Prof. Rohan Bhide has your project for review.",
    href: "/projects",
    read: false,
    createdAt: "Today",
  },
  {
    id: "n2",
    title: "Upcoming slot",
    body: "Campus Rover is booked for 17 Aug at 10:30.",
    href: "/book",
    read: false,
    createdAt: "Today",
  },
];
export const initialUsers: AppUser[] = [
  { id: "u1", name: "Aarav Deshmukh", email: defaultProfile.email, role: "Student", active: true },
  {
    id: "u2",
    name: "Prof. Rohan Bhide",
    email: "rohan.bhide@mitwpu.edu.in",
    role: "Faculty Mentor",
    active: true,
  },
  {
    id: "u3",
    name: "Nisha Patil",
    email: "nisha.patil@mitwpu.edu.in",
    role: "Lab Assistant",
    active: true,
  },
  {
    id: "u4",
    name: "Anil Jadhav",
    email: "anil.jadhav@mitwpu.edu.in",
    role: "Admin",
    active: true,
  },
];
export const initialConfig: LabConfig = {
  labName: "MIT-WPU MakerSpace",
  openingTime: "08:30",
  closingTime: "18:30",
  slotDuration: 60,
  capacity: 20,
  bookingHorizon: 14,
  cancellationWindow: 2,
  closureDates: [],
};
