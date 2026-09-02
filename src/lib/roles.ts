/** The five workspace roles, in the wording the interface uses. */
export type AppRole = "Student" | "Faculty Mentor" | "Lab Assistant" | "Admin" | "Super Admin";

/** The signed-in person's academic identity, flattened for display. */
export type StudentProfile = {
  email: string;
  fullName: string;
  prn: string;
  department: string;
  programme: string;
  academicYear: string;
};
