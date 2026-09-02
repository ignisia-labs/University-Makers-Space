import { ClipboardCheck, GraduationCap, LineChart } from "lucide-react";

const entries = [
  { label: "Faculty", icon: GraduationCap },
  { label: "Lab Assistant", icon: ClipboardCheck },
  { label: "Admin", icon: LineChart },
];

/**
 * Staff access note on the landing page.
 *
 * These are labels, not doors: staff reach their workspace by signing in with
 * the institutional account that carries the role. There is no separate staff
 * login, and offering buttons that only pretend to open one would be a lie.
 */
export function StaffAccess() {
  return (
    <section className="w-full border-t border-zinc-200/50 bg-white px-6 py-14 md:px-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#1E2B8A]">
            03 // Staff access
          </p>
          <p className="mt-1.5 text-xs text-zinc-400">
            MakerSpace staff sign in with their institutional accounts.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {entries.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-500"
            >
              <Icon className="size-3.5" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
