"use client";

import { useEffect, useRef, useState } from "react";
import { previewLink } from "@/app/dashboard/(app)/actions";
import { sampleImage } from "@/app/dashboard/(app)/image-actions";
import Icon from "@/components/icons";
import ColorField from "./ColorField";
import {
  MAX_GRADIENT_POINTS,
  backgroundStyle,
  formatBackground,
  gradientPoints,
  isGradient,
  siteFromHost,
  type GradientPoint,
} from "@/lib/wish";

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
 * The colour set by hand is a list of stops, edited under the colour field: +
 * adds one (up to seven), and two or more make the tile a gradient. Each stop
 * shows as a dot on the picture, dragged to move it; selecting a stop (its
 * swatch, or its dot) points the colour field, hex, picker and eyedropper at
 * it. × or emptying the hex removes the selected stop; emptying the last one
 * hands the tile back to its automatic background. Shift-clicking the picture
 * adds a stop there in the colour under the pointer.
 *
 * The price is filled in from the page too, when it states one in dollars. It
 * only ever fills an empty field, or replaces the price it filled in itself; a
 * price typed by hand stays through a re-pull.
 *
 * What was pulled is sent with the form, so saving does not fetch the page a
 * second time. The server fetches it itself if nothing came through.
 */

const SCALE_MIN = 50;
const SCALE_MAX = 150;
const SCALE_STEP = 10;
const SCALE_NORMAL = 100;

type Pixels = { width: number; height: number; data: Uint8Array };
type Sampler = Pixels;

/** Where a new gradient stop goes: the first of these spots nothing is already near. */
const SPOTS = [
  { x: 50, y: 100 },
  { x: 50, y: 0 },
  { x: 0, y: 50 },
  { x: 100, y: 50 },
  { x: 0, y: 0 },
  { x: 100, y: 100 },
  { x: 100, y: 0 },
  { x: 0, y: 100 },
];

export default function WishLinkFields({
  href: initialHref,
  title: initialTitle,
  image: initialImage,
  site: initialSite,
  siteCustom: initialSiteCustom,
  imageBg: initialBg,
  imageBgCustom: initialBgCustom,
  imageOverride: initialOverride,
  imageScale: initialScale,
  price: initialPrice,
  category,
  toggles,
}: {
  href: string;
  title: string;
  image: string;
  site: string;
  siteCustom: boolean;
  imageBg: string;
  imageBgCustom: boolean;
  imageOverride: string;
  imageScale: number;
  price: string;
  /** The category picker, which sits between the image field and the price. */
  category: React.ReactNode;
  /** The switches beside the price. */
  toggles: React.ReactNode;
}) {
  const [href, setHref] = useState(initialHref);
  const [pulled, setPulled] = useState({
    href: initialHref,
    image: initialImage,
    title: "",
    // Likewise a typed shop name is not the one the page gave.
    site: initialSiteCustom ? "" : initialSite,
    // A stored colour chosen by hand is not the automatic one, so there is
    // no automatic one known until the link is pulled again.
    bg: initialBgCustom ? "" : initialBg,
  });
  const [loading, setLoading] = useState(false);
  const [override, setOverride] = useState(initialOverride);
  const [broken, setBroken] = useState(false);
  const [scale, setScale] = useState(initialScale || SCALE_NORMAL);
  /**
   * The tile colour set by hand, as stops: none is automatic, one is a plain
   * colour, two to seven a gradient. Kept as stops rather than the stored string
   * because a single stop is stored as a bare colour, which forgets where it was.
   */
  const [stops, setStops] = useState<GradientPoint[]>(() => {
    if (!initialBgCustom || !initialBg) return [];
    const points = gradientPoints(initialBg);
    return points.length ? points : [{ color: initialBg, x: 50, y: 50 }];
  });
  /** The stop the colour field is editing. */
  const [selected, setSelected] = useState(0);
  /** A colour being tried on the selected stop (the picture eyedropper, hovering). */
  const [trying, setTrying] = useState<string | null>(null);
  /** The same stops, for handlers that run after an await. */
  const stopsRef = useRef(stops);
  /** A shop name typed over the pulled one; empty means use the pulled one. */
  const [siteOverride, setSiteOverride] = useState(initialSiteCustom ? initialSite : "");
  const [price, setPrice] = useState(initialPrice);
  /** The last price filled in from a page, so a re-pull knows it may replace it. */
  const [autoPrice, setAutoPrice] = useState("");
  const request = useRef(0);

  // The picture eyedropper.
  const [sampler, setSampler] = useState<Sampler | null>(null);
  const [sampling, setSampling] = useState(false);
  const [sampleFailed, setSampleFailed] = useState(false);
  const picture = useRef<HTMLSpanElement>(null);
  /** The picture's pixels, once fetched, for the image they came from. */
  const pixelCache = useRef<{ src: string; pixels: Pixels } | null>(null);

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

      const found = preview.price !== undefined ? String(preview.price) : "";
      setPrice((current) => (!current.trim() || current === autoPrice ? found : current));
      setAutoPrice(found);
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
  const active = Math.min(selected, Math.max(0, stops.length - 1));
  const customBg = formatBackground(stops);
  // What the picture shows, including a colour only being tried.
  const background =
    formatBackground(
      trying !== null && stops.length
        ? stops.map((stop, i) => (i === active ? { ...stop, color: trying } : stop))
        : trying !== null
          ? [{ color: trying, x: 50, y: 50 }]
          : stops
    ) || autoBg;
  // An automatic gradient has no one hex to show, so the field says so and its
  // swatch shows the gradient itself.
  const autoGradient = !stops.length && trying === null && isGradient(autoBg);

  const siteLabel = href.trim()
    ? (current && pulled.site) ||
      siteFromHost(/^[a-z]+:/i.test(href.trim()) ? href.trim() : `https://${href.trim()}`)
    : "";

  /* ---------------------------------------------------------------- */
  /* Picture eyedropper                                                */
  /* ---------------------------------------------------------------- */

  const commitStops = (next: GradientPoint[], select?: number) => {
    stopsRef.current = next;
    setStops(next);
    if (select !== undefined) setSelected(select);
  };

  /**
   * The colour field's value, for the selected stop. With no stops yet it
   * becomes the one stop. Emptied, it removes the selected stop; emptied with
   * only one left, the tile goes back to automatic.
   */
  const setStopColor = (hex: string) => {
    const now = stopsRef.current;
    if (!hex) {
      if (now.length <= 1) commitStops([], 0);
      else commitStops(now.filter((_, i) => i !== active), Math.max(0, active - 1));
      return;
    }
    if (!now.length) commitStops([{ color: hex, x: 50, y: 50 }], 0);
    else commitStops(now.map((stop, i) => (i === active ? { ...stop, color: hex } : stop)));
  };

  /** Adds a stop, in the selected stop's colour, ready to be changed and moved. */
  const addStop = () => {
    let now = stopsRef.current;
    if (!now.length) {
      // Start from what the tile shows now: its automatic gradient's points, or
      // its automatic colour.
      const auto = gradientPoints(autoBg);
      now = auto.length ? auto : [{ color: autoBg || "#242424", x: 50, y: 50 }];
    }
    if (now.length >= MAX_GRADIENT_POINTS) return;
    // A lone stop has no position that matters yet; the pair runs top to bottom.
    if (now.length === 1) now = [{ ...now[0], x: 50, y: 0 }];
    const near = (spot: { x: number; y: number }) =>
      now.some((stop) => Math.hypot(stop.x - spot.x, stop.y - spot.y) < 20);
    const spot = SPOTS.find((s) => !near(s)) ?? { x: 50, y: 50 };
    const color = now[Math.min(active, now.length - 1)].color;
    commitStops([...now, { color, ...spot }], now.length);
  };

  /** Drags a stop's dot across the picture. Its colour stays as it is. */
  const dragStop = (index: number, event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(index);
    const dot = event.currentTarget;
    dot.setPointerCapture(event.pointerId);
    const move = (clientX: number, clientY: number) => {
      const box = picture.current?.getBoundingClientRect();
      if (!box) return;
      const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
      commitStops(
        stopsRef.current.map((stop, i) =>
          i === index
            ? {
                ...stop,
                x: clamp(((clientX - box.left) / box.width) * 100),
                y: clamp(((clientY - box.top) / box.height) * 100),
              }
            : stop
        )
      );
    };
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onUp = () => {
      dot.removeEventListener("pointermove", onMove);
      dot.removeEventListener("pointerup", onUp);
      dot.removeEventListener("pointercancel", onUp);
    };
    dot.addEventListener("pointermove", onMove);
    dot.addEventListener("pointerup", onUp);
    dot.addEventListener("pointercancel", onUp);
  };

  /** The picture's pixels, fetched from the server the first time they are needed. */
  const loadPixels = async (): Promise<Pixels | null> => {
    if (!shown) return null;
    if (pixelCache.current?.src === shown) return pixelCache.current.pixels;
    setSampling(true);
    setSampleFailed(false);
    try {
      const result = await sampleImage(shown);
      if (!result) {
        setSampleFailed(true);
        return null;
      }
      const data = Uint8Array.from(atob(result.pixels), (c) => c.charCodeAt(0));
      const pixels = { width: result.width, height: result.height, data };
      pixelCache.current = { src: shown, pixels };
      return pixels;
    } finally {
      setSampling(false);
    }
  };

  const startSampling = async () => {
    if (!shown || broken || sampling) return;
    if (sampler) {
      // A second click on the button while picking cancels.
      setTrying(null);
      setSampler(null);
      return;
    }
    const pixels = await loadPixels();
    if (pixels) setSampler(pixels);
  };

  const stopSampling = () => {
    if (!sampler) return;
    setTrying(null);
    setSampler(null);
  };

  /** Adds a stop where the picture was shift-clicked, in the colour there. */
  const addStopAt = async (clientX: number, clientY: number) => {
    const box = picture.current?.getBoundingClientRect();
    if (!box || !shown || broken || stopsRef.current.length >= MAX_GRADIENT_POINTS) return;
    const pixels = sampler ?? (await loadPixels());
    if (!pixels) return;
    // A point in the tile around the photo takes the colour at the photo's
    // nearest edge, which is what that space continues.
    const color = readAt(pixels, box, clientX, clientY, true);
    if (!color) return;
    const stop = {
      color,
      x: Math.round(((clientX - box.left) / box.width) * 100),
      y: Math.round(((clientY - box.top) / box.height) * 100),
    };
    const now = stopsRef.current;
    commitStops([...now, stop], now.length);
  };

  /** The colour of the picture under the pointer, or null off the picture. */
  const colorAt = (event: React.PointerEvent | React.MouseEvent): string | null => {
    const box = picture.current?.getBoundingClientRect();
    if (!sampler || !box) return null;
    return readAt(sampler, box, event.clientX, event.clientY);
  };

  /** The colour of the picture at a point on screen, or null off the picture. */
  const readAt = (
    pixels: Pixels,
    box: DOMRect,
    clientX: number,
    clientY: number,
    /** Read the nearest edge of the picture when the point is off it, rather than nothing. */
    nearest = false
  ): string | null => {
    // Where the picture is drawn: fitted whole into the tile, centred, then
    // scaled about the centre by the size slider.
    const pictureAspect = pixels.width / pixels.height;
    const boxAspect = box.width / box.height;
    let drawnWidth = pictureAspect > boxAspect ? box.width : box.height * pictureAspect;
    let drawnHeight = pictureAspect > boxAspect ? box.width / pictureAspect : box.height;
    drawnWidth *= scale / 100;
    drawnHeight *= scale / 100;
    const left = box.left + (box.width - drawnWidth) / 2;
    const top = box.top + (box.height - drawnHeight) / 2;

    let u = (clientX - left) / drawnWidth;
    let v = (clientY - top) / drawnHeight;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) {
      if (!nearest) return null;
      u = Math.min(0.999, Math.max(0, u));
      v = Math.min(0.999, Math.max(0, v));
    }

    const x = Math.min(pixels.width - 1, Math.floor(u * pixels.width));
    const y = Math.min(pixels.height - 1, Math.floor(v * pixels.height));
    const i = (y * pixels.width + x) * 3;
    const channel = (n: number) => n.toString(16).padStart(2, "0");
    return `#${channel(pixels.data[i])}${channel(pixels.data[i + 1])}${channel(pixels.data[i + 2])}`;
  };

  // While picking: Escape, or a click anywhere but the picture, puts the colour back.
  useEffect(() => {
    if (!sampler) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stopSampling();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const onButton = (target as Element).closest?.('[aria-pressed="true"]');
      if (!picture.current?.contains(target) && !onButton) stopSampling();
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
          <div className="relative">
            <span
              ref={picture}
              className={`wish-image transition-opacity ${loading || sampling ? "opacity-50" : ""} ${
                sampler ? "picking" : ""
              }`}
              style={backgroundStyle(background)}
              onPointerMove={(event) => {
                if (sampler) setTrying(colorAt(event));
              }}
              onPointerLeave={() => {
                if (sampler) setTrying(null);
              }}
              onClick={(event) => {
                if (event.shiftKey) {
                  addStopAt(event.clientX, event.clientY);
                  return;
                }
                if (!sampler) return;
                const color = colorAt(event);
                if (color) {
                  setStopColor(color);
                  stopSampling();
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

            {/* A gradient's stops, where they sit. Drag to move one; the selected
                one is the one the colour field is editing. Over the picture
                rather than in it, so a stop on the edge is not cut in half. */}
            {stops.length > 1 && (
              <span className="gradient-layer">
                {stops.map((stop, i) => (
                  <span
                    key={i}
                    className="gradient-dot"
                    data-selected={i === active ? "" : undefined}
                    style={{
                      left: `${stop.x}%`,
                      top: `${stop.y}%`,
                      backgroundColor: i === active && trying ? trying : stop.color,
                    }}
                    onPointerDown={(event) => dragStop(i, event)}
                    aria-hidden="true"
                  />
                ))}
              </span>
            )}
          </div>

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
            value={
              trying ?? (stops.length ? stops[active].color : autoGradient ? "" : autoBg)
            }
            placeholder={autoGradient ? "gradient" : "auto"}
            swatch={autoGradient ? backgroundStyle(autoBg) : undefined}
            onChange={setStopColor}
            onEyedrop={shown && !broken ? startSampling : undefined}
            eyedropping={Boolean(sampler) || sampling}
            eyedropLabel="Pick a colour from the image"
          />

          {/* The stops: pick one to edit it above, + for another (up to seven),
              × to remove the selected one. */}
          <div className="gradient-stops">
            {stops.length > 1 &&
              stops.map((stop, i) => (
                <button
                  key={i}
                  type="button"
                  className="gradient-stop"
                  aria-label={`Colour stop ${i + 1}`}
                  aria-pressed={i === active}
                  style={{ backgroundColor: i === active && trying ? trying : stop.color }}
                  onClick={() => setSelected(i)}
                />
              ))}
            {(stops.length || autoBg) && stops.length < MAX_GRADIENT_POINTS ? (
              <button
                type="button"
                className="gradient-action"
                aria-label="Add a colour stop"
                onClick={addStop}
              >
                <Icon name="material-symbols:add-rounded" size="1.1em" />
              </button>
            ) : null}
            {stops.length > 1 && (
              <button
                type="button"
                className="gradient-action"
                aria-label="Remove this colour stop"
                onClick={() => setStopColor("")}
              >
                <Icon name="material-symbols:close-rounded" size="1em" />
              </button>
            )}
          </div>

          {sampleFailed && (
            <span className="text-foreground/50">Couldn&rsquo;t read that image.</span>
          )}

          {/* The shop's name, as pulled. Typing replaces it; clearing it goes
              back to the pulled one. */}
          {href.trim() && (
            <input
              value={siteOverride}
              placeholder={siteLabel}
              onChange={(event) => setSiteOverride(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              spellCheck={false}
              autoComplete="off"
              aria-label="Shop name"
              className="site-name"
            />
          )}
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
      <input type="hidden" name="siteOverride" value={siteOverride.trim()} />
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

      {category}

      {/* Price on the left, the switches for how it shows on the site beside it. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="label w-40">
          {loading ? "Price…" : "Price"}
          <span className="price-field">
            <input
              name="price"
              className="field"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </span>
        </label>

        <div className="flex h-11 items-center gap-6">{toggles}</div>
      </div>
    </>
  );
}
