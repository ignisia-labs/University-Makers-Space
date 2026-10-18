import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { roleHomes, useAppSession } from "@/lib/auth-context";

export const Route = createFileRoute("/notifications")({ component: NotificationsRedirect });

/**
 * Notifications are read from the bell in the app shell, which is backed by the
 * real notification API. This path only exists so older links resolve, and it
 * sends people to the workspace their *actual* role owns — reading the role
 * from the session, which always reports
 * "Student" and would strand every member of staff on a page they cannot open.
 */
function NotificationsRedirect() {
  const navigate = useNavigate();
  const { role } = useAppSession();

  useEffect(() => {
    void navigate({ to: roleHomes[role], replace: true });
  }, [role, navigate]);

  return null;
}
