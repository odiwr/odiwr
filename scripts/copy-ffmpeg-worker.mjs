// Copies ffmpeg.wasm's browser files into public/ffmpeg/, to be served as they are.
//
// Run with `npm run ffmpeg:worker` after upgrading @ffmpeg/ffmpeg. None of it
// can go through the bundler:
//   - the worker loads ffmpeg's core with a dynamic import of a URL; bundled,
//     that import is rewritten and fails ("expression is too dynamic")
//   - the entry (classes.js) starts that worker from a URL known only at run
//     time, which Turbopack refuses to build at all from Next 16.4
// so the dashboard (src/components/dashboard/media.ts) imports index.js from
// here, and points it at the worker here. It has to be on the site's own
// origin: a worker cannot be started from another one. Seven small files; the
// 30 MB core itself is fetched from a CDN at the moment it is needed.

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const to = join(root, "public/ffmpeg");

await mkdir(to, { recursive: true });
for (const file of ["index.js", "classes.js", "types.js", "utils.js", "worker.js", "const.js", "errors.js"]) {
  await copyFile(join(from, file), join(to, file));
}
console.log(`Copied the ffmpeg worker to ${to}`);
