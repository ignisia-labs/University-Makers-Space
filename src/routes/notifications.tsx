import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMakerSpace } from "@/lib/makerspace-context";

export const Route = createFileRoute("/notifications")({ component: NotificationsRedirect });

const roleHomes = {
  Student: "/dashboard",
  "Faculty Mentor": "/faculty",
  "Lab Assistant": "/operations",
  Admin: "/admin",
  "Super Admin": "/super-admin",
} as const;

function NotificationsRedirect() {
  const navigate = useNavigate();
  const { role } = useMakerSpace();
  const destination = roleHomes[role];

  useEffect(() => {
    void navigate({ to: destination, replace: true });
  }, [destination, navigate]);

  return null;
}
