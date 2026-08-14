import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMakerSpace } from "@/lib/makerspace-context";
import {
  directoryStudents,
  facultyMentors,
  resourceOptions,
  type Student,
} from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects hub — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Create projects, invite team members, pick a faculty mentor and submit for verification.",
      },
      { property: "og:title", content: "Projects hub — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content: "Manage your MakerSpace projects and submit them for mentor verification.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, profile, addProject } = useMakerSpace();
  const [open, setOpen] = useState(false);

  return (
    <AppShell title="Projects" subtitle={`${projects.length} projects registered`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
      >
        <Plus className="size-5" /> New Project
      </button>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <article key={project.id} className="card-surface p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <h2 className="min-w-0 truncate text-lg font-semibold">{project.name}</h2>
              <StatusBadge label={project.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Leader</dt>
                <dd className="font-medium">
                  {project.leader}
                  {project.leader === profile.fullName && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                      You
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Mentor</dt>
                <dd className="font-medium">{project.mentor}</dd>
              </div>
            </dl>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="size-4" /> {project.members.length + 1} members
            </p>
          </article>
        ))}
      </div>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Create a project"
        description="Register your build, invite your team and request mentor verification."
      >
        <ProjectWizard
          onSubmit={(data) => {
            addProject({ ...data, leader: profile.fullName, status: "Mentor Approval Pending" });
            setOpen(false);
            toast.success("Project submitted for mentor verification");
          }}
        />
      </ResponsiveModal>
    </AppShell>
  );
}

function ProjectWizard({
  onSubmit,
}: {
  onSubmit: (data: {
    name: string;
    description: string;
    members: Student[];
    mentor: string;
    resources: string[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Student[]>([]);
  const [mentor, setMentor] = useState(facultyMentors[0]!);
  const [resources, setResources] = useState<string[]>([]);

  const matches = directoryStudents.filter(
    (s) =>
      !members.some((m) => m.id === s.id) &&
      query.length > 0 &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );

  const toggleResource = (item: string) =>
    setResources((prev) =>
      prev.includes(item) ? prev.filter((r) => r !== item) : [...prev, item],
    );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, description, members, mentor, resources });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="p-name">Project name</Label>
        <Input
          id="p-name"
          required
          className="h-12"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Solar Tracking Panel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-desc">Description</Label>
        <Textarea
          id="p-desc"
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you building and why?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-members">Invite team members</Label>
        <Input
          id="p-members"
          className="h-12"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
        />
        {matches.length > 0 && (
          <ul className="card-surface divide-y divide-border overflow-hidden">
            {matches.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => {
                    setMembers((prev) => [...prev, student]);
                    setQuery("");
                  }}
                  className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{student.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {student.department}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {members.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() =>
                    setMembers((prev) => prev.filter((m) => m.id !== member.id))
                  }
                  aria-label={`Remove ${member.name}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
                >
                  {member.name}
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-mentor">Faculty mentor</Label>
        <Select value={mentor} onValueChange={setMentor}>
          <SelectTrigger id="p-mentor" className="h-12 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {facultyMentors.map((m) => (
              <SelectItem key={m} value={m} className="min-h-11">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(Object.keys(resourceOptions) as Array<keyof typeof resourceOptions>).map(
        (group) => (
          <div key={group} className="space-y-2">
            <Label>{group} required</Label>
            <ul className="flex flex-wrap gap-2">
              {resourceOptions[group].map((item) => {
                const active = resources.includes(item);
                return (
                  <li key={item}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleResource(item)}
                      className={cn(
                        "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-accent",
                      )}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}

      <button
        type="submit"
        className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Submit for Verification
      </button>
    </form>
  );
}
