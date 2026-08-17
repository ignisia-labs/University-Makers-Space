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
export type InvitationStatus = "Pending" | "Accepted" | "Declined" | "Cancelled" | "Expired";
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
  leaderEmail?: string;
  members: Student[];
  mentor: string;
  status: ProjectStatus;
  resources: string[];
  consumables?: string[];
  invitedEmails: string[];
  teamInvitations?: ProjectInvitation[];
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
};
export type ProjectInvitation = {
  email: string;
  name: string;
  status: InvitationStatus;
};
export type Reservation = {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  slot: string;
  slotId?: string;
  attendees: number;
  participantIds: string[];
  status: BookingStatus;
  resources: string[];
  cancelledReason?: string;
  cancelledAt?: string;
  noShowReason?: string;
  noShowAt?: string;
  handledBy?: string;
  attendance?: Record<string, AttendanceRecord>;
};
export type BookingSlot = {
  id: string;
  dateId: string;
  day: string;
  date: string;
  month: string;
  label: string;
  capacity: number;
  published: boolean;
};
export type AttendanceRecord = {
  status: "Expected" | "Entered" | "Exited";
  enteredAt?: string;
  exitedAt?: string;
  markedBy?: string;
};
export type Visit = {
  id: string;
  ownerEmail?: string;
  type: "Project Slot" | "Quick Visit";
  title: string;
  date: string;
  entry: string;
  exit: string | null;
  status: "Requested" | "Active" | "Completed";
};
export type EquipmentCategory = string;
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
  bookingVisible?: boolean;
  notes?: string;
  availabilityReason?: string;
  availabilityReasonCategory?: "Maintenance" | "Damage" | "Temporary Issue" | "Other";
  lab: string;
  createdAt: string;
  updatedAt: string;
  instructions?: string[];
  uploadSupport?: { label: string; accept: string };
};
export type EquipmentUpload = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  fileName: string;
  ownerEmail: string;
  uploadedAt: string;
};
export type Consumable = {
  id: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  active: boolean;
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
export type AppUser = {
  id: string;
  name: string;
  email: string;
  prn?: string;
  role: AppRole;
  active: boolean;
  provisionedAt?: string;
  firstSignInAt?: string;
};
export type AuditEvent = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: AppRole;
  entityType: string;
  entity: string;
  timestamp: string;
  reason?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, string>;
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
  availableDays: string[];
  quickVisitRules: string;
  projectVerificationRequirements: string;
  maximumFutureBookingsPerProject?: number;
};

// An empty profile — the student fills this in during onboarding. Nothing about
// the signed-in user is pre-filled anywhere in the app.
export const defaultProfile: StudentProfile = {
  email: "",
  fullName: "",
  prn: "",
  department: "",
  programme: "",
  academicYear: "",
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
// The app starts with no projects, bookings or visits — everything is created
// live in the app and persisted to localStorage so the full flow can be tested.
export const initialProjects: Project[] = [];
export const initialReservations: Reservation[] = [];
export const initialVisits: Visit[] = [];
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
    lab: "Main MakerSpace",
    createdAt: "01 Aug 2026",
    updatedAt: "15 Aug 2026",
    instructions: [
      "Slice your model before your session — lab assistants can help with settings.",
      "Check the bed is clean and level before starting a print.",
      "Long prints (4h+) need lab assistant approval.",
      "Never leave a first layer unattended.",
    ],
    uploadSupport: { label: "Upload your print file", accept: ".stl,.3mf,.obj,.gcode" },
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
    availabilityReason: "Scheduled optics inspection",
    availabilityReasonCategory: "Maintenance",
    lab: "Main MakerSpace",
    createdAt: "01 Aug 2026",
    updatedAt: "15 Aug 2026",
    instructions: [
      "Laser operation requires a trained lab assistant present at all times.",
      "Only approved materials — no PVC, vinyl or unknown plastics.",
      "Keep the fume extractor running for the full job.",
    ],
    uploadSupport: { label: "Upload your cut file", accept: ".svg,.dxf,.ai,.pdf" },
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
    lab: "Electronics Zone",
    createdAt: "01 Aug 2026",
    updatedAt: "14 Aug 2026",
    instructions: [
      "Wear the provided safety glasses while soldering.",
      "Set irons to 320 °C for lead-free solder unless told otherwise.",
      "Return probes and leads to the bench rack after use.",
    ],
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
    lab: "Robotics Zone",
    createdAt: "02 Aug 2026",
    updatedAt: "15 Aug 2026",
    instructions: [
      "Complete the 15-minute induction before first use.",
      "Keep the work envelope clear while the arm is powered.",
      "Home the arm before ending your session.",
    ],
  },
  {
    id: "e5",
    name: "CAD Workstation Pod",
    category: "Workstations",
    status: "Available",
    image: eqWorkstation,
    specs: ["i7 / 32 GB / RTX 4070", "SolidWorks · Fusion 360 · KiCad", "Dual 4K displays"],
    description:
      "GPU-accelerated design and simulation workstation with Wacom tablets for detailed modelling work.",
    totalQuantity: 8,
    availableQuantity: 8,
    visible: true,
    lab: "CAD Studio",
    createdAt: "02 Aug 2026",
    updatedAt: "12 Aug 2026",
    instructions: [
      "Save your work to your own cloud storage — pods are wiped nightly.",
      "Licensed software must not be copied off the workstation.",
    ],
  },
  {
    id: "e6",
    name: "Formlabs Form 3+",
    category: "3D Printing",
    status: "Available",
    image: eq3dPrinter,
    specs: ["SLA resin", "50-micron layer detail", "145 × 145 × 185 mm build"],
    description:
      "High-detail resin printer for precision parts, enclosures and smooth surface finishes.",
    totalQuantity: 2,
    availableQuantity: 2,
    visible: true,
    lab: "Main MakerSpace",
    createdAt: "03 Aug 2026",
    updatedAt: "15 Aug 2026",
    instructions: [
      "Resin printing requires gloves — collect a pair from the desk.",
      "Prints are washed and cured by lab assistants after your session.",
    ],
    uploadSupport: { label: "Upload your print file", accept: ".stl,.form,.3mf" },
  },
  {
    id: "e7",
    name: "ESP32 IoT Dev Crate",
    category: "Sensors & Actuators",
    status: "Available",
    image: eqRobotics,
    specs: ["ESP32 + Raspberry Pi kits", "IMU · LIDAR · Ultrasonic suites", "Servo & BLDC drivers"],
    description:
      "Checkout crate of microcontrollers, sensor suites and actuators for embedded and IoT builds.",
    totalQuantity: 12,
    availableQuantity: 9,
    visible: true,
    lab: "Robotics Zone",
    createdAt: "03 Aug 2026",
    updatedAt: "14 Aug 2026",
    instructions: [
      "Sign the crate out and back in with a lab assistant.",
      "Report damaged components — don't return them silently.",
    ],
  },
];
export const initialConsumables: Consumable[] = [
  {
    id: "c1",
    name: "PLA Filament",
    category: "3D Printing",
    description: "1.75 mm PLA filament for approved FDM projects.",
    unit: "Spool",
    active: true,
  },
  {
    id: "c2",
    name: "PCB Blanks",
    category: "Electronics",
    description: "FR-4 boards for approved circuit prototypes.",
    unit: "Board",
    active: true,
  },
  {
    id: "c3",
    name: "Jumper Wires",
    category: "Electronics",
    description: "Breadboard jumper wires for prototyping.",
    unit: "Pack",
    active: true,
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
export const initialBookingSlots: BookingSlot[] = bookingDates.flatMap((date) =>
  timeSlots.map((slot) => ({
    id: `${date.id}-${slot.id}`,
    dateId: date.id,
    day: date.day,
    date: date.date,
    month: date.month,
    label: slot.label,
    capacity: slot.capacity,
    published: true,
  })),
);
export const quickVisitPurposes = [
  "Component pickup",
  "Consult lab assistant",
  "Measure / test part",
  "Return material",
  "Explore equipment",
];
export const initialNotifications: Notification[] = [];
// Staff accounts the university provisions — students are added as they sign in.
export const initialUsers: AppUser[] = [
  {
    id: "u2",
    name: "Prof. Rohan Bhide",
    email: "rohan.bhide@mitwpu.edu.in",
    prn: "FAC-2041",
    role: "Faculty Mentor",
    active: true,
    provisionedAt: "01 Aug 2026",
    firstSignInAt: "03 Aug 2026",
  },
  {
    id: "u3",
    name: "Nisha Patil",
    email: "nisha.patil@mitwpu.edu.in",
    prn: "STAFF-103",
    role: "Lab Assistant",
    active: true,
    provisionedAt: "01 Aug 2026",
    firstSignInAt: "02 Aug 2026",
  },
  {
    id: "u4",
    name: "Anil Jadhav",
    email: "anil.jadhav@mitwpu.edu.in",
    prn: "ADM-009",
    role: "Admin",
    active: true,
    provisionedAt: "01 Aug 2026",
    firstSignInAt: "02 Aug 2026",
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
  availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  quickVisitRules: "Quick visits require a valid purpose and are subject to live lab availability.",
  projectVerificationRequirements:
    "A project description, team details, faculty mentor, and expected resources are required.",
  maximumFutureBookingsPerProject: 3,
};
