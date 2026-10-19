import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { readableError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { personas, resetDemoState } from "@/mocks/server";

/**
 * Sign-in for the static demo build.
 *
 * The published demo has no backend, so Google's ID-token flow cannot be
 * completed — there is nothing to verify the token against. Instead a visitor
 * picks the role they want to look around as, and the mock API answers as that
 * person from the captured production data.
 *
 * In `overlay` mode this takes the place of Google's invisible button inside
 * the hero control, so the homepage keeps its own design and the click opens
 * the role chooser.
 */
export function DemoSignIn({
  onSuccess,
  overlay = false,
  onError,
}: {
  onSuccess: (destination: string) => void;
  overlay?: boolean;
  onError?: ((message: string) => void) | undefined;
}) {
  const { signInWithGoogleCredential } = useAuth();
  const [open, setOpen] = useState(!overlay);
  const [busy, setBusy] = useState("");

  const choose = (role: string) => {
    setBusy(role);
    void signInWithGoogleCredential(`demo:${role}`)
      .then((destination) => onSuccess(destination))
      .catch((cause: unknown) => {
        onError?.(readableError(cause, "Could not open the demo. Please try again."));
      })
      .finally(() => setBusy(""));
  };

  const list = (
    <div className="flex w-full flex-col gap-2">
      {personas.map((persona) => (
        <button
          key={persona.role}
          type="button"
          onClick={() => choose(persona.role)}
          disabled={Boolean(busy)}
          className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-left transition hover:border-white/35 hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
        >
          <span>
            <span className="block text-sm font-medium text-white">{persona.label}</span>
            <span className="block text-xs leading-5 text-white/65">{persona.description}</span>
          </span>
          {busy === persona.role ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin text-white" />
          ) : (
            <span
              aria-hidden="true"
              className="shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/80"
            >
              →
            </span>
          )}
        </button>
      ))}
    </div>
  );

  if (!overlay) {
    return (
      <div className="w-full">
        <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          Demo — choose a role
        </p>
        {list}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open the demo"
        onClick={() => setOpen(true)}
        className="absolute inset-0 z-20 cursor-pointer rounded-full opacity-0"
      />
      {/* Rendered into <body> rather than in place.
          The hero button this sits inside carries `backdrop-filter: blur()`,
          and a filtered element becomes the containing block for any `fixed`
          descendant — so the dialog was being positioned against the button
          instead of the viewport, and then clipped by its `overflow-hidden`.
          It showed up as a sliver of text across the button. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Choose a demo role"
            onClick={() => !busy && setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900/95 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-center text-base font-medium text-white">Explore the demo</h2>
              <p className="mt-1.5 mb-5 text-center text-xs leading-5 text-white/60">
                A preview with no live backend. Pick a role to look around as.
                Open a second tab as another role and they share the same data
                — create a project as the Student and it is waiting for Jyoti
                Mante in the Faculty tab.
              </p>
              {list}
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={Boolean(busy)}
                  className="cursor-pointer rounded-lg px-3 py-2 text-xs text-white/50 transition hover:text-white/80 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetDemoState();
                    window.location.reload();
                  }}
                  disabled={Boolean(busy)}
                  className="cursor-pointer rounded-lg px-3 py-2 text-xs text-white/40 transition hover:text-white/70 disabled:opacity-40"
                >
                  Reset demo data
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
