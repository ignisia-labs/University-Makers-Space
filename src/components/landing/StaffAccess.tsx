import { useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, GraduationCap, LineChart } from "lucide-react";
import { useMakerSpace } from "@/lib/makerspace-context";
import type { AppRole } from "@/lib/makerspace-data";

const entries = [
  { role: "Faculty Mentor" as AppRole, label: "Faculty", to: "/faculty", icon: GraduationCap },
  {
    role: "Lab Assistant" as AppRole,
    label: "Lab Assistant",
    to: "/operations",
    icon: ClipboardCheck,
  },
  { role: "Admin" as AppRole, label: "Admin", to: "/admin", icon: LineChart },
];

export function StaffAccess() {
  const { beginPrototypeSession } = useMakerSpace();
  const navigate = useNavigate();

  return (
    <section className="w-full border-t border-zinc-200/50 bg-white px-6 py-14 md:px-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#1E2B8A]">
            03 // Staff access
          </p>
          <p className="mt-1.5 text-xs text-zinc-400">
            {import.meta.env.DEV
              ? "Prototype views for UI review. API permissions are not granted."
              : "MakerSpace staff sign in with their institutional accounts."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {entries.map(({ role, label, to, icon: Icon }) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                if (import.meta.env.DEV) {
                  beginPrototypeSession(role);
                  navigate({ to });
                } else {
                  navigate({ to: "/login" });
                }
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-500 transition-colors hover:border-[#1E2B8A]/40 hover:text-[#1E2B8A]"
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
