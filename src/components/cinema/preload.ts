/**
 * Clips fetched ahead of a click, held in memory, and let go again.
 *
 * Pointing at a tile with intent (CinemaGallery's Tile decides what counts)
 * warms its post: every slide's clip is fetched whole into a Blob and served
 * from an object URL, so opening it plays at once instead of buffering. Moving
 * away without opening cools it — the download is cancelled and the memory
 * released after a short grace, so brushing past a tile costs almost nothing.
 * Opening a post holds it until it is closed.
 *
 * Kept small on purpose: at most WARM_POSTS posts are warm at a time (the
 * oldest idle one is dropped first), and a file bigger than MAX_BYTES is not
 * fetched at all — it streams as usual instead.
 */

export type Preload = {
  /** What the viewer plays, and the key it looks the copy up by. */
  src: string;
  /** Where to fetch it from: same-origin, or a host that allows reading it (lib/cinema.ts, readable()). */
  from: string;
};

type Entry = {
  controller: AbortController;
  /** The object URL, once the whole file is in. */
  url?: string;
};

type Post = {
  files: Preload[];
  /** Open in the viewer: not dropped until released. */
  held: boolean;
  /** Pending release after the pointer left. */
  cooling?: number;
};

const WARM_POSTS = 2;
const MAX_BYTES = 40 * 1024 * 1024;
/** How long a post stays warm after the pointer leaves it, in case it comes straight back. */
const GRACE = 600;

const entries = new Map<string, Entry>();
/** In the order they were warmed; the first idle one is the first to go. */
const posts = new Map<string, Post>();

async function fetchWhole(file: Preload, entry: Entry) {
  try {
    const res = await fetch(file.from, { signal: entry.controller.signal });
    if (!res.ok) throw new Error(String(res.status));
    const size = Number(res.headers.get("content-length") ?? 0);
    if (size > MAX_BYTES) {
      entry.controller.abort();
      return;
    }
    const blob = await res.blob();
    if (!entry.controller.signal.aborted) entry.url = URL.createObjectURL(blob);
  } catch {
    // Cancelled, refused (no CORS), or offline: the viewer streams it instead.
    entries.delete(file.src);
  }
}

function drop(key: string) {
  const post = posts.get(key);
  if (!post) return;
  window.clearTimeout(post.cooling);
  posts.delete(key);
  const stillWanted = new Set([...posts.values()].flatMap((p) => p.files.map((f) => f.src)));
  for (const file of post.files) {
    if (stillWanted.has(file.src)) continue;
    const entry = entries.get(file.src);
    if (!entry) continue;
    entry.controller.abort();
    if (entry.url) URL.revokeObjectURL(entry.url);
    entries.delete(file.src);
  }
}

/** Starts fetching a post's clips, unless they are coming or here already. */
export function warm(key: string, files: Preload[]) {
  const existing = posts.get(key);
  if (existing) {
    window.clearTimeout(existing.cooling);
    existing.cooling = undefined;
    // Most recently wanted goes to the back of the queue.
    posts.delete(key);
    posts.set(key, existing);
    return;
  }
  posts.set(key, { files, held: false });
  for (const [other, post] of posts) {
    if (posts.size <= WARM_POSTS) break;
    if (other !== key && !post.held) drop(other);
  }
  for (const file of files) {
    if (entries.has(file.src)) continue;
    const entry: Entry = { controller: new AbortController() };
    entries.set(file.src, entry);
    void fetchWhole(file, entry);
  }
}

/** The pointer left without opening it: let it go after a moment. */
export function cool(key: string) {
  const post = posts.get(key);
  if (!post || post.held) return;
  window.clearTimeout(post.cooling);
  post.cooling = window.setTimeout(() => drop(key), GRACE);
}

/** Opened: kept (and fetched, if it was not warm yet) until released. */
export function hold(key: string, files: Preload[]) {
  warm(key, files);
  const post = posts.get(key);
  if (post) {
    window.clearTimeout(post.cooling);
    post.held = true;
  }
}

/** Closed: nothing is kept for a post nobody is looking at. */
export function release(key: string) {
  drop(key);
}

/** The in-memory copy of a clip, if it has fully arrived; else the address as given. */
export function cached(src: string): string {
  return entries.get(src)?.url ?? src;
}
