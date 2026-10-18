import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({ component: LoginRedirect });

/**
 * There is no separate sign-in screen any more — signing in happens on the
 * homepage. This route stays only so existing links, bookmarks and the
 * "sign in required" prompts elsewhere still resolve somewhere sensible
 * instead of 404ing.
 */
function LoginRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return null;
}
