import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import type { DirectoryUser } from "@/lib/project-types";

export function MentorSelect({
  value,
  onValueChange,
}: {
  value: DirectoryUser | null;
  onValueChange: (value: DirectoryUser | null) => void;
}) {
  const { client } = useAuth();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const results = useQuery({
    queryKey: ["directory", "faculty-mentors", term],
    queryFn: () =>
      client.api.requestPage<DirectoryUser[]>(
        `/users/search/faculty-mentors?search=${encodeURIComponent(term)}&limit=8`,
      ),
    enabled: term.length >= 2 && !value,
    staleTime: 30_000,
  });

  return (
    <section className="space-y-3" aria-labelledby="mentor-heading">
      <div>
        <Label id="mentor-heading" htmlFor="p-mentor">
          Faculty Mentor
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Only Faculty Mentors authorized by MIT-WPU appear here.
        </p>
      </div>
      {value ? (
        <div className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4">
          <span className="flex min-w-0 items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{value.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => onValueChange(null)}
            aria-label={`Change Faculty Mentor from ${value.name}`}
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              id="p-mentor"
              type="search"
              className="h-12 pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search mentor by name or university email"
              autoComplete="off"
            />
          </div>
          {term.length > 0 && term.length < 2 && (
            <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
          )}
          {results.isFetching && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Searching Faculty Mentors…
            </p>
          )}
          {term.length >= 2 && !results.isFetching && (
            <ul className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-1">
              {(results.data?.data ?? []).length ? (
                results.data!.data.map((mentor) => (
                  <li key={mentor.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onValueChange(mentor);
                        setSearch("");
                        setTerm("");
                      }}
                      className="min-h-14 w-full rounded-lg px-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block truncate text-sm font-semibold">{mentor.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {mentor.email}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="p-3 text-sm text-muted-foreground">
                  No authorized Faculty Mentor found.
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
