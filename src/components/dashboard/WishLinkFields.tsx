"use client";

import { useEffect, useRef, useState } from "react";
import { previewLink } from "@/app/dashboard/(app)/actions";
import { sampleImage } from "@/app/dashboard/(app)/image-actions";
import ColorField from "./ColorField";
import { siteFromHost } from "@/lib/wish";

/**
 * The link, the picture pulled from it, and the fields that depend on it.
 *
 * Typing or pasting a link fetches that page's own preview image, title and
 * site name, plus the colour the image sits on (all on the server — a browser
 * cannot read another site's HTML or pixels) and shows the picture beside the
 * field as it will look on the site. A direct image link in Image replaces it,
 * and goes on the plain tile.
 *
 * Under the picture:
 *   - a slider sizing it within its tile, from half to one and a half times in
 *     steps of ten percent, starting in the middle; double-click resets it.
 *   - the tile's colour. Automatic until changed here; a colour set by hand
 *     stays through re-pulls, and clearing the hex makes it automatic again.
 *
 * In browsers with no screen eyedropper (Firefox, Waterfox), the eyedropper
 * picks from the picture instead: a small copy of its pixels is fetched from
 * the server, the cursor becomes a crosshair over the picture, the colour
 * follows it live, and a click keeps it. Escape, or clicking or moving off the
 * picture, puts back what was there.
 *
 * What was pulled is sent with the form, so saving does not fetch the page a
 * second time. The server fetches it itself if nothing came through.
 */

const SCALE_MIN = 50;
const SCALE_MAX = 150;
const SCALE_STEP = 10;
const SCALE_NORMAL = 100;

type Sampler = { width: number; height: number; data: Uint8Array; before: string };

export default function WishLinkFields({
  href: initialHref,
  title: initialTitle,
  image: initialImage,
  site: initialSite,
  imageBg: initialBg,
  imageBgCustom: initialBgCustom,
  imageOverride: initialOverride,
  imageScale: initialScale,
}: {
  href: string;
  title: string;
  image: string;
  site: string;
  imageBg: string;
  imageBgCustom: boolean;
  imageOverride: string;
  imageScale: number;
}) {
  const [href, setHref] = useState(initialHref);
  const [pulled, setPulled] = useState({
    href: initialHref,
    image: initialImage,
    title: "",
    site: initialSite,
    // A stored colour chosen by hand is not the automatic one, so there is
    // no automatic one known until the link is pulled again.
    bg: initialBgCustom ? "" : initialBg,
  });
  const [loading, setLoading] = useState(false);
  const [override, setOverride] = useState(initialOverride);
  const [broken, setBroken] = useState(false);
  const [scale, setScale] = useState(initialScale || SCALE_NORMAL);
  const [customBg, setCustomBg] = useState(initialBgCustom ? initialBg : "");
  const request = useRef(0);

  // The picture eyedropper.
  const [sampler, setSampler] = useState<Sampler | null>(null);
  const [sampling, setSampling] = useState(false);
  const [sampleFailed, setSampleFailed] = useState(false);
  const picture = useRef<HTMLSpanElement>(null);

  const pull = async (target: string) => {
    const id = ++request.current;
    setLoading(true);
    try {
      const preview = await previewLink(target);
      // A slower answer for a link that has since been edited is thrown away.
      if (id !== request.current) return;
      setPulled({
        href: target,
        image: preview.image ?? "",
        title: preview.title ?? "",
        site: preview.site ?? "",
        bg: preview.imageBg ?? "",
      });
      setBroken(false);
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  // Debounced: pull once typing stops, not on every keystroke.
  useEffect(() => {
    const target = href.trim();
    if (!target || target === pulled.href) return;
    const timer = setTimeout(() => pull(target), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pulled.href is the guard, not a trigger
  }, [href]);

  const current = pulled.href === href.trim();
  const shown = override.trim() || (current ? pulled.image : "");

  // The automatic colour belongs to the pulled image only; a hand-set one
  // applies whatever the picture.
  const autoBg = current && !override.trim() && !broken ? pulled.bg : "";
  const background = customBg || autoBg;

  const siteLabel = href.trim()
    ? (current && pulled.site) ||
      siteFromHost(/^[a-z]+:/i.test(href.trim()) ? href.trim() : `https://${href.trim()}`)
    : "";

  /* ---------------------------------------------------------------- */
  /* Picture eyedropper                                                */
  /* ---------------------------------------------------------------- */

  const startSampling = async () => {
    if (!shown || broken || sampling) return;
    if (sampler) {
      // A second click on the button while picking cancels.
      setCustomBg(sampler.before);
      setSampler(null);
      return;
    }
    setSampling(true);
    setSampleFailed(false);
    try {
      const result = await sampleImage(shown);
      if (!result) {
        setSampleFailed(true);
        return;
      }
      const data = Uint8Array.from(atob(result.pixels), (c) => c.charCodeAt(0));
      setSampler({ width: result.width, height: result.height, data, before: customBg });
    } finally {
      setSampling(false);
    }
  };

  const stopSampling = (keep: boolean) => {
    if (!sampler) return;
    if (!keep) setCustomBg(sampler.before);
    setSampler(null);
  };

  /** The colour of the picture under the pointer, or null off the picture. */
  const colorAt = (event: React.PointerEvent | React.MouseEvent): string | null => {
    const box = picture.current?.getBoundingClientRect();
    if (!sampler || !box) return null;

    // Where the picture is drawn: fitted whole into the tile, centred, then
    // scaled about the centre by the size slider.
    const pictureAspect = sampler.width / sampler.height;
    const boxAspect = box.width / box.height;
    let drawnWidth = pictureAspect > boxAspect ? box.width : box.height * pictureAspect;
    let drawnHeight = pictureAspect > boxAspect ? box.width / pictureAspect : box.height;
    drawnWidth *= scale / 100;
    drawnHeight *= scale / 100;
    const left = box.left + (box.width - drawnWidth) / 2;
    const top = box.top + (box.height - drawnHeight) / 2;

    const u = (event.clientX - left) / drawnWidth;
    const v = (event.clientY - top) / drawnHeight;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;

    const x = Math.min(sampler.width - 1, Math.floor(u * sampler.width));
    const y = Math.min(sampler.height - 1, Math.floor(v * sampler.height));
    const i = (y * sampler.width + x) * 3;
    const channel = (n: number) => n.toString(16).padStart(2, "0");
    return `#${channel(sampler.data[i])}${channel(sampler.data[i + 1])}${channel(sampler.data[i + 2])}`;
  };

  // While picking: Escape, or a click anywhere but the picture, puts the colour back.
  useEffect(() => {
    if (!sampler) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stopSampling(false);
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const onButton = (target as Element).closest?.('[aria-pressed="true"]');
      if (!picture.current?.contains(target) && !onButton) stopSampling(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopSampling reads the sampler this effect was set up for
  }, [sampler]);

  // A new picture makes the copy being picked from wrong.
  const [sampledFor, setSampledFor] = useState(shown);
  if (shown !== sampledFor) {
    setSampledFor(shown);
    if (sampler) setSampler(null);
  }

  // Where the knob sits and where the middle is, as track percentages, for the
  // orange stretch between them.
  const at = ((scale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const middle = ((SCALE_NORMAL - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const steps = (SCALE_MAX - SCALE_MIN) / SCALE_STEP + 1;

  return (
    <>
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <label className="label">
            Link
            <input
              name="href"
              className="field"
              inputMode="url"
              placeholder="apple.com/…"
              required
              value={href}
              onChange={(event) => setHref(event.target.value)}
            />
          </label>

          <label className="label">
            Title
            <input
              name="title"
              className="field"
              placeholder={
                current && pulled.title ? pulled.title : "Taken from the page if left blank"
              }
              defaultValue={initialTitle}
            />
          </label>
        </div>

        {/* The picture, next to the link it came from. */}
        <div className="flex w-32 shrink-0 flex-col gap-1.5 sm:w-40">
          <span className="text-foreground/40">
            {loading ? "Pulling…" : override.trim() ? "Image (yours)" : "Image"}
          </span>
          <span
            ref={picture}
            className={`wish-image transition-opacity ${loading || sampling ? "opacity-50" : ""} ${
              sampler ? "picking" : ""
            }`}
            style={background ? { backgroundColor: background } : undefined}
            onPointerMove={(event) => {
              if (!sampler) return;
              const color = colorAt(event);
              setCustomBg(color ?? sampler.before);
            }}
            onPointerLeave={() => {
              if (sampler) setCustomBg(sampler.before);
            }}
            onClick={(event) => {
              if (!sampler) return;
              const color = colorAt(event);
              if (color) {
                setCustomBg(color);
                stopSampling(true);
              }
            }}
          >
            {shown && !broken ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote shop images
              <img
                src={shown}
                alt=""
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setBroken(true)}
                onLoad={() => setBroken(false)}
                style={{ transform: `scale(${scale / 100})`, transition: "transform 150ms ease" }}
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center px-2 text-center text-foreground/30">
                {loading ? "" : broken ? "Can't load" : "None found"}
              </span>
            )}
          </span>

          {/* Size. Double-click goes back to normal. */}
          <div className="flex flex-col gap-0.5 pt-1">
            <input
              type="range"
              name="imageScale"
              className="range"
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={SCALE_STEP}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              onDoubleClick={() => setScale(SCALE_NORMAL)}
              title={`${scale}% — double-click to reset`}
              aria-label="Image size"
              aria-valuetext={`${scale}%`}
              style={
                {
                  "--from": `${Math.min(at, middle)}%`,
                  "--to": `${Math.max(at, middle)}%`,
                } as React.CSSProperties
              }
            />
            <div className="range-ticks" aria-hidden="true">
              {Array.from({ length: steps }, (_, i) => (
                <span
                  key={i}
                  data-middle={SCALE_MIN + i * SCALE_STEP === SCALE_NORMAL ? "" : undefined}
                />
              ))}
            </div>
          </div>

          {/* The tile's colour. Shows the automatic one until set by hand. */}
          <ColorField
            value={background}
            onChange={setCustomBg}
            onEyedrop={shown && !broken ? startSampling : undefined}
            eyedropping={Boolean(sampler) || sampling}
            eyedropLabel="Pick a colour from the image"
          />

          {sampler ? (
            <span className="text-foreground/50">Click the image to pick. Esc cancels.</span>
          ) : sampleFailed ? (
            <span className="text-foreground/50">Couldn&rsquo;t read that image.</span>
          ) : null}

          {siteLabel && <span className="truncate text-foreground/50">{siteLabel}</span>}
          {href.trim() && !override.trim() && (
            <button
              type="button"
              onClick={() => pull(href.trim())}
              disabled={loading}
              className="w-max text-foreground/40 transition-colors hover:text-accent disabled:opacity-50"
            >
              Pull again
            </button>
          )}
        </div>
      </div>

      <input type="hidden" name="image" value={current ? pulled.image : ""} />
      <input type="hidden" name="pulledTitle" value={current ? pulled.title : ""} />
      <input type="hidden" name="pulledSite" value={current ? pulled.site : ""} />
      <input type="hidden" name="pulledBg" value={current ? pulled.bg : ""} />
      <input type="hidden" name="imageBgCustom" value={customBg} />

      <label className="label">
        Image
        <input
          name="imageOverride"
          className="field"
          inputMode="url"
          placeholder="Direct image link, to use instead of the pulled one"
          value={override}
          onChange={(event) => {
            setOverride(event.target.value);
            setBroken(false);
          }}
        />
      </label>
    </>
  );
}
