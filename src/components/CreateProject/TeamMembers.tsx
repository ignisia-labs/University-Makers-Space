import { useQuery } from "@tanstack/react-query";
import { MailPlus, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export function TeamMembers({
  members,
  onChange,
}: {
  members: string[];
  onChange: (members: string[]) => void;
}) {
  const { client, user } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const googleConfig = useQuery({
    queryKey: ["google-config"],
    queryFn: () => client.getGoogleConfig(),
    staleTime: 60 * 60_000,
  });
  const hostedDomain = googleConfig.data?.hostedDomain ?? "mitwpu.edu.in";

  const addEmail = () => {
    const normalized = email.trim().toLowerCase();
    const escapedDomain = hostedDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const validInstitutionalEmail = new RegExp(`^[^\\s@]+@${escapedDomain}$`, "i");
    if (!validInstitutionalEmail.test(normalized)) {
      setError(`Enter a valid @${hostedDomain} student email.`);
      return;
    }
    if (normalized === user?.email.toLowerCase()) {
      setError("You are already included automatically as Team Leader.");
      return;
    }
    if (members.includes(normalized)) {
      setError("This student is already in the invitation list.");
      return;
    }
    onChange([...members, normalized]);
    setEmail("");
    setError(null);
  };

  return (
    <section className="space-y-3" aria-labelledby="team-heading">
      <div>
        <Label id="team-heading" htmlFor="p-members">
          Team members <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter each teammate's MIT-WPU email. They can sign in and complete onboarding after
          opening the invitation. You are added automatically as Team Leader.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="p-members"
          type="email"
          className="h-12 flex-1"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addEmail();
            }
          }}
          placeholder={`student@${hostedDomain}`}
          autoComplete="email"
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={!email.trim()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-accent disabled:opacity-50"
        >
          <MailPlus className="size-4" /> Add teammate
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {members.length > 0 && (
        <ul className="space-y-2" aria-label="Students to invite">
          {members.map((memberEmail) => (
            <li
              key={memberEmail}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-muted px-3"
            >
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">
                  Invitation will be sent to
                </span>
                <span className="block truncate text-sm font-semibold">{memberEmail}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(members.filter((item) => item !== memberEmail))}
                aria-label={`Remove ${memberEmail}`}
                className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
