"use client";

import { useEffect, useState } from "react";
import { DIGITS, VINE_COLORS, growVine, type Layer, type Tip, type Vine } from "@/lib/vine";

/**
 * The 404 drawing: the number, and a vine grown through it.
 *
 * The vine is different on every visit, so it is grown here in the browser
 * from a fresh seed rather than on the server, where the page is built once
 * and every visitor would get that same plant. The number renders straight
 * away; the vine is added a frame later and grows in from there.
 *
 * Drawing order: growth behind the number, the number, growth in front of it,
 * then every flower and the bloom — flowers are never behind the number.
 */

const vars = (values: Record<string, string>) => values as React.CSSProperties;

function Flower({ tip }: { tip: Tip }) {
  return (
    <g className="vine-bloom" style={vars({ "--delay": `${tip.delay}s` })}>
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse key={i} cx={0} cy={-5} rx={3.2} ry={5} fill={tip.color} transform={`rotate(${i * 72})`} />
      ))}
      <circle r={2.1} fill={VINE_COLORS.center} />
    </g>
  );
}

function Bud({ tip }: { tip: Tip }) {
  return (
    <g className="vine-bloom" style={vars({ "--delay": `${tip.delay}s` })}>
      <path d="M0 1 C-3.5 -3 -3.5 -8 0 -11 C3.5 -8 3.5 -3 0 1 Z" fill={tip.color} />
      <path
        d="M0 1 C-2.5 -1 -4 -3 -4.5 -5 M0 1 C2.5 -1 4 -3 4.5 -5"
        fill="none"
        stroke={VINE_COLORS.stem.front}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </g>
  );
}

function Bloom({ x, y, delay }: Vine["bloom"]) {
  const [orange, pink] = VINE_COLORS.petals;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="vine-sway" style={vars({ "--delay": `${delay + 1.1}s` })}>
        <g className="vine-bloom vine-bloom-big" style={vars({ "--delay": `${delay}s` })}>
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={`back-${i}`} cx={0} cy={-12} rx={6.5} ry={12} fill={pink} transform={`rotate(${i * 45 + 22.5})`} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={`front-${i}`} cx={0} cy={-8.5} rx={4.8} ry={8.5} fill={orange} transform={`rotate(${i * 60})`} />
          ))}
          <circle r={4.6} fill={VINE_COLORS.center} />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={`dot-${i}`} r={0.9} cx={0} cy={-2.2} fill="#d98b2b" transform={`rotate(${i * 72})`} />
          ))}
        </g>
      </g>
    </g>
  );
}

/** Stems and leaves on one side of the digits. */
function Growth({ vine, layer }: { vine: Vine; layer: Layer }) {
  return (
    <g>
      {/* Leaves first, so stems run over their bases. */}
      {vine.leaves
        .filter((leaf) => leaf.layer === layer)
        .map((leaf, i) => (
          <g key={`leaf-${i}`} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotate}) scale(${leaf.scale})`}>
            <path
              className="vine-leaf"
              d="M0 0 C5 -6 13 -6 18 0 C13 6 5 6 0 0 Z"
              fill={leaf.fill}
              style={vars({ "--delay": `${leaf.delay}s` })}
            />
          </g>
        ))}

      {vine.lines
        .filter((line) => line.layer === layer)
        .map((line, i) => (
          <path
            key={`line-${i}`}
            className={line.stem ? "vine-stem" : "vine-branch"}
            d={line.d}
            pathLength={1}
            stroke={VINE_COLORS.stem[layer]}
            style={vars({
              "--delay": `${line.delay}s`,
              "--dur": `${line.duration}s`,
              "--w": `${line.width}`,
            })}
          />
        ))}
    </g>
  );
}

export default function VineArt() {
  const [vine, setVine] = useState<Vine | null>(null);

  useEffect(() => {
    // Grown after the first paint, so the number is on screen immediately and
    // the server's HTML and the browser's first render agree.
    const frame = requestAnimationFrame(() => setVine(growVine(Math.floor(Math.random() * 2 ** 32))));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    // The frame starts at y 1 rather than 0: the digits' strokes, caps
    // included, run from 32 to 230, so this puts their middle exactly in the
    // middle of the drawing.
    <svg viewBox="0 1 640 260" className="vine" aria-hidden="true">
      {vine && <Growth vine={vine} layer="back" />}
      <g className="vine-digits">
        {DIGITS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {vine && <Growth vine={vine} layer="front" />}
      {vine?.tips.map((tip, i) => (
        <g key={`tip-${i}`} transform={`translate(${tip.x} ${tip.y}) rotate(${tip.rotate}) scale(${tip.size})`}>
          {tip.kind === "flower" ? <Flower tip={tip} /> : <Bud tip={tip} />}
        </g>
      ))}
      {vine && <Bloom {...vine.bloom} />}
    </svg>
  );
}
