import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type GoogleCredentialResponse = { credential?: string };

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      hd: string;
      auto_select: boolean;
      cancel_on_tap_outside: boolean;
    }) => void;
    renderButton: (
      parent: HTMLElement,
      options: {
        type: "standard";
        theme: "outline";
        size: "large";
        text: "signin_with";
        shape: "pill";
        width: number;
      },
    ) => void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

let googleScriptPromise: Promise<void> | null = null;
let googleConfigPromise: ReturnType<typeof authApi.googleConfig> | null = null;
let initializedGoogleClientId: string | null = null;
let activeCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

function loadGoogleConfig() {
  if (!googleConfigPromise) {
    googleConfigPromise = authApi.googleConfig().catch((error) => {
      googleConfigPromise = null;
      throw error;
    });
  }
  return googleConfigPromise;
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]',
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Google sign-in failed to load")),
          {
            once: true,
          },
        );
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google sign-in failed to load"));
      document.head.append(script);
    }).catch((error) => {
      googleScriptPromise = null;
      throw error;
    });
  }
  return googleScriptPromise;
}

export function GoogleSignInButton({
  onSuccess,
}: {
  onSuccess: (next: "dashboard" | "onboarding") => void;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { signInWithGoogleCredential } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ data: config }] = await Promise.all([
          loadGoogleConfig(),
          loadGoogleIdentityServices(),
        ]);
        if (cancelled || !buttonRef.current || !window.google) return;
        const credentialHandler = (response: GoogleCredentialResponse) => {
          if (!response.credential) {
            setError("Google did not return a sign-in credential. Please try again.");
            return;
          }
          setSubmitting(true);
          setError("");
          void signInWithGoogleCredential(response.credential)
            .then(onSuccess)
            .catch((cause: unknown) => {
              setError(
                cause instanceof ApiError
                  ? cause.message
                  : "Sign-in could not be completed. Please try again.",
              );
            })
            .finally(() => setSubmitting(false));
        };
        activeCredentialHandler = credentialHandler;
        if (initializedGoogleClientId !== config.clientId) {
          window.google.accounts.id.initialize({
            client_id: config.clientId,
            hd: config.hostedDomain,
            auto_select: false,
            cancel_on_tap_outside: true,
            callback: (response) => activeCredentialHandler?.(response),
          });
          initializedGoogleClientId = config.clientId;
        }
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: Math.min(360, Math.max(240, buttonRef.current.clientWidth || 320)),
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError("Google sign-in failed to load. Check your connection and try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
      activeCredentialHandler = null;
    };
  }, [onSuccess, signInWithGoogleCredential]);

  return (
    <div className="w-full">
      <div className="relative flex min-h-11 w-full items-center justify-center">
        <div ref={buttonRef} className={submitting ? "pointer-events-none opacity-50" : ""} />
        {(loading || submitting) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-card text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            {submitting ? "Verifying account..." : "Loading Google sign-in..."}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-center text-xs leading-5 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
