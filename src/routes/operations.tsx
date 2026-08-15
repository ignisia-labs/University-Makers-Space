import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useMakerSpace } from "@/lib/makerspace-context";
import { requireRoles } from "@/lib/auth-guards";
export const Route = createFileRoute("/operations")({
  beforeLoad: requireRoles("LAB_ASSISTANT"),
  component: Operations,
});
function Operations() {
  const { reservations, equipment, updateVisit, addVisit, updateEquipment, markReservationNoShow } =
    useMakerSpace();
  const active = reservations.filter((r) => r.status === "Active");
  const present = active.reduce((sum, r) => sum + r.attendees, 0);
  return (
    <AppShell title="Live operations" subtitle="Lab Assistant console">
      <section className="card-surface grid gap-4 p-6 sm:grid-cols-3">
        <div>
          <p className="text-3xl font-bold">{present} / 20</p>
          <p className="text-sm text-muted-foreground">Expected occupancy</p>
        </div>
        <div>
          <p className="text-3xl font-bold">{active.length}</p>
          <p className="text-sm text-muted-foreground">Active teams</p>
        </div>
        <div>
          <p className="text-3xl font-bold">
            {equipment.filter((e) => e.status !== "Available").length}
          </p>
          <p className="text-sm text-muted-foreground">Equipment alerts</p>
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Expected teams</h2>
        <div className="space-y-3">
          {active.map((booking) => (
            <article key={booking.id} className="card-surface p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{booking.projectName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {booking.attendees} expected · {booking.slot}
                  </p>
                </div>
                <StatusBadge label={booking.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    addVisit({
                      type: "Project Slot",
                      title: booking.projectName,
                      date: booking.date,
                      entry: new Date().toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      exit: null,
                      status: "Active",
                    })
                  }
                  className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Mark team entered
                </button>
                <button
                  onClick={() =>
                    updateVisit("v1", {
                      exit: new Date().toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      status: "Completed",
                    })
                  }
                  className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
                >
                  Mark exited
                </button>
                <button
                  onClick={() => markReservationNoShow(booking.id)}
                  className="min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive"
                >
                  Mark no-show
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Equipment status</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {equipment.map((item) => (
            <article
              key={item.id}
              className="card-surface flex items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-semibold">{item.name}</p>
                <StatusBadge label={item.status} />
              </div>
              <button
                onClick={() =>
                  updateEquipment(item.id, {
                    status: item.status === "Available" ? "Under Maintenance" : "Available",
                  })
                }
                className="min-h-10 rounded-xl border px-3 text-xs font-semibold"
              >
                Toggle status
              </button>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
