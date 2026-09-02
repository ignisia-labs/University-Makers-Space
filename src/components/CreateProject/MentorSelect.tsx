import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi, type FacultyDirectoryResult } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { mentorLabel } from "@/lib/mentor";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Faculty mentor picker.
 *
 * The directory is *browsable*, not search-only. A student choosing a mentor
 * frequently does not know the exact spelling — or even the name — so opening
 * the list shows every mentor, grouped under their initial. Typing narrows it.
 *
 * Filtering happens on the server (`shouldFilter={false}` turns cmdk's local
 * matching off) so the list stays correct when the directory is larger than one
 * page; the footer says so explicitly rather than silently truncating.
 */
export function MentorSelect({
  value,
  onChange,
  disabled,
}: {
  value: FacultyDirectoryResult | null;
  onChange: (mentor: FacultyDirectoryResult | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 250);

  const mentors = useQuery({
    queryKey: ["faculty-directory", debounced],
    queryFn: () => usersApi.searchFacultyMentors(debounced),
    // Fetch only once the popover has been opened, but do not gate on a
    // minimum term — an empty term is the "show me everyone" case.
    enabled: open,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => mentors.data?.data ?? [], [mentors.data]);
  const total = mentors.data?.meta?.total ?? rows.length;

  // Group alphabetically. The server already sorts by name, so a single pass
  // preserves that order within each letter.
  const groups = useMemo(() => {
    const byLetter = new Map<string, FacultyDirectoryResult[]>();
    for (const row of rows) {
      // Group on the name, never the honorific: with "Dr." and "Mr." in front of
      // everyone, initials would collapse four hundred people into D and M.
      const letter = (row.name.replace(/^\W+/, "")[0] ?? "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      const bucket = byLetter.get(key);
      if (bucket) bucket.push(row);
      else byLetter.set(key, [row]);
    }
    return [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="space-y-2">
      <label id="mentor-select-label" className="block text-sm font-semibold">
        Faculty mentor
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-labelledby="mentor-select-label"
            aria-expanded={open}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-transparent px-3 text-left text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-45"
          >
            {value ? (
              <span className="min-w-0">
                <span className="block truncate font-semibold">{mentorLabel(value)}</span>
                <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Select a faculty mentor</span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          // Never taller than the room actually available. Radix reports that
          // as a CSS variable; without it the list ran off the bottom of the
          // screen inside a modal, hiding both the results and the fact that
          // the field above them was a search box.
          className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] flex-col p-0"
          align="start"
          collisionPadding={12}
        >
          <Command shouldFilter={false} className="flex min-h-0 flex-col">
            <CommandInput
              placeholder="Search by name or university email"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="min-h-0 flex-1">
              {mentors.isPending ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading faculty…
                </div>
              ) : mentors.isError ? (
                <div className="px-3 py-6 text-sm text-destructive">
                  Could not load the faculty directory.{" "}
                  <button
                    type="button"
                    onClick={() => void mentors.refetch()}
                    className="font-semibold underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {search.trim()
                      ? `No faculty mentor matches “${search.trim()}”.`
                      : "No faculty mentors have been added yet. Ask an administrator to import the faculty list."}
                  </CommandEmpty>
                  {groups.map(([letter, entries]) => (
                    <CommandGroup key={letter} heading={letter}>
                      {entries.map((mentor) => (
                        <CommandItem
                          key={mentor.id}
                          value={mentor.id}
                          onSelect={() => {
                            onChange(mentor);
                            setSearch("");
                            setOpen(false);
                          }}
                          className="gap-2"
                        >
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              value?.id === mentor.id ? "opacity-100" : "opacity-0",
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {mentorLabel(mentor)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {mentor.email}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              )}
            </CommandList>
            {rows.length > 0 && total > rows.length && (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Showing {rows.length} of {total} — type to narrow the list.
              </p>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs font-semibold text-primary"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
