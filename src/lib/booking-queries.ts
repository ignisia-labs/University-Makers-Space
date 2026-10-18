import { useQuery, type QueryClient } from "@tanstack/react-query";
import { bookingsApi } from "./api";
import { projectKeys } from "./project-queries";

export type BookingScope = "upcoming" | "past";

export const bookingKeys = {
  all: ["persisted-bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (scope: BookingScope, page: number, limit: number) =>
    [...bookingKeys.lists(), { scope, page, limit }] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
};

export function usePersistedBookings(scope: BookingScope, page = 1, limit = 20, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.list(scope, page, limit),
    queryFn: () => bookingsApi.list({ scope, page: String(page), limit: String(limit) }),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled && scope === "upcoming" ? 30_000 : false,
  });
}

export function usePersistedBooking(id: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => bookingsApi.get(id).then((response) => response.data),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  });
}

export async function invalidateBookingData(
  queryClient: QueryClient,
  bookingId?: string,
  projectId?: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["availability-dates"] }),
    queryClient.invalidateQueries({ queryKey: ["daily-availability"] }),
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
    queryClient.invalidateQueries({ queryKey: projectKeys.notifications }),
    ...(bookingId
      ? [queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) })]
      : []),
    ...(projectId
      ? [queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })]
      : []),
  ]);
}
