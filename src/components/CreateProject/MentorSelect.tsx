import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { facultyMentors } from "@/lib/makerspace-data";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MentorSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label id="p-mentor-label">Faculty mentor</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-labelledby="p-mentor-label"
            aria-expanded={open}
            className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 text-left text-sm shadow-xs outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || "Search faculty mentors"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name or department" />
            <CommandList>
              <CommandEmpty>No faculty mentor found.</CommandEmpty>
              <CommandGroup>
                {facultyMentors.map((mentor) => (
                  <CommandItem
                    key={mentor}
                    value={mentor}
                    onSelect={() => {
                      onValueChange(mentor);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("size-4", value === mentor ? "opacity-100" : "opacity-0")}
                    />
                    {mentor}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
