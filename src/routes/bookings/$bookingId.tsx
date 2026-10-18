import { createFileRoute } from "@tanstack/react-router";
import { PersistedBookingDetail } from "@/components/Booking/PersistedBookingDetail";

export const Route = createFileRoute("/bookings/$bookingId")({
  head: () => ({
    meta: [
      { title: "Booking details — सृजन" },
      { name: "description", content: "Review a MakerSpace booking and its selected team." },
    ],
  }),
  component: BookingDetailsRoute,
});

function BookingDetailsRoute() {
  const { bookingId } = Route.useParams();
  return <PersistedBookingDetail bookingId={bookingId} />;
}
