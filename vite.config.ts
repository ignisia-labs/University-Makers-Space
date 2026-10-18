// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // This repository ships the frontend only. The API is deployed separately, and
  // the app is a static SPA, so there is no server runtime to build here.
  nitro: false,
  vite: {
    // Keep symlinked dependency paths intact. This avoids generated imports resolving
    // through the workspace's apostrophe-containing absolute path during Nitro builds.
    resolve: { preserveSymlinks: true },

    // ─── Exclude the backend folder from ALL Vite scanning ────────────────────
    // The backend/ folder lives inside the project root, but it is a separate
    // Node.js/Express server with its own node_modules. Without this exclusion
    // Vite's SSR scanner imports backend modules (ioredis, @prisma/client, etc.)
    // into the browser/SSR bundle, causing ECONNREFUSED crashes and duplicate-React
    // errors. These three settings together fully isolate the backend folder.
    optimizeDeps: {
      exclude: [
        "ioredis",
        "@prisma/client",
        "bullmq",
        "prisma",
        "express",
        "pino",
        "pino-http",
        "jsonwebtoken",
        "google-auth-library",
        "cloudinary",
        "multer",
        "compression",
        "cookie-parser",
        "cors",
        "helmet",
        "hpp",
        "swagger-ui-express",
        "yaml",
        "tsx",
      ],
    },

    server: {
      host: "127.0.0.1",
      // Dev port. 5174 is not arbitrary: it is the origin registered against
      // this project's Google OAuth client, and Google rejects sign-in from any
      // origin it does not know. Changing it breaks sign-in until somebody with
      // Cloud Console access registers the new origin.
      //
      // Override for a one-off without editing this file:
      //   UMS_PORT=3000 npm run dev
      port: Number(process.env["UMS_PORT"] ?? 5174),
      strictPort: true,
      // Ignore the backend folder and its node_modules from HMR file watching.
      // This prevents ioredis / prisma / other Node.js-only packages from being
      // pulled into the Vite dependency graph when their files change.
      watch: {
        usePolling: true,
        interval: 300,
        ignored: [
          "**/backend/**",
          "**/backend/node_modules/**",
          "**/backend/dist/**",
          "**/backend/prisma/**",
        ],
      },
      // ─── API proxy ──────────────────────────────────────────────────────────
      // Forwards /api/* and /health to the Express backend (port 4000).
      // The frontend calls e.g. fetch("/api/v1/auth/me") — Vite transparently
      // routes it to Express during development, eliminating CORS issues.
      // Start the backend first: cd backend && npm run dev
      // ─────────────────────────────────────────────────────────────────────────
      proxy: {
        "/api": {
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
          secure: false,
        },
        "/health": {
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
  tanstackStart: {
    // ─── Ship a single-page app ───────────────────────────────────────────────
    // Nothing in this application is rendered from the server: every route
    // fetches its own data with the signed-in user's token, so a server render
    // would produce an empty shell and then re-fetch everything anyway. Building
    // as an SPA emits a real index.html, which is what a static host such as
    // Netlify needs, and removes the server runtime from the deployment.
    spa: { enabled: true },
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
