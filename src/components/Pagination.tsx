import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * Page navigation for a server-paged list.
 *
 * It states the range and the total rather than only offering arrows, because
 * the thing a person actually wants to know is whether what they are looking
 * for is even on this page. Hidden entirely when everything fits on one.
 */
export function Pagination({
  meta,
  onPage,
  busy,
  noun = "items",
}: {
  meta: PageMeta | undefined;
  onPage: (page: number) => void;
  busy?: boolean;
  noun?: string;
}) {
  if (!meta || meta.totalPages <= 1) return null;

  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 pt-2"
      aria-label={`${noun} pages`}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {first}–{last} of {meta.total} {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={!meta.hasPrev || busy}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Previous page"
          className="pressable grid size-9 place-items-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className={cn("px-2 font-mono text-xs", busy && "opacity-50")}>
          {meta.page} / {meta.totalPages}
        </span>
        <button
          type="button"
          disabled={!meta.hasNext || busy}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
          className="pressable grid size-9 place-items-center rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
