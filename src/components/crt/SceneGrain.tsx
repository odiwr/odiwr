"use client";

/**
 * Fixed animated film grain over the whole scene.
 *
 * Sits above the canvas and below the UI, pinned to the viewport rather than to
 * the model — grain belongs to the image, not to the object, so it must not
 * move when the camera orbits.
 *
 * The texture is an inline SVG turbulence filter, so nothing is fetched. It is
 * animated by JUMPING between offsets on discrete steps rather than sliding:
 * real film grain is uncorrelated frame to frame, and a smoothly translating
 * texture reads as a sheet of moving sandpaper instead.
 *
 * The layer is oversized and inset so the jitter can never expose an edge.
 */

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.74' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)'/%3E%3C/svg%3E\")";

export default function SceneGrain({ opacity = 0.42 }: { opacity?: number }) {
  return (
    <>
      <div
        aria-hidden
        className="crt-scene-grain"
        style={{
          position: "fixed",
          inset: "-15%",
          backgroundImage: GRAIN_URL,
          backgroundSize: "240px 240px",
          opacity,
          // Screen-ish blending keeps the grain visible in the near-black
          // corners; multiply would simply vanish there, which is where a real
          // grain structure is most obvious.
          mixBlendMode: "overlay",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <style>{`
        @keyframes crt-grain-jitter {
          0%   { transform: translate3d(0, 0, 0); }
          10%  { transform: translate3d(-4%, 3%, 0); }
          20%  { transform: translate3d(3%, -5%, 0); }
          30%  { transform: translate3d(-6%, -2%, 0); }
          40%  { transform: translate3d(5%, 4%, 0); }
          50%  { transform: translate3d(-2%, 6%, 0); }
          60%  { transform: translate3d(6%, -3%, 0); }
          70%  { transform: translate3d(-5%, -6%, 0); }
          80%  { transform: translate3d(2%, 5%, 0); }
          90%  { transform: translate3d(-3%, -4%, 0); }
        }
        .crt-scene-grain {
          animation: crt-grain-jitter 0.8s steps(1, end) infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .crt-scene-grain { animation: none; }
        }
      `}</style>
    </>
  );
}
