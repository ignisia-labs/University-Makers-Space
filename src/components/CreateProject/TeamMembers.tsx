import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TeamMembers({
  emails,
  onChange,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const addEmail = () => {
    const email = value.trim().toLowerCase();
    if (!email) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid university email address.");
      return;
    }
    if (emails.includes(email)) {
      setError("This student has already been invited.");
      return;
    }
    onChange([...emails, email]);
    setValue("");
    setError("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addEmail();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="p-members">Invite team members</Label>
      <Input
        id="p-members"
        type="email"
        inputMode="email"
        className="h-12"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
        }}
        onBlur={addEmail}
        onKeyDown={onKeyDown}
        placeholder="student@mitwpu.edu.in"
        aria-describedby="team-member-help"
      />
      <p id="team-member-help" className="text-xs text-muted-foreground">
        Press Enter or comma to add an email. Invited students complete onboarding, if needed,
        before accepting and joining this project.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {emails.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Invited team members">
          {emails.map((email) => (
            <li key={email}>
              <button
                type="button"
                onClick={() => onChange(emails.filter((item) => item !== email))}
                aria-label={`Remove invitation for ${email}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
              >
                {email}
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
