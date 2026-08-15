// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // This repository ships the frontend only. Backend deployment packaging is owned
  // by the backend team and is intentionally not part of the frontend build.
  nitro: false,
  vite: {
    // Keep symlinked dependency paths intact. This avoids generated imports resolving
    // through the workspace's apostrophe-containing absolute path during Nitro builds.
    resolve: { preserveSymlinks: true },
    // Some desktop/workspace file systems do not reliably emit native watch events.
    // Polling keeps HMR dependable so source changes appear without restarting Vite.
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      watch: { usePolling: true, interval: 300 },
    },
  },
  tanstackStart: {
    router: {
      // TanStack Start always registers the splitter. Keep route modules whole so
      // it does not emit invalid dynamic imports for this apostrophe-containing path.
      codeSplittingOptions: { defaultBehavior: [] },
    },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
