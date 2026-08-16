import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { destinationForUser } from "@/lib/auth-client";

function waitForGoogle(signal: AbortSignal) {
  if (window.google?.accounts.id) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.getElementById("google-identity-services");
    if (!script) {
      reject(new Error("Google Sign-In is not configured on this page."));
      return;
    }
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };
    const handleLoad = () => {
      cleanup();
      if (window.google?.accounts.id) {
        resolve();
      } else {
        reject(new Error("Google Sign-In could not be initialized."));
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Google Sign-In could not be loaded."));
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Sign-In took too long to load."));
    }, 10_000);
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

export function GoogleSignInButton({ inviteProjectId }: { inviteProjectId?: string }) {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement>(null);
  const { client, status: sessionStatus, user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "signing-in" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const handleCredential = useCallback(
    async (credential: string) => {
      setStatus("signing-in");
      setError(null);
      try {
        const csrfToken = await client.createLoginCsrf();
        const result = await client.signInWithGoogle(credential, csrfToken);
        if (inviteProjectId && result.user.roles.includes("STUDENT")) {
          await navigate(
            result.user.profileComplete
              ? { to: "/invitations/$projectId", params: { projectId: inviteProjectId } }
              : { to: "/onboarding", search: { invite: inviteProjectId } },
          );
        } else {
          await navigate({ to: destinationForUser(result.user) });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sign-in could not be completed.");
        setStatus("error");
      }
    },
    [client, inviteProjectId, navigate],
  );

  useEffect(() => {
    const abortController = new AbortController();
    const initialize = async () => {
      if (sessionStatus === "authenticated") return;
      setStatus("loading");
      setError(null);
      try {
        const [config] = await Promise.all([
          client.getGoogleConfig(),
          waitForGoogle(abortController.signal),
        ]);
        if (abortController.signal.aborted || !buttonRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          hd: config.hostedDomain,
          ux_mode: "popup",
          context: "signin",
          itp_support: true,
          callback: (response) => void handleCredential(response.credential),
        });
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(360, buttonRef.current.clientWidth || 360),
        });
        setStatus("ready");
      } catch (cause) {
        if (abortController.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Google Sign-In could not be loaded.");
        setStatus("error");
      }
    };
    void initialize();
    return () => abortController.abort();
  }, [attempt, client, handleCredential, sessionStatus]);

  if (sessionStatus === "authenticated" && user) {
    return (
      <button
        id="institutional-sign-in"
        type="button"
        onClick={() => {
          if (inviteProjectId && user.roles.includes("STUDENT")) {
            void navigate(
              user.profileComplete
                ? { to: "/invitations/$projectId", params: { projectId: inviteProjectId } }
                : { to: "/onboarding", search: { invite: inviteProjectId } },
            );
            return;
          }
          void navigate({ to: destinationForUser(user) });
        }}
        className="inline-flex min-h-12 w-full max-w-[360px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Continue as {user.name}
      </button>
    );
  }

  return (
    <div id="institutional-sign-in" className="w-full max-w-[360px]" aria-live="polite">
      <div
        ref={buttonRef}
        className={
          status === "loading"
            ? "pointer-events-none min-h-11 opacity-0"
            : status === "signing-in"
              ? "pointer-events-none min-h-11 opacity-60"
              : "min-h-11"
        }
      />
      {(status === "loading" || status === "signing-in") && (
        <div className="flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {status === "loading" ? "Preparing secure sign-in…" : "Signing you in…"}
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry sign-in
          </button>
        </div>
      )}
      {status === "ready" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Use your verified @mitwpu.edu.in Google account.
        </p>
      )}
    </div>
  );
}
