import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * The image that link previews show, on Cloudinary.
 *
 * It is a frame of the hero film with the name laid over it, composed by the
 * transformation in this URL rather than stored as a separate file — so it
 * cannot drift out of step with the site the way the previous one had. That
 * was a screenshot of a long-dead Lovable preview, still being served from
 * Lovable's bucket, which is why every shared link showed a page that no
 * longer existed.
 */
const socialPreviewImage =
  "https://res.cloudinary.com/b8aehfw4/video/upload/" +
  "so_3,w_1280,h_700,c_fill,g_north/e_brightness:-25/" +
  "l_text:Arial_76_bold:MIT-WPU%20MakerSpace,co_white,g_south_west,x_70,y_150/" +
  "l_text:Arial_40:Book%20slots%20%C2%B7%20Manage%20projects%20%C2%B7%20Explore%20equipment," +
  "co_rgb:d8d8e8,g_south_west,x_72,y_95/" +
  "c_crop,w_1200,h_630,g_north/q_auto/srijan/landing/hero.jpg";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "सृजन — MIT-WPU MakerSpace" },
      {
        name: "description",
        content:
          "Book slots, manage projects and explore 3D printing, laser, electronics and robotics equipment at the MIT-WPU MakerSpace.",
      },
      { name: "theme-color", content: "#4338ca" },
      { property: "og:title", content: "सृजन — MIT-WPU MakerSpace" },
      {
        property: "og:description",
        content:
          "Book slots, manage projects and explore 3D printing, laser, electronics and robotics equipment at the MIT-WPU MakerSpace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "सृजन — MIT-WPU MakerSpace" },
      {
        name: "twitter:description",
        content:
          "Book slots, manage projects and explore 3D printing, laser, electronics and robotics equipment at the MIT-WPU MakerSpace.",
      },
      { property: "og:image", content: socialPreviewImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "A laser cutter at work in the MIT-WPU MakerSpace" },
      { name: "twitter:image", content: socialPreviewImage },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // Tiro Devanagari Hindi carries the सृजन wordmark. It is a true serif
        // Devanagari, so it sits alongside Cormorant Garamond without the
        // wordmark falling back to a system sans and losing the editorial feel.
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Tiro+Devanagari+Hindi:ital@0;1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
