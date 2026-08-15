import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { AuthClient } from "./lib/auth-client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  const authClient = new AuthClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, authClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
