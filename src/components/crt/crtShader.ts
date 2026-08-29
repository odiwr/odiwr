import * as THREE from "three";

/**
 * The CRT screen material.
 *
 * This runs on the tube face itself rather than as a CSS layer over the
 * viewport, because everything it draws has to sit ON the glass: the mesh is a
 * 9x9 grid that bulges 6.6% of its own size, so the picture is genuinely curved
 * in 3D. A flat overlay would stay square to the window and slide off the tube
 * the moment you orbit.
 *
 * That curvature also means there is deliberately NO barrel distortion in here.
 * The usual `uv = uv + uv * r^2` trick exists to fake a bulge on a flat quad;
 * doing it on top of real curved geometry would bow the picture twice.
 *
 * Unlit on purpose. The reference is a dark room with the tube as the only
 * source, so the screen is emissive — it ignores scene lighting and instead
 * lights the bezel via a point light the scene parents to it.
 */

export type CrtUniforms = {
  uMap: { value: THREE.Texture | null };
  uTime: { value: number };
  /** 0..1 from the photosensitivity guard — pulls contrast toward mid grey. */
  uDamp: { value: number };
  /** Master brightness, also used to fade the tube up from black on start. */
  uGain: { value: number };
  /** Scanline darkness, 0..1. */
  uScan: { value: number };
  /** Aperture-grille strength, 0..1. */
  uMask: { value: number };
  /** Screen resolution in "phosphor" units — drives scanline/mask pitch. */
  uLines: { value: number };
  /** Halation strength — the warm glow bleeding out of bright areas. */
  uHalation: { value: number };
  /** The takeover clip, sampled when uMix is above zero. */
  uVideo: { value: THREE.Texture | null };
  /** 0 = visualiser, 1 = video. Only ever exactly one or the other. */
  uMix: { value: number };
  /**
   * UV scale that fits the clip to the tube by cropping rather than squashing.
   * The footage is 16:9 and the screen is 4:3, so without this it is stretched.
   */
  uVideoUv: { value: THREE.Vector2 };
  /** 0..1 burst of tuner static, used to mask the cut between the two. */
  uStatic: { value: number };
};

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uDamp;
  uniform float uGain;
  uniform float uScan;
  uniform float uMask;
  uniform float uLines;
  uniform float uHalation;
  uniform sampler2D uVideo;
  uniform float uMix;
  uniform vec2 uVideoUv;
  uniform float uStatic;

  varying vec2 vUv;

  // Cheap hash for grain and the occasional horizontal knock.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  /**
   * Sample whatever is currently on the tube.
   *
   * Every read of the picture has to go through here. Reading uMap directly
   * anywhere means that source keeps contributing even when the clip has taken
   * over — and because the visualiser is frozen while the clip plays, that
   * showed up as a still image ghosted over the video.
   *
   * The offset is scaled into the clip's cropped UV space so a tap lands the
   * same distance away in both sources.
   */
  vec3 tap(vec2 uvBase, vec2 vuvBase, vec2 d) {
    return mix(
      texture2D(uMap, uvBase + d).rgb,
      texture2D(uVideo, vuvBase + d * uVideoUv).rgb,
      uMix
    );
  }

  void main() {
    vec2 uv = vUv;

    // Horizontal instability: a slow drift plus a rare sharp jolt, so the
    // picture never feels perfectly locked the way a digital panel does.
    float jolt = step(0.998, hash(vec2(floor(uTime * 12.0), 3.7))) * 0.006;
    uv.x += sin(uv.y * 90.0 + uTime * 2.0) * 0.0006 + jolt;

    // Chromatic bleed. Real tubes misconverge slightly toward the edges, so
    // the offset grows with distance from centre rather than being uniform.
    float edge = length(uv - 0.5);
    float bleed = 0.0016 * (0.35 + edge * 1.6);
    // Pick the source FIRST, so whichever is on screen goes through the same
    // misconvergence, scanlines, mask and halation below. Compositing the video
    // over a finished CRT image instead would make it look like an overlay
    // rather than something the tube is displaying.
    vec3 src;
    src.r = texture2D(uMap, uv + vec2(bleed, 0.0)).r;
    src.g = texture2D(uMap, uv).g;
    src.b = texture2D(uMap, uv - vec2(bleed, 0.0)).b;

    // Cover-fit: scale about the centre so the clip fills the tube and the
    // overhang is cropped, instead of being squeezed into a different aspect.
    vec2 vuv = (uv - 0.5) * uVideoUv + 0.5;

    if (uMix > 0.0) {
      vec3 vid;
      vid.r = texture2D(uVideo, vuv + vec2(bleed, 0.0)).r;
      vid.g = texture2D(uVideo, vuv).g;
      vid.b = texture2D(uVideo, vuv - vec2(bleed, 0.0)).b;
      src = mix(src, vid, uMix);
    }

    vec3 col = src;

    // Bloom: sample a few neighbours and add back only what is already bright,
    // which is what makes highlights smear into the dark on a real tube.
    // Follows the active source, so it does not drag the paused visualiser in.
    vec3 glow = vec3(0.0);
    glow += tap(uv, vuv, vec2( 0.004, 0.0));
    glow += tap(uv, vuv, vec2(-0.004, 0.0));
    glow += tap(uv, vuv, vec2(0.0,  0.005));
    glow += tap(uv, vuv, vec2(0.0, -0.005));
    glow *= 0.25;
    col += max(glow - 0.45, 0.0) * 0.75;

    // Halation. Distinct from the bloom above: bloom is a tight highlight
    // smear, halation is the wide, warm ring you get when light punches through
    // the phosphor, scatters off the back of the glass and re-lights the layer
    // from behind. Broad, and biased red because the longer wavelengths scatter
    // furthest, which is why it reads warm even over a blue picture.
    //
    // Gathered here but ADDED AT THE VERY END, after the scanline, mask and
    // vignette passes. Two reasons, and the first pass got both wrong. Halation
    // happens in the glass, in front of the phosphor structure, so it should
    // not be scanline-modulated. And adding it early meant every one of those
    // multiplicative passes took a bite out of it, which is most of why it was
    // invisible.
    //
    // The subtracted floor was the other half. At 0.13 it sat above the mean
    // brightness of a typical preset, so halo clamped to exactly zero and the
    // effect genuinely did not exist on anything but a near-white frame.
    vec3 halo = vec3(0.0);
    const int RINGS = 8;
    for (int i = 0; i < RINGS; i++) {
      float a = (float(i) / float(RINGS)) * 6.2831853;
      vec2 dir = vec2(cos(a), sin(a));
      vec2 o1 = uv + dir * 0.024;
      vec2 o2 = uv + dir * 0.055;
      halo += texture2D(uMap, o1).rgb;
      halo += texture2D(uMap, o2).rgb * 0.7;
    }
    halo /= float(RINGS) * 1.7;
    // Floor raised well off the floor. At 0.035 almost every pixel qualified as
    // "bright enough to scatter", so the glow was applied to the whole picture
    // rather than to highlights, which is what made it overwhelming.
    halo = max(halo - 0.25, 0.0);

    // Scanlines. Pitch is tied to uLines so it stays put as the tube is
    // resized on screen instead of moiring against the display's pixels.
    float scan = sin(uv.y * uLines * 3.14159265);
    col *= 1.0 - uScan * (0.5 + 0.5 * scan) * 0.55;

    // Aperture grille: R/G/B struck in vertical triads.
    float m = mod(floor(uv.x * uLines * 1.3333), 3.0);
    vec3 triad = vec3(m == 0.0 ? 1.0 : 0.72, m == 1.0 ? 1.0 : 0.72, m == 2.0 ? 1.0 : 0.72);
    col *= mix(vec3(1.0), triad, uMask);

    // Vignette, plus a soft corner falloff so the picture dies before the mask.
    float vig = smoothstep(1.05, 0.30, edge);
    col *= mix(0.62, 1.0, vig);

    // Phosphor grain.
    col += (hash(uv * 600.0 + uTime) - 0.5) * 0.025;

    // Photosensitivity damping — collapse contrast toward mid grey rather than
    // just dimming, since dimming alone leaves the flicker intact.
    col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))) * 0.55 + 0.08, uDamp);

    col = max(col, 0.0) * uGain;

    // Halation goes on last, over the phosphor structure rather than under it.
    //
    // Scaled to nothing on the clips. Halation is a phosphor artefact, and the
    // footage is already a finished image; glowing it just looks like a blown
    // exposure. Only the visualiser gets it.
    col += halo * vec3(1.0, 0.52, 0.34) * uHalation * (1.0 - uMix);

    // Highlight rolloff.
    //
    // This material is unlit and toneMapped:false, so nothing downstream ever
    // compresses it — every value above 1 simply clipped to flat white, and the
    // additive passes above push well past 1 on bright content. That clipping,
    // not the bloom, is what read as the screen being blown out. Values below
    // the knee are untouched; above it they roll off instead of hitting a wall.
    col = col / (1.0 + max(col - 0.8, vec3(0.0)));

    // Tuner static, bursting on each cut between the visualiser and the clip.
    // Noise is re-seeded per frame from uTime so it crawls, and torn into
    // horizontal bands because a lost lock breaks up by line, not by pixel.
    if (uStatic > 0.0) {
      float band = floor(uv.y * uLines * 0.5);
      float n = hash(vec2(floor(uv.x * 320.0), band) + fract(uTime) * 91.7);
      float roll = step(0.86, hash(vec2(band, floor(uTime * 24.0))));
      vec3 snow = vec3(n) * (0.55 + roll * 0.65);
      col = mix(col, snow, clamp(uStatic, 0.0, 1.0) * 0.92);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createCrtMaterial(map: THREE.Texture | null) {
  const uniforms: CrtUniforms = {
    uMap: { value: map },
    uTime: { value: 0 },
    uDamp: { value: 0 },
    uGain: { value: 0 },
    uScan: { value: 0.36 },
    uMask: { value: 0.24 },
    uLines: { value: 480 },
    uHalation: { value: 1.0 },
    uVideo: { value: null },
    uMix: { value: 0 },
    uVideoUv: { value: new THREE.Vector2(1, 1) },
    uStatic: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: vertex,
    fragmentShader: fragment,
    // The tube is the light source in this scene, not a lit surface.
    lights: false,
    toneMapped: false,
  });

  return { material, uniforms };
}
