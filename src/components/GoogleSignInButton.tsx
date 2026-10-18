import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { authApi, readableError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
// The static demo has no API to verify a Google credential against, so the
// role chooser stands in for the real flow. See `demoMode` for why it is on
// by default.
import { demoMode as DEMO_MODE } from "@/mocks/server";
import { DemoSignIn } from "./DemoSignIn";

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
    prompt: () => void;
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
  autoPrompt = false,
  overlay = false,
  onError,
}: {
  /** Receives the path the signed-in account should be taken to. */
  onSuccess: (destination: string) => void;
  /**
   * Renders Google's button invisibly, stretched to fill the nearest
   * positioned ancestor, so a custom-designed button can sit underneath and
   * still receive a genuine Google click.
   *
   * This exists because the ID-token flow only issues a credential from
   * Google's own rendered button or from One Tap. Wiring a custom button to
   * `prompt()` instead looks the same but breaks quietly: Google suppresses
   * One Tap after a recent dismissal, when a browser blocks third-party
   * sign-in, or when there is no Google session — and the click would simply
   * do nothing, with no callback to detect it. Keeping the real button as the
   * hit target means the click always works; only its appearance is ours.
   */
  overlay?: boolean;
  /**
   * Opens Google's account chooser as soon as the page is ready, so a person
   * landing on the sign-in page does not have to click first.
   *
   * The rendered button stays as the fallback and is never removed: Google
   * suppresses this prompt on its own terms — a recent dismissal, a browser
   * with third-party sign-in disabled, or no Google session at all — and there
   * is no reliable callback for that. Auto-clicking the button instead would be
   * blocked as an untrusted popup.
   */
  autoPrompt?: boolean;
  /**
   * Reports a sign-in failure to the parent.
   *
   * In overlay mode the component lives *inside* the host button, which clips
   * its children (the shimmer effect needs `overflow-hidden`). Anything this
   * component renders below itself is therefore invisible, so the message has
   * to be handed outward and drawn by whoever owns the layout.
   */
  onError?: ((message: string) => void) | undefined;
}) {
  if (DEMO_MODE) {
    return <DemoSignIn onSuccess={onSuccess} overlay={overlay} onError={onError} />;
  }
  return <GoogleButton onSuccess={onSuccess} autoPrompt={autoPrompt} overlay={overlay} onError={onError} />;
}

function GoogleButton({
  onSuccess,
  autoPrompt = false,
  overlay = false,
  onError,
}: {
  onSuccess: (destination: string) => void;
  overlay?: boolean;
  autoPrompt?: boolean;
  onError?: ((message: string) => void) | undefined;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { signInWithGoogleCredential } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setErrorState] = useState("");
  const setError = (message: string) => {
    setErrorState(message);
    if (message) onErrorRef.current?.(message);
  };

  /**
   * The callbacks are held in refs, and deliberately kept out of the effect's
   * dependencies.
   *
   * Google is handed one long-lived callback at `initialize()` time which
   * dispatches through the module-level `activeCredentialHandler`. If this
   * effect re-ran on every render — which it did while `onSuccess` was an
   * inline arrow from the parent — its cleanup would null that handler, and any
   * credential arriving in the gap before re-registration was dropped on the
   * floor by the `?.` call. The person was signed in to Google and the app
   * simply never heard about it: no error, no navigation, nothing.
   *
   * Refs keep the latest callbacks reachable while the effect runs exactly once
   * per mount, so the handler is never momentarily absent.
   */
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const signInRef = useRef(signInWithGoogleCredential);
  signInRef.current = signInWithGoogleCredential;

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
          void signInRef
            .current(response.credential)
            .then((destination) => onSuccessRef.current(destination))
            .catch((cause: unknown) => {
              setError(readableError(cause, "Sign-in could not be completed. Please try again."));
            })
            .finally(() => setSubmitting(false));
        };
        activeCredentialHandler = credentialHandler;
        if (import.meta.env.DEV) {
          // Dev-only probe. The Google credential itself cannot be forged, so
          // this is the only way to drive the post-credential path — error
          // rendering, the submitting state, the navigation hand-off — without
          // a real Google account. It is stripped from production builds.
          (window as unknown as Record<string, unknown>)["__umsCredentialProbe"] =
            credentialHandler;
        }
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
        const host = overlay ? overlayRef.current?.parentElement : null;
        const hostWidth = host?.clientWidth ?? 0;
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: overlay
            ? Math.min(400, Math.max(200, hostWidth || 320))
            : Math.min(360, Math.max(240, buttonRef.current.clientWidth || 320)),
        });
        if (overlay && host) {
          // Google's button is a fixed ~40px tall; the button underneath is
          // taller. A CSS transform is used rather than width/height overrides
          // because the clickable region lives inside Google's iframe and does
          // not stretch with it — but hit-testing *does* follow a transform, so
          // scaling grows the real click target to cover the whole control.
          // The distortion is invisible: the overlay is fully transparent.
          const rendered = buttonRef.current.firstElementChild as HTMLElement | null;
          const naturalHeight = rendered?.getBoundingClientRect().height ?? 0;
          if (rendered && naturalHeight > 0) {
            const scaleY = host.clientHeight / naturalHeight;
            rendered.style.transformOrigin = "center";
            rendered.style.transform = `scaleY(${Math.max(1, scaleY).toFixed(3)})`;
          }
        }
        setLoading(false);
        if (autoPrompt) window.google.accounts.id.prompt();
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
  }, [autoPrompt, overlay]);

  if (overlay) {
    // The click target is transparent, but progress and failure must not be.
    // An earlier version returned only the invisible layer, so a rejected
    // sign-in — a disabled account, a clashing identity — produced no error, no
    // spinner and no navigation. It looked exactly like a dead button, and the
    // real reason was sitting unread in the API response.
    return (
      <>
        <div
          ref={overlayRef}
          className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-full opacity-0"
        >
          <div ref={buttonRef} className={submitting ? "pointer-events-none" : ""} />
        </div>
        {submitting && (
          <span className="absolute inset-0 z-30 flex items-center justify-center gap-2 rounded-full bg-black/55 text-xs font-medium tracking-normal text-white backdrop-blur-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Verifying account…
          </span>
        )}
      </>
    );
  }

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
