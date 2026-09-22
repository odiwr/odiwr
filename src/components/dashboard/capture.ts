/**
 * What the composer makes from a clip in the browser before it uploads — the
 * browser can already decode the clip, the server cannot without ffmpeg:
 *
 * - a still, for link previews and the player's poster;
 * - the cover, a muted loop of at most four seconds that the grid plays.
 *
 * Both come from the trimmed part, so the tile shows what the post plays. The
 * source is an object URL for a file just added, or for one already posted, an
 * address the page may read back from (lib/cinema.ts, readable()).
 */

export type Frame = { poster: Blob | null; width: number; height: number };

/** The cover's length at most, and how wide it is recorded: plenty for a grid tile. */
const LOOP_SECONDS = 4;
const LOOP_WIDTH = 640;
/** How far into the trim the still is taken: past any fade from black. */
const STILL_AT = 0.25;

/** MP4 where the browser can record it (it plays everywhere), else WebM. */
const LOOP_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** Resolves on the event, or rejects after `ms` so a file that never gets there cannot hang the queue. */
function once(target: EventTarget, event: string, ms = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`No ${event}`)), ms);
    target.addEventListener(
      event,
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function load(src: string): HTMLVideoElement {
  const video = document.createElement("video");
  // Only matters for a source on another host; one that allows reading it back
  // leaves the canvas readable.
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  return video;
}

function unload(video: HTMLVideoElement) {
  video.removeAttribute("src");
  video.load();
}

/** A still from just into the trim, at most 1080 wide, and the clip's pixel size. */
export async function captureFrame(src: string, start = 0, end?: number): Promise<Frame> {
  const video = load(src);
  try {
    await once(video, "loadedmetadata");
    const stop = end ?? video.duration;
    video.currentTime = Math.min(start + STILL_AT, start + (stop - start) / 2);
    await once(video, "seeked");
    const width = video.videoWidth;
    const height = video.videoHeight;
    const scale = Math.min(1, 1080 / (width || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return { poster, width, height };
  } catch {
    // A file the browser cannot decode: post it without a still.
    return { poster: null, width: 0, height: 0 };
  } finally {
    unload(video);
  }
}

/**
 * The cover: the trim's first seconds, played muted into a canvas and recorded
 * off it. Real time, so it takes as long as the loop is.
 *
 * Silent, since a canvas carries no sound, and small: 640 wide at a modest
 * bitrate. Null where the browser cannot record, cannot decode the file, or
 * falls behind (a tab in the background: timers throttle, decoding may stop);
 * the post then plays the clip itself on the grid instead.
 */
export async function captureLoop(src: string, name: string, start = 0, end?: number): Promise<File | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const type = LOOP_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) return null;

  const video = load(src);
  try {
    await once(video, "loadedmetadata");
    const stop = Math.min(start + LOOP_SECONDS, end ?? video.duration, video.duration || Infinity);
    if (stop - start < 0.3) return null;
    video.currentTime = start;
    await once(video, "seeked");

    // Even sides: H.264 will not encode odd ones.
    const scale = Math.min(1, LOOP_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth * scale) / 2) * 2;
    canvas.height = Math.round((video.videoHeight * scale) / 2) * 2;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const draw = () => context.drawImage(video, 0, 0, canvas.width, canvas.height);
    draw();

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(canvas.captureStream(30), {
      mimeType: type,
      videoBitsPerSecond: 1_500_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = once(recorder, "stop", (LOOP_SECONDS + 10) * 1000);

    recorder.start();
    await video.play();
    // On a timer rather than per decoded frame: frame callbacks stop in a
    // hidden tab, and nothing would ever end the recording.
    const complete = await new Promise<boolean>((resolve) => {
      const deadline = performance.now() + (stop - start) * 1000 + 3000;
      const tick = () => {
        draw();
        if (video.currentTime >= stop || video.ended) return resolve(true);
        if (performance.now() > deadline) return resolve(false);
        window.setTimeout(tick, 1000 / 30);
      };
      tick();
    });
    video.pause();
    recorder.stop();
    await stopped;
    if (!complete || !chunks.length) return null;

    const mime = type.split(";")[0];
    return new File([new Blob(chunks, { type: mime })], `${name}-loop.${mime === "video/mp4" ? "mp4" : "webm"}`, {
      type: mime,
    });
  } catch {
    return null;
  } finally {
    unload(video);
  }
}
