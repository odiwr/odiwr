"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/icons";

import type { AmpPlayer } from "./useAmpPlayer";

/**
 * The overlay.
 *
 * A small window in the bottom-left corner that slides up when opened, and a
 * single letter in the top-right corner the rest of the time. Nothing dims or
 * blurs behind it: the panel is compact enough to sit beside the scene rather
 * than over it, so the tube stays watchable while the controls are open.
 *
 * The window chrome follows the reference — a raised grey title bar carrying
 * only the minimise / maximise / close boxes, no caption text, square bevels
 * drawn with two-tone borders rather than a radius. Those bevels are the whole
 * look, so they are real light/dark border pairs, not a drop shadow.
 *
 * The top-right corner is one slot shared by two labels. On load the intro hint
 * animates in from the right; the first space press sends it back out and
 * brings the "H" affordance in behind it, on a short delay so the two cross
 * rather than swap.
 */

/* Reference tokens. */
const TITLE = "#0a5fd4";
const FACE = "#d4d0c8";
const LIGHT = "#ffffff";
const SHADOW = "#808080";
const DARK = "#404040";
const TEXT = "#101010";

const pixel: React.CSSProperties = {
  fontFamily: "var(--font-vcr), ui-monospace, monospace",
  letterSpacing: "0.06em",
};
const sans: React.CSSProperties = {
  fontFamily: "var(--font-archivo), Arial, sans-serif",
};

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  player: AmpPlayer;
  /** While true the corner shows the intro hint instead of the "H" affordance. */
  hintShown: boolean;
  hidden: boolean;
  /** True during the close-up, when the corner letter gets out of the way. */
  focused: boolean;
  onToggleHide: () => void;
  visualiserReady: boolean;
  visualiserFailed: boolean;
};

export default function CrtOverlay({
  player,
  hintShown,
  hidden,
  focused,
  onToggleHide,
  visualiserReady,
  visualiserFailed,
}: Props) {
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

  // The hint has to ANIMATE in, which means it must first paint in its offset
  // state and only then be told to settle. Rendering it already in place would
  // give it nothing to transition from, so it would simply appear.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const hintIn = hintShown && entered;

  return (
    <>
      <style>{`
        /* Bevels: light on the top/left, dark on the bottom/right, which is
           what makes a flat grey rectangle read as a raised control. */
        .rw-raise {
          border-top: 1px solid ${LIGHT};
          border-left: 1px solid ${LIGHT};
          border-right: 1px solid ${DARK};
          border-bottom: 1px solid ${DARK};
          box-shadow: inset -1px -1px 0 ${SHADOW}, inset 1px 1px 0 ${FACE};
        }
        .rw-sink {
          border-top: 1px solid ${SHADOW};
          border-left: 1px solid ${SHADOW};
          border-right: 1px solid ${LIGHT};
          border-bottom: 1px solid ${LIGHT};
        }

        .rw-btn {
          font-family: var(--font-archivo), Arial, sans-serif;
          font-weight: 700;
          font-size: 11px;
          color: ${TEXT};
          background: ${FACE};
          padding: 5px 9px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .rw-btn:active { border-color: ${DARK} ${LIGHT} ${LIGHT} ${DARK}; }
        .rw-btn:disabled { color: ${SHADOW}; cursor: default; }

        /* Title-bar boxes. Small, square, and evenly sized like the reference. */
        .rw-box {
          width: 16px; height: 14px;
          background: ${FACE};
          display: grid; place-items: center;
          cursor: pointer; padding: 0;
          font-family: var(--font-archivo), Arial, sans-serif;
          font-size: 9px; font-weight: 700; line-height: 1; color: ${TEXT};
        }

        .rw-row {
          font-family: var(--font-archivo), Arial, sans-serif;
          font-size: 11px;
          display: block; width: 100%; text-align: left;
          padding: 3px 6px; border: none; background: transparent;
          color: ${TEXT}; cursor: pointer;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rw-row:hover { background: #c0dcf0; }
        .rw-row[data-current="true"] { background: #b8b4ac; color: ${TEXT}; font-weight: 700; }

        .rw-seek {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 12px; background: transparent; cursor: pointer;
        }
        .rw-seek::-webkit-slider-runnable-track {
          height: 8px; background: ${LIGHT};
          border-top: 1px solid ${SHADOW}; border-left: 1px solid ${SHADOW};
          border-right: 1px solid ${LIGHT}; border-bottom: 1px solid ${LIGHT};
        }
        .rw-seek::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 9px; height: 14px; margin-top: -4px;
          background: ${FACE};
          border-top: 1px solid ${LIGHT}; border-left: 1px solid ${LIGHT};
          border-right: 1px solid ${DARK}; border-bottom: 1px solid ${DARK};
        }
        .rw-seek::-moz-range-track { height: 8px; background: ${LIGHT}; border: 1px solid ${SHADOW}; }
        .rw-seek::-moz-range-thumb {
          width: 9px; height: 14px; border-radius: 0;
          background: ${FACE}; border: 1px solid ${DARK};
        }
      `}</style>

      {/* One corner slot, two occupants, crossing in place. Fades out entirely
          during the close-up so nothing sits over the shot. */}
      <div
        style={{
          position: "fixed",
          top: 18,
          right: 22,
          zIndex: 4,
          opacity: focused ? 0 : 1,
          pointerEvents: focused ? "none" : "auto",
          transition: "opacity 420ms ease",
          display: "grid",
          gridTemplateAreas: '"slot"',
          justifyItems: "end",
          alignItems: "center",
        }}
      >
        <div
          aria-hidden={!hintShown}
          style={{
            gridArea: "slot",
            ...pixel,
            fontSize: 13,
            lineHeight: 1,
            color: "rgba(226, 236, 246, 0.62)",
            display: "flex",
            alignItems: "center",
            gap: 7,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: hintIn ? 1 : 0,
            transform: hintIn ? "translateX(0)" : "translateX(28px)",
            transition: "opacity 420ms ease, transform 420ms cubic-bezier(0.2, 0.7, 0.2, 1)",
          }}
        >
          <span>space to</span>
          <Icon name="material-symbols:play-arrow-rounded" size="14px" title="play" />
        </div>

        <button
          type="button"
          onClick={onToggleHide}
          aria-label={hidden ? "Show controls" : "Hide controls"}
          aria-expanded={!hidden}
          tabIndex={hintShown ? -1 : 0}
          style={{
            gridArea: "slot",
            ...pixel,
            fontSize: 15,
            lineHeight: 1,
            color: hidden ? "rgba(226, 236, 246, 0.62)" : "#e2ecf6",
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            opacity: hintShown ? 0 : 1,
            transform: hintShown ? "translateX(28px)" : "translateX(0)",
            pointerEvents: hintShown ? "none" : "auto",
            transition:
              "opacity 420ms ease 120ms, transform 420ms cubic-bezier(0.2, 0.7, 0.2, 1) 120ms, color 200ms ease",
          }}
        >
          H
        </button>
      </div>

      {/* The window. Slides up from the bottom-left; nothing behind it changes,
          so the scene stays fully visible while it is open. */}
      <div
        className="rw-raise"
        aria-hidden={hidden}
        style={{
          position: "fixed",
          left: 20,
          bottom: 20,
          zIndex: 3,
          width: 258,
          background: FACE,
          color: TEXT,
          display: "flex",
          flexDirection: "column",
          opacity: hidden ? 0 : 1,
          transform: hidden ? "translateY(18px)" : "translateY(0)",
          pointerEvents: hidden ? "none" : "auto",
          transition:
            "opacity 200ms ease, transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        }}
      >
        {/* title bar — blue, boxes only, no caption */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 2,
            background: TITLE,
            padding: 2,
            margin: 2,
          }}
        >
          <button type="button" className="rw-box rw-raise" aria-label="Minimise" onClick={onToggleHide}>
            _
          </button>
          <button type="button" className="rw-box rw-raise" aria-label="Maximise" disabled>
            □
          </button>
          <button type="button" className="rw-box rw-raise" aria-label="Close" onClick={onToggleHide}>
            ×
          </button>
        </div>

        <div
          className="rw-sink"
          style={{ margin: 3, padding: 8, display: "flex", flexDirection: "column", gap: 9 }}
        >
          {/* now playing */}
          <div>
            <div
              style={{
                ...sans,
                fontSize: 9,
                fontWeight: 700,
                color: "#505050",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {visualiserFailed
                ? "Visualiser unavailable"
                : visualiserReady
                  ? "Now playing"
                  : "Press play to start"}
            </div>
            <div
              style={{
                ...pixel,
                fontSize: 13,
                marginTop: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {player.track?.title ?? (player.ready ? "No tracks found" : "Loading...")}
            </div>
            <div
              style={{
                ...sans,
                fontSize: 10,
                color: "#404040",
                marginTop: 2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {player.track?.artist || "—"}
            </div>
          </div>

          {/* transport */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button type="button" className="rw-btn rw-raise" onClick={player.prev} aria-label="Previous">
              <Icon name="material-symbols:skip-previous-rounded" size="12px" />
            </button>
            <button
              type="button"
              className="rw-btn rw-raise"
              onClick={player.toggle}
              aria-label={player.playing ? "Pause" : "Play"}
            >
              {player.playing ? (
                <Icon name="material-symbols:pause-rounded" size="12px" />
              ) : (
                <Icon name="material-symbols:play-arrow-rounded" size="12px" />
              )}
            </button>
            <button type="button" className="rw-btn rw-raise" onClick={player.next} aria-label="Next">
              <Icon name="material-symbols:skip-next-rounded" size="12px" />
            </button>
            <span style={{ ...sans, fontSize: 10, color: "#404040", marginLeft: "auto" }}>
              {clock(player.currentTime)} / {player.duration ? clock(player.duration) : "--:--"}
            </span>
          </div>

          <input
            type="range"
            className="rw-seek"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={(e) => player.seek(Number(e.target.value) / 1000)}
            disabled={!player.duration}
            aria-label="Seek"
          />

          {/* playlist */}
          <div
            className="rw-sink"
            style={{
              height: 78,
              overflowY: "auto",
              background: LIGHT,
              padding: 1,
            }}
          >
            {player.tracks.length === 0 && (
              <div style={{ ...sans, fontSize: 10, color: "#505050", padding: "4px 6px" }}>
                {player.ready ? "No tracks in the R2 music folder." : "Reading the music folder..."}
              </div>
            )}
            {player.tracks.map((t, i) => (
              <button
                key={t.src}
                type="button"
                className="rw-row"
                data-current={i === player.current}
                onClick={() => {
                  player.select(i);
                  player.play();
                }}
              >
                {String(i + 1).padStart(2, "0")}
                {"  "}
                {t.artist ? `${t.title} — ${t.artist}` : t.title}
              </button>
            ))}
          </div>

          <div
            style={{
              ...sans,
              fontSize: 9,
              fontWeight: 700,
              color: "#505050",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            F focus · H close · drag to orbit
          </div>
        </div>
      </div>

      <audio {...player.audioProps} />
    </>
  );
}
