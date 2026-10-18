import { useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { notificationsApi, projectsApi } from "./api";

export const projectKeys = {
  all: ["persisted-projects"] as const,
  list: (params?: Record<string, string>) => ["persisted-projects", "list", params ?? {}] as const,
  detail: (id: string) => ["persisted-projects", "detail", id] as const,
  notifications: ["persisted-notifications"] as const,
};

export function usePersistedProjects(params?: Record<string, string>, enabled = true) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.list({ page: "1", limit: "50", ...params }).then((r) => r.data),
    enabled,
  });
}

export function usePersistedProjectPages(params?: Record<string, string>, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...projectKeys.list(params), "pages"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      projectsApi.list({ page: String(pageParam), limit: "50", ...params }),
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? lastPage.meta.page + 1 : undefined),
    enabled,
  });
}

export function usePersistedProject(id: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.get(id).then((r) => r.data),
    enabled: enabled && Boolean(id),
  });
}

export function usePersistedNotifications(enabled = true) {
  return useQuery({
    queryKey: projectKeys.notifications,
    queryFn: () => notificationsApi.list({ page: "1", limit: "50" }).then((r) => r.data),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });
}

export async function invalidateProjectData(queryClient: QueryClient, projectId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectKeys.all }),
    queryClient.invalidateQueries({ queryKey: projectKeys.notifications }),
    ...(projectId
      ? [queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })]
      : []),
  ]);
}

export const projectStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  TEAM_ACCEPTANCE_PENDING: "Team Acceptance Pending",
  MENTOR_APPROVAL_PENDING: "Mentor Approval Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export function projectStatusLabel(status: string) {
  return projectStatusLabels[status] ?? status;
}

export function invitationStatusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
