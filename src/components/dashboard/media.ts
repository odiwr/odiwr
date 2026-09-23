import type { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Everything a post's clip needs, made in the browser before it is uploaded:
 * the clip cut down to its trim, the still, and the cover loop the grid plays.
 *
 * It is ffmpeg, compiled for the browser, fetched (about 30 MB, pinned to one
 * version) the first time a post needs it and kept for the rest of the visit.
 * Only the dashboard ever loads it.
 *
 * Cutting is what keeps uploads small — a 200 MB file of which ten seconds are
 * kept goes up as those ten seconds. A short trim is encoded again, exactly:
 * the clip then starts where the trim starts, so the site can loop it with no
 * seeking (a seek back mid-loop is what made clips pause before repeating), and
 * it can be trimmed again later only within itself. A long one is copied
 * instead, untouched and instant, from the keyframe before the trim, with a
 * little either side; its trim is then carried as times into that file.
 *
 * The still and the cover are encoded here too, rather than recorded by playing
 * the clip: playback drops frames whenever the machine is busy, which is what
 * made some covers judder or run at a few frames a second.
 *
 * Each command gets an ffmpeg of its own, torn down afterwards: this build will
 * walk off its own memory on one command and take the rest of the session with
 * it, so a failure is kept to the one thing it was doing. The engine itself is
 * only downloaded once.
 */

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
/** Trims up to this long are cut exactly; longer ones are copied. */
const EXACT_MAX = 25;
/** Kept either side of a copied trim, for adjusting it later. */
const PAD = 2;
/** Not worth cutting when this much of the file would be kept anyway. */
const KEEP_WHOLE = 0.8;
/** The cover: how long it plays, and how wide it is encoded. */
const COVER_SECONDS = 4;
const COVER_WIDTH = 640;
/** How far into the trim the still is taken: past any fade from black. */
const STILL_AT = 0.25;

/** The engine's files, fetched once and kept for the visit. */
let core: Promise<{ coreURL: string; wasmURL: string }> | null = null;

function files() {
  core ??= (async () => {
    const { toBlobURL } = await import("@ffmpeg/util");
    return {
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
    };
  })().catch((error) => {
    // Let the next post try again rather than keep a failure.
    core = null;
    throw error;
  });
  return core;
}

/**
 * One ffmpeg, for one job, torn down after it. `said` collects its own last
 * words, so a failure can report what it was doing.
 */
async function run<T>(job: (ffmpeg: FFmpeg, said: string[]) => Promise<T>): Promise<T | null> {
  let ffmpeg: FFmpeg | null = null;
  const said: string[] = [];
  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      said.push(message);
      if (said.length > 12) said.shift();
    });
    await ffmpeg.load({
      // Served unbundled from this site (scripts/copy-ffmpeg-worker.mjs):
      // bundled, the worker cannot import the core.
      classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
      ...(await files()),
    });
    return await job(ffmpeg, said);
  } catch (error) {
    console.warn("ffmpeg could not do that; falling back.", error, said.join("\n"));
    return null;
  } finally {
    try {
      ffmpeg?.terminate();
    } catch {
      // Already gone.
    }
  }
}

/** ffprobe's output, written to a file in ffmpeg's memory and read back. Empty if it fails. */
async function probe(ffmpeg: FFmpeg, args: string[]): Promise<string> {
  try {
    // Its exit code is not to be trusted in this build (non-zero on success),
    // so the output is read either way; no output file means it failed.
    await ffmpeg.ffprobe([...args, "-o", "probe.txt"]);
    const out = await ffmpeg.readFile("probe.txt", "utf8");
    return typeof out === "string" ? out.trim() : "";
  } catch {
    return "";
  }
}

async function take(ffmpeg: FFmpeg, path: string, name: string, type: string): Promise<File | null> {
  const data = await ffmpeg.readFile(path).catch(() => null);
  if (!(data instanceof Uint8Array) || !data.byteLength) return null;
  return new File([new Uint8Array(data)], name, { type });
}

/** Writes `file` in, runs the arguments, and brings `out` back. */
async function convert(file: File | Blob, args: string[], out: string, name: string, type: string) {
  return run(async (ffmpeg) => {
    const { fetchFile } = await import("@ffmpeg/util");
    const input = file.type === "video/webm" ? "in.webm" : "in.mp4";
    await ffmpeg.writeFile(input, await fetchFile(file));
    const failed = await ffmpeg.exec(args.map((a) => (a === "$in" ? input : a)));
    if (failed) throw new Error(`ffmpeg exited ${failed}`);
    return take(ffmpeg, out, name, type);
  });
}

/** The trim's first seconds, muted and small: what the grid plays. */
function cover(file: File | Blob, start: number, end: number, name: string) {
  const length = Math.min(COVER_SECONDS, end - start);
  return convert(
    file,
    [
      "-ss", start.toFixed(3), "-i", "$in", "-t", length.toFixed(3),
      "-an", "-vf", `scale=${COVER_WIDTH}:-2:force_original_aspect_ratio=decrease`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "cover.mp4",
    ],
    "cover.mp4",
    `${name}-loop.mp4`,
    "video/mp4"
  );
}

/** One frame from just into the trim. */
function still(file: File | Blob, at: number, name: string) {
  return convert(
    file,
    [
      "-ss", at.toFixed(3), "-i", "$in", "-frames:v", "1",
      "-vf", "scale=1080:-2:force_original_aspect_ratio=decrease", "-q:v", "3",
      // One image, not a numbered sequence: without saying so, the writer takes
      // the name for a pattern and this build walks off its own memory.
      "-update", "1", "still.jpg",
    ],
    "still.jpg",
    `${name}-poster.jpg`,
    "image/jpeg"
  );
}

export type Prepared = {
  /** The clip to upload, or null to upload the file as it is. */
  clip: File | null;
  /** The trim to save, in the uploaded clip's own time. Absent means all of it. */
  start?: number;
  end?: number;
  poster: File | null;
  cover: File | null;
};

/**
 * Cuts `file` to its trim and makes its still and cover. Whatever part of that
 * ffmpeg cannot do comes back null, and the caller falls back for that part
 * alone: the file uploaded whole, the cover recorded by playing it
 * (capture.ts).
 */
export async function prepare(
  file: File,
  start: number,
  end: number,
  duration: number,
  onStatus?: (text: string) => void
): Promise<Prepared> {
  const name = file.name.replace(/\.[^.]+$/, "");
  const wanted = end - start;
  const whole = start <= 0.01 && (end >= duration - 0.01 || !duration);
  const ext = file.type === "video/webm" ? "webm" : "mp4";

  let clip: File | null = null;
  let trimStart: number | undefined = start;
  let trimEnd: number | undefined = end;

  if (whole || (duration && wanted > duration * KEEP_WHOLE)) {
    // Nearly all of it is kept: nothing worth cutting.
    trimStart = start || undefined;
    trimEnd = whole ? undefined : end;
  } else if (wanted <= EXACT_MAX) {
    // Encoded again, exactly the trim: it then starts at its first frame and
    // the site loops it without seeking.
    onStatus?.("Cutting to the trim");
    clip = await convert(
      file,
      [
        "-ss", start.toFixed(3), "-i", "$in", "-t", wanted.toFixed(3),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "cut.mp4",
      ],
      "cut.mp4",
      `${name}.mp4`,
      "video/mp4"
    );
    if (clip) {
      trimStart = undefined;
      trimEnd = undefined;
    }
  } else {
    // Too long to encode in a browser: copied untouched from the keyframe
    // before the trim, with a little either side. Where the original's times
    // land in the copy is read off both files while they are still in there.
    onStatus?.("Cutting to the trim");
    const from = Math.max(0, start - PAD);
    const to = Math.min(duration, end + PAD);
    const copied = await run(async (ffmpeg) => {
      const { fetchFile } = await import("@ffmpeg/util");
      const input = `in.${ext}`;
      await ffmpeg.writeFile(input, await fetchFile(file));
      const args = [
        "-ss", from.toFixed(3), "-i", input, "-t", (to - from).toFixed(3),
        "-c", "copy", "-avoid_negative_ts", "make_zero",
      ];
      if (ext === "mp4") args.push("-movflags", "+faststart");
      const failed = await ffmpeg.exec([...args, `cut.${ext}`]);
      if (failed) throw new Error(`ffmpeg exited ${failed}`);

      // The copy begins on the keyframe at or before `from`, and its own video
      // starts a hair past zero.
      const keyframe = await probe(ffmpeg, [
        "-read_intervals", `${Math.max(0, from - 12).toFixed(3)}%${(from + 0.05).toFixed(3)}`,
        "-select_streams", "v:0", "-skip_frame", "nokey",
        "-show_entries", "frame=pts_time", "-of", "csv=p=0", input,
      ]).then((out) =>
        out.split(/\s+/).filter(Boolean).map(Number).filter((t) => t <= from + 0.001).pop()
      );
      const videoStart = Number.parseFloat(
        await probe(ffmpeg, [
          "-select_streams", "v:0", "-show_entries", "stream=start_time", "-of", "csv=p=0", `cut.${ext}`,
        ])
      );
      const shift = keyframe !== undefined && Number.isFinite(videoStart) ? keyframe - videoStart : from;
      const cut = await take(ffmpeg, `cut.${ext}`, `${name}.${ext}`, file.type || "video/mp4");
      return cut && { cut, shift };
    });

    if (copied) {
      clip = copied.cut;
      trimStart = Math.max(0, Math.round((start - copied.shift) * 1000) / 1000) || undefined;
      trimEnd = Math.round((end - copied.shift) * 1000) / 1000;
    }
  }

  // Both are made from whatever will be uploaded, at its own times.
  const source = clip ?? file;
  const at = trimStart ?? 0;
  const until = trimEnd ?? (clip ? at + wanted : end);
  onStatus?.("Making the cover");
  const poster = await still(source, Math.min(at + STILL_AT, (at + until) / 2), name);
  const loop = await cover(source, at, until, name);

  return { clip, start: trimStart, end: trimEnd, poster, cover: loop };
}

/**
 * A new still and cover for a clip already uploaded, after its trim changed.
 * Either may be null if ffmpeg could not manage it.
 */
export async function restills(
  src: string,
  name: string,
  start: number,
  end: number,
  onStatus?: (text: string) => void
): Promise<{ poster: File | null; cover: File | null }> {
  onStatus?.("Making the cover");
  const file = await fetch(src)
    .then((res) => res.blob())
    .catch(() => null);
  if (!file) return { poster: null, cover: null };
  return {
    poster: await still(file, Math.min(start + STILL_AT, (start + end) / 2), name),
    cover: await cover(file, start, end, name),
  };
}
