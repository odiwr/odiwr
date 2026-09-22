import type { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Cutting a clip down to its trim before it is uploaded, so a 200 MB file of
 * which ten seconds are kept goes up as those ten seconds.
 *
 * A stream copy: the video and sound are moved into a new file untouched, not
 * encoded again, so it is as good as the original and takes seconds rather
 * than minutes. It is ffmpeg, compiled for the browser, fetched (about 30 MB,
 * pinned to one version) the first time a post needs it and kept for the rest
 * of the visit. Only the dashboard ever loads it.
 *
 * A copy can only begin on a keyframe, so the cut starts at the last one
 * before the trim, and the trim is re-expressed in the new file's own time.
 * PAD seconds are kept either side, so the trim can still be nudged later.
 */

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
/** Kept either side of the trim, for adjusting it later. */
const PAD = 2;
/** Not worth cutting when this much of the file would be kept anyway. */
const KEEP_WHOLE = 0.8;

let loading: Promise<FFmpeg> | null = null;

function engine(): Promise<FFmpeg> {
  loading ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      // Served unbundled from this site (scripts/copy-ffmpeg-worker.mjs):
      // bundled, the worker cannot import the core.
      classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })().catch((error) => {
    // Let the next post try again rather than keep a failure.
    loading = null;
    throw error;
  });
  return loading;
}

/** Seconds from ffmpeg's "Duration: 00:01:02.34" line. */
function durationIn(log: string): number | null {
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(log);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** ffprobe's output, written to a file in ffmpeg's memory and read back. Empty if it fails. */
async function probe(ffmpeg: FFmpeg, args: string[]): Promise<string> {
  try {
    // Its exit code is not to be trusted in this build (non-zero on success),
    // so the output is read either way; no output file means it failed.
    await ffmpeg.ffprobe([...args, "-o", "probe.txt"]);
    const out = await ffmpeg.readFile("probe.txt", "utf8");
    await ffmpeg.deleteFile("probe.txt");
    return typeof out === "string" ? out.trim() : "";
  } catch {
    return "";
  }
}

export type Cut = {
  file: File;
  /** The trim, in the cut file's own time. */
  start: number;
  end: number;
};

/**
 * The trimmed part of `file` (with PAD either side) as a file of its own, or
 * null when cutting would save little, or could not be done — the whole file
 * is uploaded then, as before.
 */
export async function cutToTrim(
  file: File,
  start: number,
  end: number,
  duration: number,
  onStatus?: (text: string) => void
): Promise<Cut | null> {
  const from = Math.max(0, start - PAD);
  const to = Math.min(duration, end + PAD);
  if (to - from >= duration * KEEP_WHOLE) return null;

  try {
    onStatus?.("Loading the cutter (once per visit)…");
    const ffmpeg = await engine();
    const { fetchFile } = await import("@ffmpeg/util");

    const ext = file.type === "video/webm" ? "webm" : "mp4";
    const input = `in.${ext}`;
    const output = `out.${ext}`;
    onStatus?.("Cutting to the trim…");
    await ffmpeg.writeFile(input, await fetchFile(file));

    const args = ["-ss", from.toFixed(3), "-i", input, "-t", (to - from).toFixed(3), "-c", "copy", "-avoid_negative_ts", "make_zero"];
    if (ext === "mp4") args.push("-movflags", "+faststart");
    const failed = await ffmpeg.exec([...args, output]);
    if (failed) throw new Error(`ffmpeg exited ${failed}`);

    // Where the original's `from` landed in the new file. The copy begins on
    // the keyframe at or before `from`, and the new file's video begins at its
    // own start time (a hair past zero, where the sound is primed): so the
    // original's time T is T - keyframe + that start in the new file. Both are
    // read with ffprobe; if either cannot be, the file's extra length stands in
    // for the lead-in, which is close but can be a few frames off.
    const keyframe = await probe(ffmpeg, [
      "-read_intervals", `${Math.max(0, from - 12).toFixed(3)}%${(from + 0.05).toFixed(3)}`,
      "-select_streams", "v:0", "-skip_frame", "nokey",
      "-show_entries", "frame=pts_time", "-of", "csv=p=0", input,
    ]).then((out) =>
      out
        .split(/\s+/)
        .filter(Boolean)
        .map(Number)
        .filter((t) => Number.isFinite(t) && t <= from + 0.001)
        .pop()
    );
    const videoStart = await probe(ffmpeg, [
      "-select_streams", "v:0", "-show_entries", "stream=start_time", "-of", "csv=p=0", output,
    ]).then((out) => Number.parseFloat(out));

    let shift: number;
    if (keyframe !== undefined && Number.isFinite(videoStart)) {
      shift = keyframe - videoStart;
    } else {
      let log = "";
      const listen = ({ message }: { message: string }) => (log += `${message}
`);
      ffmpeg.on("log", listen);
      await ffmpeg.exec(["-i", output]);
      ffmpeg.off("log", listen);
      const length = durationIn(log);
      shift = from - (length ? Math.max(0, length - (to - from)) : 0);
    }

    const data = await ffmpeg.readFile(output);
    await Promise.all([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)]);
    if (!(data instanceof Uint8Array) || !data.byteLength) return null;

    const name = file.name.replace(/\.[^.]+$/, "");
    return {
      file: new File([new Uint8Array(data)], `${name}.${ext}`, { type: file.type }),
      start: Math.round((start - shift) * 1000) / 1000,
      end: Math.round((end - shift) * 1000) / 1000,
    };
  } catch (error) {
    // Not loaded (offline, blocked), or the file would not copy cleanly. Said
    // in the console, since the post still goes up, just whole.
    console.warn("Could not cut the clip to its trim; uploading it whole.", error);
    return null;
  }
}
