// Copies ffmpeg.wasm's worker into public/ffmpeg/, to be served as it is.
//
// Run with `npm run ffmpeg:worker` after upgrading @ffmpeg/ffmpeg. The worker
// loads ffmpeg's core with a dynamic import of a URL; bundled, that import is
// rewritten and fails ("expression is too dynamic"), so the dashboard's cutter
// (src/components/dashboard/cut.ts) points ffmpeg at this unbundled copy
// instead. It has to be on the site's own origin: a worker cannot be started
// from another one. Three small files; the 30 MB core itself is fetched from a
// CDN at the moment it is needed.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const to = join(root, "public/ffmpeg");

await mkdir(to, { recursive: true });
for (const file of ["worker.js", "const.js", "errors.js"]) {
  await copyFile(join(from, file), join(to, file));
}
console.log(`Copied the ffmpeg worker to ${to}`);
