/**
 * The story card: a 9:16 video made in the browser from a slide's loop, for
 * sharing to an Instagram (or any) story — the way Spotify hands a designed
 * card to Instagram, but from a web page.
 *
 * A page cannot open Instagram's story composer itself; only apps can. What it
 * can do, on phones, is pass a file to the system share sheet
 * (navigator.share), where Instagram is one of the targets and puts the video
 * straight into a new story. Everywhere else the video is saved instead and the
 * link copied, to post by hand.
 *
 * The card: black, the loop letterboxed in the cinema frame across the middle
 * (the frame's black is the background's, so its bars do not show), the gold
 * line under it as on the grid (what it is from, the date), and the link at
 * the foot. Recorded off a canvas in real time: four seconds,
 * the loop going round as often as it needs to fill them.
 */

const W = 1080;
const H = 1920;
const SECONDS = 4;
const GOLD = "#ffd994";
const TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

export type StoryInput = {
  /** The loop, from somewhere a canvas may record it (ViewSlide.share). */
  src: string;
  label: string;
  date: string;
  /** Shown at the foot, without the scheme. */
  url: string;
  /** For the file's name. */
  name: string;
};

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

/** Cuts a line to fit, with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Null where this browser cannot record a canvas, or the loop cannot be read. */
export async function makeStory(input: StoryInput): Promise<File | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) return null;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.preload = "auto";
  video.src = input.src;

  try {
    await once(video, "loadeddata");

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const family = getComputedStyle(document.body).fontFamily || "sans-serif";
    // The cinema frame, across the middle, a little above centre.
    const frameW = W - 120;
    const frameH = Math.round(frameW / 2.39);
    const frameX = 60;
    const frameY = Math.round(H * 0.44 - frameH / 2);

    const draw = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Letterboxed into the frame, never cropped: the grid's rule.
      const a = video.videoWidth / video.videoHeight || 16 / 9;
      let w = frameW;
      let h = w / a;
      if (h > frameH) {
        h = frameH;
        w = h * a;
      }
      ctx.drawImage(video, frameX + (frameW - w) / 2, frameY + (frameH - h) / 2, w, h);

      ctx.textBaseline = "top";
      ctx.fillStyle = GOLD;
      ctx.font = `44px ${family}`;
      const date = input.date;
      const dateW = ctx.measureText(date).width;
      ctx.fillText(fit(ctx, input.label, frameW - dateW - 40), frameX, frameY + frameH + 22);
      ctx.fillText(date, frameX + frameW - dateW, frameY + frameH + 22);

      ctx.fillStyle = "#7a7466";
      ctx.font = `36px ${family}`;
      const url = fit(ctx, input.url, W - 120);
      ctx.fillText(url, (W - ctx.measureText(url).width) / 2, H - 200);
    };
    draw();

    const chunks: Blob[] = [];
    // Throws here if the loop came from somewhere that forbids reading it back.
    const recorder = new MediaRecorder(canvas.captureStream(30), {
      mimeType: type,
      videoBitsPerSecond: 4_000_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = once(recorder, "stop", (SECONDS + 10) * 1000);

    video.currentTime = 0;
    await video.play();
    recorder.start();
    // Always the full length: a loop shorter than that simply goes round again
    // (the video loops), so a 1.4s GIF still makes a story worth watching.
    const length = SECONDS;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        draw();
        if (performance.now() - started >= length * 1000) return resolve();
        window.setTimeout(tick, 1000 / 30);
      };
      tick();
    });
    recorder.stop();
    video.pause();
    await stopped;
    if (!chunks.length) return null;

    const mime = type.split(";")[0];
    return new File([new Blob(chunks, { type: mime })], `${input.name}.${mime === "video/mp4" ? "mp4" : "webm"}`, {
      type: mime,
    });
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

export type ShareResult = "shared" | "saved" | "copied" | "cancelled";

/**
 * Hands the card to the share sheet where the device has one that takes files,
 * else saves it and copies the link. Without a card (it could not be made),
 * the link alone is shared or copied.
 */
export async function shareStory(file: File | null, url: string): Promise<ShareResult> {
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      // Files alone: several targets, Instagram among them, refuse a share that
      // also carries a URL. The link is on the card.
      await navigator.share({ files: [file] });
      return "shared";
    }
    if (!file && navigator.share) {
      await navigator.share({ url });
      return "shared";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    // Anything else: fall through to saving it.
  }

  await navigator.clipboard?.writeText(url).catch(() => {});
  if (!file) return "copied";
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return "saved";
}
