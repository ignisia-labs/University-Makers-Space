import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, ChevronDown } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useMakerSpace } from "@/lib/makerspace-context";
import { academicYears, departments, programmes } from "@/lib/makerspace-data";

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({ invite: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Complete your profile — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Set up your MakerSpace student profile with PRN, department, programme and academic year.",
      },
    ],
  }),
  component: Onboarding,
});

type FormErrors = Partial<
  Record<"fullName" | "prn" | "department" | "programme" | "academicYear", string>
>;

function Onboarding() {
  const { profile, completeOnboarding, acceptProjectInvitation } = useMakerSpace();
  const navigate = useNavigate();
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { invite: invitationProjectId } = Route.useSearch();

  useEffect(() => {
    if (!isComplete) return;
    const timer = window.setTimeout(() => navigate({ to: "/dashboard" }), 900);
    return () => window.clearTimeout(timer);
  }, [isComplete, navigate]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name.";
    if (!form.prn.trim()) next.prn = "Enter your PRN.";
    if (!form.department) next.department = "Select your department.";
    if (!form.programme) next.programme = "Select your programme.";
    if (!form.academicYear) next.academicYear = "Select your academic year.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  if (isComplete) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F0EFFF] px-4 py-10">
        <section className="w-full max-w-md p-8 bg-white border border-zinc-200 rounded-3xl shadow-sm text-center animate-in fade-in zoom-in-95 duration-500">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#2CC5B0]/10 text-[#2CC5B0]">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-serif font-light text-zinc-900">Profile Saved</h1>
          <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
            <LoaderCircle className="size-3.5 animate-spin" /> Redirecting...
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0EFFF] text-zinc-900 flex flex-col justify-center items-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-[2.5rem] p-8 sm:p-10 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Clean, Elegant Serif Heading */}
        <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#0F172A] tracking-wide">
          Complete Student Profile
        </h1>

        {/* Form */}
        <form
          noValidate
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            setIsSaving(true);
            window.setTimeout(() => {
              completeOnboarding(form);
              if (invitationProjectId) {
                acceptProjectInvitation(invitationProjectId, form);
                toast.success("Profile completed. Joined project team.");
              } else {
                toast.success("Profile completed. Welcome!");
              }
              setIsSaving(false);
              setIsComplete(true);
            }, 450);
          }}
        >
          {/* Email (Read only) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">
              Institutional Email
            </label>
            <input
              type="email"
              value={form.email}
              readOnly
              className="w-full h-11 px-4 rounded-xl border border-zinc-200 bg-zinc-50/50 text-zinc-500 font-mono text-xs outline-none cursor-not-allowed"
            />
          </div>

          {/* Full name input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 font-semibold">
              Full Name
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className={`w-full h-11 px-4 rounded-xl border ${
                errors.fullName
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-zinc-200 focus:border-[#1E2B8A]"
              } bg-[#F0EFFF]/40 text-sm text-zinc-800 outline-none transition-all`}
            />
            {errors.fullName && (
              <p className="text-[10px] font-mono text-rose-500">{errors.fullName}</p>
            )}
          </div>

          {/* PRN input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 font-semibold">
              PRN (Permanent Registration Number)
            </label>
            <input
              type="text"
              value={form.prn}
              onChange={(e) => set("prn")(e.target.value)}
              placeholder="Enter your PRN"
              className={`w-full h-11 px-4 rounded-xl border ${
                errors.prn
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-zinc-200 focus:border-[#1E2B8A]"
              } bg-[#F0EFFF]/40 text-sm text-zinc-800 outline-none transition-all`}
            />
            {errors.prn && <p className="text-[10px] font-mono text-rose-500">{errors.prn}</p>}
          </div>

          {/* Custom Select for Department */}
          <CustomSelect
            label="Department"
            value={form.department}
            options={departments}
            error={errors.department}
            onChange={set("department")}
          />

          {/* Custom Select for Programme */}
          <CustomSelect
            label="Programme"
            value={form.programme}
            options={programmes}
            error={errors.programme}
            onChange={set("programme")}
          />

          {/* Custom Select for Academic Year */}
          <CustomSelect
            label="Academic Year"
            value={form.academicYear}
            options={academicYears}
            error={errors.academicYear}
            onChange={set("academicYear")}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-12 inline-flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-900 text-xs font-bold tracking-widest text-white uppercase transition-all hover:bg-zinc-800 hover:border-zinc-800 active:scale-[0.98] disabled:cursor-wait cursor-pointer"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4.5 animate-spin" /> Saving...
              </span>
            ) : (
              "Complete Onboarding"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

interface CustomSelectProps {
  label: string;
  value: string;
  options: string[];
  error?: string;
  onChange: (value: string) => void;
}

function CustomSelect({ label, value, options, error, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 font-semibold">
        {label}
      </label>

      {/* Trigger Box */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-11 px-4 rounded-xl border flex items-center justify-between text-left ${
          error
            ? "border-rose-400"
            : isOpen
              ? "border-[#1E2B8A] ring-1 ring-[#1E2B8A]/10"
              : "border-zinc-200"
        } bg-[#F0EFFF]/40 text-sm text-zinc-800 outline-none transition-all cursor-pointer`}
      >
        <span className={value ? "text-zinc-800" : "text-zinc-400"}>
          {value || `Select ${label.toLowerCase()}`}
        </span>
        <ChevronDown
          className={`size-4 text-zinc-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Options Menu */}
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-lg max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200 no-scrollbar">
          <div className="p-1 space-y-0.5">
            {options.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#1E2B8A]/10 text-[#1E2B8A] font-semibold"
                      : "text-zinc-700 hover:bg-[#F0EFFF] hover:text-zinc-950"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] font-mono text-rose-500 mt-1">{error}</p>}
    </div>
  );
}
