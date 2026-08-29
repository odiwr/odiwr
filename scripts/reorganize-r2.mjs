// Reorganises the R2 bucket into the shape this site's workflow expects.
//
//   npm run r2:plan     print what would move, change nothing   (default)
//   npm run r2:apply    actually move it
//
// A "move" on object storage is a copy followed by a delete. There is no undo
// unless the bucket has versioning turned on, so this refuses to do anything
// without the explicit apply flag.
//
// WHAT MOVES WHERE
//
//   brand/      the marks and cursors this site loads
//   work/       stills and clips attached to work entries
//   mp3/        the tracks the /mp3 project plays
//   archive/    everything from the old site not otherwise placed
//   site/       the content document (untouched)
//   uploads/    where the dashboard puts new files (untouched)
//
// ⚠ Anything still serving the OLD site breaks the moment its assets move.
// Check what references these paths before applying:
//   - this repo: cursors/default.png and cursors/pointer.png in globals.css
//   - the old repo: music/, gifs/, videos/, images/, pdfs/

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const APPLY = process.argv.includes("--apply");

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
const BUCKET = process.env.R2_BUCKET || "";

/** First matching rule wins. `to: null` means leave it exactly where it is. */
const RULES = [
  { from: /^site\//, to: null },
  { from: /^uploads\//, to: null },
  { from: /^cursors\//, to: (k) => `brand/cursors/${k.slice("cursors/".length)}` },
  { from: /^icons\//, to: (k) => `brand/icons/${k.slice("icons/".length)}` },
  { from: /^images\/projects\//, to: (k) => `work/${k.slice("images/projects/".length)}` },
  { from: /^images\//, to: (k) => `brand/${k.slice("images/".length)}` },
  { from: /^music\//, to: (k) => `mp3/${k.slice("music/".length)}` },
  { from: /^gifs\//, to: (k) => `archive/gifs/${k.slice("gifs/".length)}` },
  { from: /^videos\//, to: (k) => `archive/videos/${k.slice("videos/".length)}` },
  { from: /^pdfs\//, to: (k) => `archive/pdfs/${k.slice("pdfs/".length)}` },
  { from: /^misc\//, to: (k) => `archive/misc/${k.slice("misc/".length)}` },
];

async function allKeys() {
  const keys = [];
  let token;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    for (const o of res.Contents ?? []) if (o.Key && !o.Key.endsWith("/")) keys.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys.sort();
}

const keys = await allKeys();
const moves = [];
const staying = [];

for (const key of keys) {
  const rule = RULES.find((r) => r.from.test(key));
  if (!rule || rule.to === null) {
    staying.push(key);
    continue;
  }
  const to = rule.to(key);
  if (to !== key) moves.push({ from: key, to });
  else staying.push(key);
}

// A destination that already exists would be silently overwritten.
const destinations = new Set(moves.map((m) => m.to));
const collisions = moves.filter((m) => keys.includes(m.to));
if (destinations.size !== moves.length || collisions.length) {
  console.error("Refusing to run: these destinations collide.");
  for (const c of collisions) console.error(`  ${c.from} -> ${c.to}`);
  process.exit(1);
}

console.log(`${keys.length} objects: ${moves.length} to move, ${staying.length} staying\n`);

const byPrefix = new Map();
for (const m of moves) {
  const prefix = m.to.slice(0, m.to.indexOf("/", m.to.indexOf("/") + 1) + 1) || m.to;
  byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
}
for (const [prefix, n] of [...byPrefix].sort()) console.log(`  ${prefix.padEnd(24)} ${n}`);

if (!APPLY) {
  console.log("\nDry run. Nothing changed. Re-run with `npm run r2:apply` to move them.");
  console.log("Sample of the moves:");
  for (const m of moves.slice(0, 10)) console.log(`  ${m.from}\n    -> ${m.to}`);
  process.exit(0);
}

console.log("\nApplying...");
let done = 0;
for (const { from, to } of moves) {
  await client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      Key: to,
      // The source must be bucket-qualified and URL-encoded, or keys with
      // spaces (most of the music) fail.
      CopySource: encodeURI(`${BUCKET}/${from}`),
    })
  );
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: from }));
  done += 1;
  if (done % 20 === 0) console.log(`  ${done}/${moves.length}`);
}
console.log(`Moved ${done} objects.`);
