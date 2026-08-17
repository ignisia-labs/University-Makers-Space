import { ArrowUpRight, type LucideIcon } from "lucide-react";

export type DashboardQuickAction = {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
};

export function DashboardQuickActions({ actions }: { actions: DashboardQuickAction[] }) {
  return (
    <section className="mt-6" aria-labelledby="role-quick-actions-title">
      <h2 id="role-quick-actions-title" className="mb-3 text-base font-semibold">
        Quick actions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.slice(0, 4).map(({ label, description, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="card-surface group flex min-h-36 flex-col justify-between p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg active:translate-y-0"
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
