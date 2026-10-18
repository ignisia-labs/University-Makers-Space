/**
 * Give the SPA shell the name a static host expects.
 *
 * TanStack Start writes the prerendered shell as `_shell.html`. Netlify (and
 * every other static host) looks for `index.html`, both to serve `/` and as the
 * target of the single-page fallback. Copying rather than renaming keeps the
 * build output valid for either name.
 */
import { copyFile, access } from "node:fs/promises";
import { join } from "node:path";

const clientDir = join(process.cwd(), "dist", "client");
const shell = join(clientDir, "_shell.html");
const index = join(clientDir, "index.html");

try {
  await access(shell);
} catch {
  console.error(
    "[build] dist/client/_shell.html is missing — SPA mode did not run. " +
      "Check `tanstackStart.spa` in vite.config.ts before deploying.",
  );
  process.exit(1);
}

await copyFile(shell, index);
console.log("[build] dist/client/index.html written from the SPA shell.");
