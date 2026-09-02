import type { FacultyDirectoryResult } from "@/lib/api";

/** "Dr. Asha Rao" — the honorific from the faculty import, when one was given. */
export function mentorLabel(mentor: Pick<FacultyDirectoryResult, "name" | "prefix">) {
  const prefix = mentor.prefix?.trim();
  return prefix ? `${prefix} ${mentor.name}` : mentor.name;
}
