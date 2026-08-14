import eq3dPrinter from "@/assets/eq-3dprinter.jpg";
import eqLaser from "@/assets/eq-laser.jpg";
import eqElectronics from "@/assets/eq-electronics.jpg";
import eqRobotics from "@/assets/eq-robotics.jpg";
import eqWorkstation from "@/assets/eq-workstation.jpg";

export type ProjectStatus = "Draft" | "Mentor Approval Pending" | "Verified";

export type Student = {
  id: string;
  name: string;
  prn: string;
  department: string;
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
};

export type Reservation = {
  id: string;
  projectName: string;
  date: string;
  slot: string;
  attendees: number;
  status: "Active" | "Completed";
};

export type Visit = {
  id: string;
  type: "Project Slot" | "Quick Visit";
  title: string;
  date: string;
  entry: string;
  exit: string | null;
};

export type EquipmentCategory =
  | "3D Printing"
  | "Laser"
  | "Robotics"
  | "Electronics"
  | "Workstations";

export type Equipment = {
  id: string;
  name: string;
  category: EquipmentCategory;
  status: "Available" | "Under Maintenance";
  image: string;
  specs: string[];
};

export type StudentProfile = {
  email: string;
  fullName: string;
  prn: string;
  department: string;
  programme: string;
  academicYear: string;
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

export const academicYears = [
  "First Year",
  "Second Year",
  "Third Year",
  "Final Year",
];

export const facultyMentors = [
  "Dr. Neha Kulkarni — CSE",
  "Prof. Rohan Bhide — E&TC",
  "Dr. Sanjana Rao — Mechanical",
  "Prof. Amit Shirke — Robotics",
  "Dr. Priya Nair — Design",
];

export const directoryStudents: Student[] = [
  { id: "s2", name: "Isha Kulkarni", prn: "1032220912", department: "CSE" },
  { id: "s3", name: "Rehan Shaikh", prn: "1032221044", department: "E&TC" },
  { id: "s4", name: "Meera Joshi", prn: "1032220778", department: "Mechanical" },
  { id: "s5", name: "Kabir Menon", prn: "1032221190", department: "Robotics" },
  { id: "s6", name: "Tanvi Patil", prn: "1032220633", department: "Design" },
  { id: "s7", name: "Arjun Nair", prn: "1032221457", department: "CSE" },
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
  ],
  Consumables: [
    "PLA Filament",
    "Acrylic Sheets",
    "Jumper Wires",
    "PCB Blanks",
    "MDF Board",
  ],
};

export const initialProjects: Project[] = [
  {
    id: "p1",
    name: "Autonomous Campus Rover",
    description:
      "A LiDAR-guided rover that maps and patrols the campus perimeter autonomously.",
    leader: "Aarav Deshmukh",
    members: [directoryStudents[0]!, directoryStudents[3]!],
    mentor: "Prof. Amit Shirke — Robotics",
    status: "Verified",
    resources: ["Robotic Arm", "CAD Workstation", "Jumper Wires"],
  },
  {
    id: "p2",
    name: "IoT Air Quality Grid",
    description:
      "Distributed ESP32 sensor nodes streaming live AQI data across the campus.",
    leader: "Aarav Deshmukh",
    members: [directoryStudents[1]!],
    mentor: "Prof. Rohan Bhide — E&TC",
    status: "Mentor Approval Pending",
    resources: ["Soldering Station", "PCB Blanks", "Oscilloscope"],
  },
  {
    id: "p3",
    name: "Modular Prosthetic Hand",
    description:
      "3D printed low-cost prosthetic hand with servo-driven articulated fingers.",
    leader: "Aarav Deshmukh",
    members: [directoryStudents[2]!, directoryStudents[4]!, directoryStudents[5]!],
    mentor: "Dr. Sanjana Rao — Mechanical",
    status: "Draft",
    resources: ["FDM 3D Printer", "PLA Filament"],
  },
];

export const initialReservations: Reservation[] = [
  {
    id: "r1",
    projectName: "Autonomous Campus Rover",
    date: "Mon, 17 Aug",
    slot: "10:30 – 11:30",
    attendees: 3,
    status: "Active",
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
  },
  {
    id: "v2",
    type: "Quick Visit",
    title: "Component pickup",
    date: "09 Aug 2026",
    entry: "15:04",
    exit: "15:21",
  },
  {
    id: "v3",
    type: "Project Slot",
    title: "IoT Air Quality Grid",
    date: "05 Aug 2026",
    entry: "14:00",
    exit: "16:05",
  },
];

export const equipmentCatalogue: Equipment[] = [
  {
    id: "e1",
    name: "Creality Ender-5 Plus",
    category: "3D Printing",
    status: "Available",
    image: eq3dPrinter,
    specs: ["350 × 350 × 400 mm", "PLA / PETG / TPU", "0.1 mm layer"],
  },
  {
    id: "e2",
    name: "Trotec Speedy 100 Laser",
    category: "Laser",
    status: "Under Maintenance",
    image: eqLaser,
    specs: ["60 W CO2", "610 × 305 mm bed", "Acrylic, MDF, ply"],
  },
  {
    id: "e3",
    name: "Electronics Bench 02",
    category: "Electronics",
    status: "Available",
    image: eqElectronics,
    specs: ["Hakko FX-888D", "100 MHz DSO", "Bench PSU 30V/5A"],
  },
  {
    id: "e4",
    name: "Dobot Magician Arm",
    category: "Robotics",
    status: "Available",
    image: eqRobotics,
    specs: ["4-axis", "500 g payload", "0.2 mm repeatability"],
  },
  {
    id: "e5",
    name: "CAD Workstation Pod",
    category: "Workstations",
    status: "Available",
    image: eqWorkstation,
    specs: ["i7 / 32 GB / RTX", "SolidWorks, Fusion 360", "8 seats"],
  },
  {
    id: "e6",
    name: "Formlabs Form 3+",
    category: "3D Printing",
    status: "Under Maintenance",
    image: eq3dPrinter,
    specs: ["SLA resin", "145 × 145 × 185 mm", "25 µm layer"],
  },
];

export const bookingDates = [
  { id: "d1", day: "Mon", date: "17", month: "Aug" },
  { id: "d2", day: "Tue", date: "18", month: "Aug" },
  { id: "d3", day: "Wed", date: "19", month: "Aug" },
  { id: "d4", day: "Thu", date: "20", month: "Aug" },
  { id: "d5", day: "Fri", date: "21", month: "Aug" },
  { id: "d6", day: "Sat", date: "22", month: "Aug" },
];

export const timeSlots = [
  {
    id: "t1",
    label: "09:00 – 10:00",
    capacity: 12,
    booked: 9,
    equipment: [
      { name: "3D Printer", available: true },
      { name: "Laser Cutter", available: false },
    ],
  },
  {
    id: "t2",
    label: "10:30 – 11:30",
    capacity: 12,
    booked: 6,
    equipment: [
      { name: "3D Printer", available: true },
      { name: "Robotic Arm", available: true },
    ],
  },
  {
    id: "t3",
    label: "12:00 – 13:00",
    capacity: 12,
    booked: 12,
    equipment: [
      { name: "3D Printer", available: false },
      { name: "Electronics Bench", available: true },
    ],
  },
  {
    id: "t4",
    label: "14:30 – 15:30",
    capacity: 12,
    booked: 4,
    equipment: [
      { name: "3D Printer", available: true },
      { name: "Electronics Bench", available: true },
    ],
  },
  {
    id: "t5",
    label: "16:00 – 17:00",
    capacity: 12,
    booked: 7,
    equipment: [
      { name: "Laser Cutter", available: true },
      { name: "CAD Workstation", available: true },
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
