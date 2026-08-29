// Makes the bucket browse as real directories.
//
//   npm run r2:folders
//
// Object storage has no folders — every key is flat. Cloudflare's console only
// draws a folder row when a zero-byte object ending in "/" exists to mark it,
// which is exactly what its own "Create folder" button makes.
//
// The reorganisation moved the files but left the OLD markers behind (the listing
// code skips keys ending in "/", so they were never seen), and created none for
// the new layout. So the console showed stale empty folders next to a flat list
// of long names. This deletes the stale markers and writes one for every prefix
// that now has files under it.
//
// Nothing in the app reads these: listings skip "/"-suffixed keys, and the folder
// trees are derived from the file keys themselves. They exist purely so the
// bucket is navigable by a person.

import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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

const all = [];
let token;
do {
  const res = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
  );
  for (const o of res.Contents ?? []) if (o.Key) all.push(o.Key);
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);

const markers = all.filter((k) => k.endsWith("/"));
const files = all.filter((k) => !k.endsWith("/"));

/** Every prefix that actually contains something, at every depth. */
const wanted = new Set();
for (const key of files) {
  const parts = key.split("/");
  parts.pop();
  let path = "";
  for (const part of parts) {
    path = `${path}${part}/`;
    wanted.add(path);
  }
}

const stale = markers.filter((m) => !wanted.has(m));
const missing = [...wanted].filter((w) => !markers.includes(w)).sort();

console.log(`${files.length} files, ${markers.length} folder markers`);
console.log(`${stale.length} stale to remove, ${missing.length} to create\n`);

for (const key of stale) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`  removed  ${key}`);
}

for (const key of missing) {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: "", ContentType: "application/x-directory" })
  );
  console.log(`  created  ${key}`);
}

console.log("\nDone.");
