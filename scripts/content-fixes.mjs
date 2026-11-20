// One-off fixes to the content document (site/content.json in R2) from the
// November 2026 site audit: the things that live in content, not in code.
//
//   npm run content:fix              print what would change, change nothing   (default)
//   npm run content:fix -- --apply   back the document up, then write the changes
//
// The backup goes to site/backups/content-<time>.json before anything is
// written, so applying can be undone by copying it back.
//
// WHAT IT CHANGES
//
//   Memory Mission   "respected fields" -> "respective fields", and the bullet
//                    list put one item per line so the page renders it as a list
//   ume              stack: discord.js, TypeScript, Next.js, PostgreSQL (what the
//                    repo is now; it was listed as Python, SQLite, Google Drive)
//   CS Club Game Jam stack: Python (the repo has no JavaScript or HTML)
//   Portfolio        alt text for every item that has none, read out by screen
//                    readers. Written from looking at each one; rewrite any in
//                    the dashboard (Portfolio, the item's alt field).
//
// Each fix is skipped if the entry no longer reads as it did at the audit, so
// running it twice, or after editing by hand, does nothing to what you wrote.

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const APPLY = process.argv.includes("--apply");
const KEY = "site/content.json";

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

if (!process.env.R2_ENDPOINT || !BUCKET || !process.env.R2_ACCESS_KEY_ID) {
  console.error("R2_ENDPOINT, R2_BUCKET and R2_ACCESS_KEY_ID must be set (.env.local).");
  process.exit(1);
}

const STACKS = {
  ume: [
    ["simple-icons:discord", "simple-icons:python", "simple-icons:sqlite", "simple-icons:googledrive"],
    ["simple-icons:discorddotjs", "simple-icons:typescript", "simple-icons:nextdotjs", "simple-icons:postgresql"],
  ],
  "CS Club Game Jam": [
    ["simple-icons:python", "simple-icons:javascript", "simple-icons:html5"],
    ["simple-icons:python"],
  ],
};

/** Portfolio item id -> alt text. Only filled where an item has none. */
const ALT = {
  mmiuby8x: "Two women posing cheek to cheek, one with platinum blonde hair, the other with braids and a flower clip",
  pf2pxe76: "The red H&M sign on top of a tower in Times Square at night",
  ytjfz7hb: "A young man in ski goggles and an olive flight suit, sitting in tall grass beside an American flag",
  avow6vl7: "Two young women smiling in front of an ivy-covered stone building",
  zd7tn3t8: "A crowd seen from behind in Times Square at night, under the Disney Store sign",
  ina7vdmr: "A young woman on a red scooter outside a café decorated for autumn, one hand in her hair",
  dz6vo27z: "Black-and-white portrait of a young man in a patterned sweater by a café window",
  jg3tpm3b: "A young man with curly hair looking at his reflection in a round mirror",
  "53wb1k1v": "Six friends posing against a white wall, two of them making peace signs",
  bowp4qpb: "A bearded man in a black cap, tinted glasses and a purple hoodie, hands on his head",
  xv2y4dbb: "A person standing inside a heart of red cups on a garage floor, with text laid over the photo",
  njyvlbs9: "A young man in an olive flight suit in a wildflower field at dusk, a hand over his face",
  rc4emd4c: "A young woman sitting on a red scooter outside a café decorated for autumn",
  "41img9o6": "Video: orange hand-drawn lettering over a flowering tree",
  mfrp05rs: "Video: a man in a red sweater walking through a rose garden under a blue sky",
  "13xiqya1": "A black convertible on a city street at night",
  "5phoye2p": "A woman with long platinum blonde hair looking over her shoulder by the sea",
  "9rygyq2u": "Black-and-white profile of a young man beside a vehicle window",
  r3nt89kc: "Two young men at sunset, one in a flight jacket with patches",
  irtm73bt: "Black-and-white street at night outside a bar, a young man seen from behind",
  "5jqz1ju7": "Three friends eating ice cream on a bench against a brick wall",
  iqu5sjfs: "A young man in ski goggles crouched in tall grass beside an American flag",
  uchygmf3: "Close-up of an American flag, a patterned bag and wildflowers",
  "0yogv5lt": "Video: a person with bright orange curly hair, with a line of text on screen",
  jsc7j1fp: "Two young men laughing at a café table outside a bakery at night",
  l231a7ab: "Two young men eating at a café table outside a bakery at night",
  qpik4lvy: "Four young men in yellow shirts and caps, laughing and holding up sneakers",
  kn91colq: "Black-and-white portrait of a young man in a Nike sweatshirt by a café window",
  mat28lqg: "A young man in a green Nike sweatshirt reaching toward the camera by a café window",
  "4noo3a7k": "Video: a young man in a suit and red tie speaking at night, framed like a film",
  xpldlumy: "A deli storefront lit up at night, with a shadowed figure in the foreground",
  "986plkd5": "Five friends posing in front of an ivy-covered stone building",
  u5kjydbm: "A street-food tent glowing at night on a city street, a bicycle parked in front",
  lciazi2x: "Video: a person in goggles holding an American flag against autumn leaves, with a line of text on screen",
  "4cfte35q": "A person in a mask holding up a record sleeve, high-contrast black and white",
  xyr7zwje: "A young man looking at the camera on a crowded subway car",
  etfa5c8v: "A young man looking down a subway platform",
  rfateeo2: "A young man in a navy sweater on a red scooter outside a café decorated for autumn",
  "5ilrst21": "A young man in a black leather jacket on a lawn in front of an ivy-covered building",
  goe8k1gg: "A young woman lying on a plaid blanket among soap bubbles",
  q9yrzt5k: "Black-and-white: a young man seen from behind on a city street at night",
  czqiosy2: "A young man in a green Nike sweatshirt gesturing toward the camera by a café window",
  td79frk2: "Cut-out black-and-white portrait of a smiling man in glasses making two peace signs",
  s857n0t6: "Two young men at a café table outside a bakery at night, one pointing at the window",
  q8596mbz: "A young couple smiling on a street at night",
  yfa52vb1: "Video: a figure crouching in reddish brush in the woods",
  wyy1xl9j: "Black-and-white photo of a young man in a Nike sweatshirt looking at a camera in his hands",
  pzfe54h2: "A young man in ski goggles and a flight suit standing in a field at sunset",
  bwmlb1ml: "Video: a man driving, filmed from the passenger seat, with karaoke-style English and Japanese text on screen",
  r7c5amxs: "Video: a Windows XP desktop with its green-hill wallpaper",
  ib1ahk74: "Black-and-white portrait of a young man in a Nike sweatshirt by a café window, looking at the camera",
  "2adyd9fk": "Billboards lighting up Times Square at night",
  i4cjhskc: "A young man in headphones and glasses leaning on a white wall, hand on his chin",
  "2l6z76gx": "Portrait of a young man with curly hair, the picture cut into shifted strips",
  q2rygvkp: "Video: a small home studio with foam panels and a person at a microphone",
  eqjmrkc3: "A young couple smiling under a street lamp at night",
};

/** A stack as bare names, whatever prefix each slug was saved with: "discord", "python". */
const names = (stack) => (stack ?? []).map((slug) => String(slug).replace(/^[a-z-]+:/, ""));
const same = (a, b) => JSON.stringify(names(a)) === JSON.stringify(names(b));

/** "- one. - Two. - Three." on one line -> one item per line. */
function listOnePerLine(paragraph) {
  if (!paragraph.startsWith("- ") || paragraph.includes("\n")) return paragraph;
  return paragraph
    .split(/\s+-\s+(?=[A-Z])/)
    .map((item, i) => (i === 0 ? item : `- ${item}`))
    .join("\n");
}

const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
const original = await res.Body.transformToString();
const doc = JSON.parse(original);
const changes = [];

for (const work of doc.work ?? []) {
  if (work.title === "Memory Mission" && typeof work.description === "string") {
    const fixed = work.description
      .replace("respected fields", "respective fields")
      .split(/\n\s*\n/)
      .map(listOnePerLine)
      .join("\n\n");
    if (fixed !== work.description) {
      changes.push("Memory Mission: typo fixed, bullet list one item per line");
      work.description = fixed;
    }
  }

  const stack = STACKS[work.title];
  if (stack && same(work.stack, stack[0])) {
    changes.push(`${work.title}: stack -> ${stack[1].join(", ")}`);
    work.stack = stack[1];
  }
}

let alts = 0;
for (const item of doc.portfolio?.items ?? []) {
  if (!item.alt && ALT[item.id]) {
    item.alt = ALT[item.id];
    alts++;
  }
}
if (alts) changes.push(`Portfolio: alt text written for ${alts} item(s)`);

if (!changes.length) {
  console.log("Nothing to change: every fix is already in, or the entries have been edited since.");
  process.exit(0);
}

console.log(changes.map((c) => `  - ${c}`).join("\n"));

if (!APPLY) {
  console.log("\nDry run. Nothing written. Run `npm run content:fix -- --apply` to write it.");
  process.exit(0);
}

const backup = `site/backups/content-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await client.send(
  new PutObjectCommand({ Bucket: BUCKET, Key: backup, Body: original, ContentType: "application/json" })
);
await client.send(
  new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify(doc),
    ContentType: "application/json",
  })
);
console.log(`\nWritten. The previous document is at ${backup}. The site shows it within a minute.`);
