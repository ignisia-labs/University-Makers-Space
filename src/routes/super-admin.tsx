import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/super-admin")({ component: SuperAdminRoute });

/**
 * Governance lives in the administration console. This path is kept only so
 * existing links and bookmarks resolve.
 */
function SuperAdminRoute() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/admin", replace: true });
  }, [navigate]);
  return null;
}
