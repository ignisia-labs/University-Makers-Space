import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSkeleton() {
  return <div className="card-surface h-64 animate-pulse bg-muted/40" aria-busy="true" />;
}

export function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card-surface p-8 text-center">
      <AlertCircle className="mx-auto h-7 w-7 text-warning" aria-hidden />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs transition hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  type?: string | undefined;
  required?: boolean | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}

export function SubmitButton({
  busy,
  disabled,
  label,
  full = false,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  full?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={busy}
      className={cn(
        "rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40",
        full && "w-full py-2.5 text-sm",
      )}
    >
      {busy ? "Saving…" : label}
    </button>
  );
}

export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-40"
      >
        Previous
      </button>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Page {page} of {Math.max(1, totalPages)}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
