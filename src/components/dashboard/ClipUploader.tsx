"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";

/**
 * Drop any number of clips; each becomes a post.
 *
 * Before a file goes up, two things are made from it here — the browser can
 * already decode it, the server cannot without ffmpeg: a still, for link
 * previews and the player, and the cover, a muted loop of at most four seconds
 * that the grid plays. Its pixel size goes too, so the post holds its shape
 * before the video loads.
 *
 * Files go one after another, never at once: each is a rewrite of the whole
 * content document. Each becomes a post of its own, or, with "one post" ticked,
 * the first makes the post and the rest become its slides. Given a post, every
 * file is added to it as a slide.
 */

type Row = {
  name: string;
  state: "waiting" | "cover" | "uploading" | "done" | "failed";
  note?: string;
};

type Frame = { poster: Blob | null; width: number; height: number };

/** A still from about a quarter-second in (past any fade from black), at most 1080 wide. */
function captureFrame(file: File): Promise<Frame> {
  return new Promise((resolve) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (frame: Frame) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(src);
      resolve(frame);
    };
    // A file the browser cannot decode never fires either event; post it without a tile.
    const timer = window.setTimeout(() => finish({ poster: null, width: 0, height: 0 }), 10_000);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.25, (video.duration || 0) / 2);
    };
    video.onseeked = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const scale = Math.min(1, 1080 / (width || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          window.clearTimeout(timer);
          finish({ poster: blob, width, height });
        },
        "image/jpeg",
        0.85
      );
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish({ poster: null, width: 0, height: 0 });
    };
    video.src = src;
  });
}

/** The cover's length, and how wide it is recorded: plenty for a grid tile. */
const LOOP_SECONDS = 4;
const LOOP_WIDTH = 640;

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

/**
 * The cover: the clip's opening seconds (from the same quarter-second in as
 * the still), played muted into a canvas and recorded off it. Recording runs in
 * real time, so this takes as long as the loop is.
 *
 * Silent, since a canvas carries no sound, and small: 640 wide at a modest
 * bitrate. Null where the browser cannot record, or cannot decode the file; the
 * post then plays the clip itself on the grid instead.
 */
async function captureLoop(file: File): Promise<File | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const type = LOOP_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) return null;

  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;

  try {
    await once(video, "loadedmetadata");
    const start = Math.min(0.25, (video.duration || 0) / 2);
    const end = Math.min(start + LOOP_SECONDS, video.duration || 0);
    if (end - start < 0.5) return null;
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
    // Drawn on a timer rather than per decoded frame: frame callbacks stop
    // altogether in a hidden tab, and nothing would ever end the recording.
    // A tab in the background still throttles timers, and the browser may stop
    // decoding its video, so a loop that runs well past its own length is given
    // up on — the post goes up without a cover rather than with a frozen one.
    const complete = await new Promise<boolean>((resolve) => {
      const deadline = performance.now() + (end - start) * 1000 + 3000;
      const tick = () => {
        draw();
        if (video.currentTime >= end || video.ended) return resolve(true);
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
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([new Blob(chunks, { type: mime })], `${base}.${mime === "video/mp4" ? "mp4" : "webm"}`, {
      type: mime,
    });
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(src);
  }
}

export default function ClipUploader({ post }: { post?: string } = {}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [publish, setPublish] = useState(true);
  const [together, setTogether] = useState(false);

  const update = (i: number, row: Partial<Row>) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, ...row } : r)));

  async function upload(files: File[]) {
    const videos = files.filter((f) => f.type.startsWith("video/"));
    if (!videos.length || busy) return;

    const offset = rows.length;
    setRows((all) => [...all, ...videos.map((f) => ({ name: f.name, state: "waiting" as const }))]);
    setBusy(true);

    // Where each file goes: the given post, or with "one post" ticked, the post
    // the first file of this batch makes.
    let into = post;

    for (const [n, file] of videos.entries()) {
      const i = offset + n;
      if (!/^video\/(mp4|webm)$/.test(file.type)) {
        update(i, { state: "failed", note: "Export it as MP4 first" });
        continue;
      }
      update(i, { state: "cover" });
      const frame = await captureFrame(file);
      const cover = await captureLoop(file);
      update(i, { state: "uploading" });

      const body = new FormData();
      body.set("file", file);
      if (frame.poster) {
        const base = file.name.replace(/\.[^.]+$/, "");
        body.set("poster", new File([frame.poster], `${base}.jpg`, { type: "image/jpeg" }));
      }
      if (cover) body.set("cover", cover);
      if (frame.width) body.set("width", String(frame.width));
      if (frame.height) body.set("height", String(frame.height));
      if (publish) body.set("publish", "1");
      if (into) body.set("post", into);

      try {
        const res = await fetch("/dashboard/api/cinema", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          id?: string;
          slug?: string;
          slides?: number;
        };
        if (!res.ok) update(i, { state: "failed", note: data.error ?? `Failed (${res.status})` });
        else {
          if (together && !into) into = data.id;
          update(i, { state: "done", note: data.slides ? `Slide ${data.slides}` : `/${data.slug}` });
        }
      } catch {
        update(i, { state: "failed", note: "Network error" });
      }
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload([...e.dataTransfer.files]);
        }}
        disabled={busy}
        className={`flex flex-col items-center justify-center gap-1 rounded-[2px] bg-[#242424] px-4 py-10 transition-colors ${
          over ? "text-accent outline outline-1 outline-accent" : "text-foreground/50 hover:text-accent"
        } ${busy ? "cursor-progress" : ""}`}
      >
        <Icon name="material-symbols:upload-rounded" size="1.6em" />
        {busy ? "Uploading…" : post ? "Drop clips to add as slides" : "Drop clips here, or choose them"}
        <span className="text-foreground/30">MP4 or WebM, up to 64 MB each</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm"
        multiple
        hidden
        onChange={(e) => {
          upload([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {/* Adding to a post already made: it is shown or not already. */}
      {!post && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="check">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            <span className="check-box" aria-hidden="true">
              <Icon name="material-symbols:check-rounded" size="0.95em" />
            </span>
            Post to the site straight away
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={together}
              onChange={(e) => setTogether(e.target.checked)}
            />
            <span className="check-box" aria-hidden="true">
              <Icon name="material-symbols:check-rounded" size="0.95em" />
            </span>
            Put them all in one post
          </label>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col">
          {rows.map((row, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 py-1">
              <span className="truncate text-foreground/70">{row.name}</span>
              <span
                className={
                  row.state === "failed"
                    ? "shrink-0 text-[#ff6b6b]"
                    : row.state === "done"
                      ? "shrink-0 text-accent"
                      : "shrink-0 text-foreground/40"
                }
              >
                {row.state === "waiting"
                  ? "Waiting"
                  : row.state === "cover"
                    ? "Making cover…"
                    : row.state === "uploading"
                    ? "Uploading…"
                    : row.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
