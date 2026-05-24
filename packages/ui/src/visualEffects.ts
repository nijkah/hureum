export interface VisualEffectPreset {
  id: string;
  label: string;
  description: string;
  fragmentBody: string;
}

export interface GlobalVisualEffectPreset {
  id: string;
  label: string;
  description: string;
}

export const cameraPassthroughFragment = `
let cameraColor = camera(uv);
return vec4<f32>(cameraColor.rgb, 1.0);
`.trim();

export const monochromeFragment = `
let color = camera(uv).rgb;
let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
return vec4<f32>(vec3<f32>(luma), 1.0);
`.trim();

export const highContrastMonoFragment = `
let color = camera(uv).rgb;
let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
let contrast = smoothstep(0.32, 0.78, luma + params.level * 0.12);
return vec4<f32>(vec3<f32>(contrast), 1.0);
`.trim();

export const sepiaToneFragment = `
let color = camera(uv).rgb;
let sepia = vec3<f32>(
  dot(color, vec3<f32>(0.393, 0.769, 0.189)),
  dot(color, vec3<f32>(0.349, 0.686, 0.168)),
  dot(color, vec3<f32>(0.272, 0.534, 0.131))
);
let lifted = mix(color, sepia, 0.74) * vec3<f32>(1.04, 0.98, 0.88);
return vec4<f32>(clamp(lifted, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const coolToneFragment = `
let color = camera(uv).rgb;
let cool = vec3<f32>(
  color.r * 0.72 + color.g * 0.08,
  color.g * 1.02 + color.b * 0.04,
  color.b * 1.18 + color.r * 0.08
);
let vignette = 1.0 - smoothstep(0.42, 0.92, distance(uv, vec2<f32>(0.5, 0.5)));
return vec4<f32>(clamp(cool * (0.78 + vignette * 0.28), vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const duotoneFragment = `
let color = camera(uv).rgb;
let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
let shadow = vec3<f32>(0.015, 0.07, 0.13);
let highlight = vec3<f32>(1.0, 0.56, 0.22);
let mapped = mix(shadow, highlight, smoothstep(0.04, 0.96, luma));
return vec4<f32>(clamp(mapped + color * 0.12, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const colorPopFragment = `
let color = camera(uv).rgb;
let luma = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
let saturated = pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(0.82)) * vec3<f32>(1.08, 1.04, 1.16);
let mixed = mix(vec3<f32>(luma), saturated, 0.86 + params.treble * 0.18);
return vec4<f32>(clamp(mixed, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const edgeSketchFragment = `
let px = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0));
let l00 = dot(camera(uv + px * vec2<f32>(-1.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l10 = dot(camera(uv + px * vec2<f32>(0.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l20 = dot(camera(uv + px * vec2<f32>(1.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l01 = dot(camera(uv + px * vec2<f32>(-1.0, 0.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l21 = dot(camera(uv + px * vec2<f32>(1.0, 0.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l02 = dot(camera(uv + px * vec2<f32>(-1.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l12 = dot(camera(uv + px * vec2<f32>(0.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l22 = dot(camera(uv + px * vec2<f32>(1.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let gx = -l00 - 2.0 * l01 - l02 + l20 + 2.0 * l21 + l22;
let gy = -l00 - 2.0 * l10 - l20 + l02 + 2.0 * l12 + l22;
let edge = smoothstep(0.06, 0.32, length(vec2<f32>(gx, gy)));
let paper = vec3<f32>(0.93, 0.91, 0.86);
let ink = vec3<f32>(0.06, 0.08, 0.09);
return vec4<f32>(mix(paper, ink, edge), 1.0);
`.trim();

export const neonEdgesFragment = `
let px = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0));
let l00 = dot(camera(uv + px * vec2<f32>(-1.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l10 = dot(camera(uv + px * vec2<f32>(0.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l20 = dot(camera(uv + px * vec2<f32>(1.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l01 = dot(camera(uv + px * vec2<f32>(-1.0, 0.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l21 = dot(camera(uv + px * vec2<f32>(1.0, 0.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l02 = dot(camera(uv + px * vec2<f32>(-1.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l12 = dot(camera(uv + px * vec2<f32>(0.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let l22 = dot(camera(uv + px * vec2<f32>(1.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
let gx = -l00 - 2.0 * l01 - l02 + l20 + 2.0 * l21 + l22;
let gy = -l00 - 2.0 * l10 - l20 + l02 + 2.0 * l12 + l22;
let edge = clamp(length(vec2<f32>(gx, gy)) * (2.8 + params.level * 2.0), 0.0, 1.0);
let hue = vec3<f32>(0.08 + params.bass * 0.24, 0.72 + params.mid * 0.2, 1.0 + params.treble * 0.3);
let base = camera(uv).rgb * 0.12;
return vec4<f32>(clamp(base + hue * pow(edge, 0.72), vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const softBlurFragment = `
let radius = 1.6 + params.level * 5.0;
let px = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0)) * radius;
let center = camera(uv).rgb * 4.0;
let cross =
  camera(uv + vec2<f32>(px.x, 0.0)).rgb +
  camera(uv - vec2<f32>(px.x, 0.0)).rgb +
  camera(uv + vec2<f32>(0.0, px.y)).rgb +
  camera(uv - vec2<f32>(0.0, px.y)).rgb;
let diagonal =
  camera(uv + px).rgb +
  camera(uv - px).rgb +
  camera(uv + vec2<f32>(px.x, -px.y)).rgb +
  camera(uv + vec2<f32>(-px.x, px.y)).rgb;
let blurred = (center + cross * 2.0 + diagonal) / 16.0;
return vec4<f32>(blurred, 1.0);
`.trim();

export const radialBlurFragment = `
let center = vec2<f32>(0.5, 0.5);
let drive = 0.025 + params.bass * 0.055 + params.handCloseness * 0.035;
let dir = (uv - center) * drive;
let color =
  camera(uv).rgb * 0.24 +
  camera(uv - dir).rgb * 0.22 +
  camera(uv - dir * 2.0).rgb * 0.19 +
  camera(uv - dir * 3.0).rgb * 0.15 +
  camera(uv - dir * 4.0).rgb * 0.11 +
  camera(uv - dir * 5.0).rgb * 0.09;
let vignette = 1.0 - smoothstep(0.3, 0.98, distance(uv, center));
return vec4<f32>(clamp(color * (0.86 + vignette * 0.22), vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const mosaicBlurFragment = `
let aspect = max(params.width, 1.0) / max(params.height, 1.0);
let cells = 28.0 + (1.0 - clamp(params.level, 0.0, 1.0)) * 56.0;
let grid = vec2<f32>(cells, cells / aspect);
let blockUv = (floor(uv * grid) + vec2<f32>(0.5, 0.5)) / grid;
let px = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0)) * 4.0;
let color =
  camera(blockUv).rgb * 0.5 +
  camera(blockUv + px).rgb * 0.125 +
  camera(blockUv - px).rgb * 0.125 +
  camera(blockUv + vec2<f32>(px.x, -px.y)).rgb * 0.125 +
  camera(blockUv + vec2<f32>(-px.x, px.y)).rgb * 0.125;
return vec4<f32>(color, 1.0);
`.trim();

export const feedbackTrailFragment = `
let center = vec2<f32>(0.5, 0.5);
let live = camera(uv).rgb;
let drift = (uv - center) * (0.006 + params.level * 0.015);
let wobble = vec2<f32>(sin(params.time * 1.7), cos(params.time * 1.13)) * 0.003;
let trailA = previous(uv + drift + wobble).rgb;
let trailB = previous(uv + drift * 2.1 - wobble).rgb;
let tintedTrail = max(trailA * vec3<f32>(0.96, 0.84, 1.08), trailB * vec3<f32>(0.66, 0.92, 1.16));
let color = live * 0.78 + tintedTrail * 0.7;
return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();

export const handWarpStretchFragment = `
let handUv = vec2<f32>(params.handMidX, params.handMidY);
let active = step(1.5, params.handCount);
let closeness = clamp(params.handCloseness, 0.0, 1.0);
let pinch = clamp(params.handPinch, 0.0, 1.0);
let span = clamp(params.handSpan, 0.05, 1.0);
let offset = uv - handUv;
let dist = length(offset);
let radius = mix(0.18, 0.42, span);
let influence = exp((-dist * dist) / max(radius * radius, 0.001)) * active;
let axis = vec2<f32>(cos(params.handAngle), sin(params.handAngle));
let ortho = vec2<f32>(-axis.y, axis.x);
let along = dot(offset, axis);
let across = dot(offset, ortho);
let stretch = 1.0 + influence * (0.4 + closeness * 1.0 + pinch * 0.45);
let squeeze = max(0.35, 1.0 - influence * (0.2 + closeness * 0.28));
let warpedOffset = axis * (along / stretch) + ortho * (across / squeeze);
let radial = offset / max(dist, 0.001);
let ripple = sin((dist - params.time * 0.5) * 48.0) * 0.007 * influence * (0.25 + params.level + closeness);
let sampleUv = handUv + warpedOffset + radial * ripple;
let cameraColor = camera(sampleUv);
let mask = (1.0 - smoothstep(radius * 0.38, radius, dist)) * influence;
let tint = vec3<f32>(0.08 + params.bass * 0.16, 0.34 + params.mid * 0.25, 0.52 + params.treble * 0.28);
return vec4<f32>(cameraColor.rgb + tint * mask * (0.12 + closeness * 0.18 + pinch * 0.22), 1.0);
`.trim();

export const pulseGlitchFragment = `
let closeness = clamp(params.handCloseness, 0.0, 1.0);
let pinch = clamp(params.handPinch, 0.0, 1.0);
let handDrive = step(0.5, params.handCount) * (0.25 + closeness * 0.65 + pinch * 0.35);
let audioDrive = clamp(params.level * 1.35 + params.bass * 0.65 + params.treble * 0.25, 0.0, 1.6);
let band = floor(uv.y * 88.0);
let hash = fract(sin(band * 12.9898 + params.frame * 0.071) * 43758.5453);
let glitchGate = step(0.982 - handDrive * 0.06, hash);
let scan = sin((uv.y + params.time * 0.65) * 96.0) * 0.5 + 0.5;
let shift = (scan * 0.006 * audioDrive + glitchGate * 0.034 * (0.2 + handDrive)) * sign(sin(band));
let split = 0.002 + 0.008 * clamp(audioDrive + handDrive, 0.0, 1.0);
let red = camera(uv + vec2<f32>(shift + split, 0.0)).r;
let green = camera(uv + vec2<f32>(shift * 0.35, 0.0)).g;
let blue = camera(uv + vec2<f32>(shift - split, 0.0)).b;
let vignette = 1.0 - smoothstep(0.22, 0.96, distance(uv, vec2<f32>(0.5, 0.5)));
let pulse = 0.05 * sin(params.time * 7.0 + closeness * 6.28318) * (audioDrive + handDrive);
return vec4<f32>((vec3<f32>(red, green, blue) + pulse) * (0.82 + vignette * 0.24), 1.0);
`.trim();

export const globalVisualEffectPresets: GlobalVisualEffectPreset[] = [
  {
    id: "monochrome",
    label: "Monochrome",
    description: "Luminance-based black and white camera tone.",
  },
  {
    id: "high-contrast-mono",
    label: "High Contrast",
    description: "Hard black and white contrast with audio lift.",
  },
  {
    id: "sepia-tone",
    label: "Sepia",
    description: "Warm photographic brown and amber tone.",
  },
  {
    id: "cool-tone",
    label: "Cool Tone",
    description: "Blue-green shifted color grade with vignette.",
  },
  {
    id: "duotone",
    label: "Duotone",
    description: "Maps shadows and highlights to two bold colors.",
  },
  {
    id: "color-pop",
    label: "Color Pop",
    description: "Boosted saturation with treble-reactive lift.",
  },
  {
    id: "soft-blur",
    label: "Soft Blur",
    description: "Nine-sample blur that expands with audio level.",
  },
  {
    id: "radial-blur",
    label: "Radial Blur",
    description: "Zoom-like blur driven by bass and hand closeness.",
  },
  {
    id: "mosaic-blur",
    label: "Mosaic Blur",
    description: "Pixel-block sampling with a softened block center.",
  },
  {
    id: "edge-sketch",
    label: "Edge Sketch",
    description: "Sobel-style edge detector rendered as paper and ink.",
  },
  {
    id: "neon-edges",
    label: "Neon Edges",
    description: "Audio-reactive edge detector with neon color.",
  },
  {
    id: "feedback-trail",
    label: "Feedback Trail",
    description: "Temporal feedback texture for soft afterimage trails.",
  },
];

export const patchVisualEffectPresets: VisualEffectPreset[] = [
  {
    id: "camera-passthrough",
    label: "Camera Passthrough",
    description: "Unmodified mirrored camera feed.",
    fragmentBody: cameraPassthroughFragment,
  },
  {
    id: "hand-warp-stretch",
    label: "Hand Warp Stretch",
    description:
      "Warps and stretches the camera image around the midpoint between tracked hands.",
    fragmentBody: handWarpStretchFragment,
  },
  {
    id: "pulse-glitch",
    label: "Pulse Glitch",
    description:
      "Adds audio-reactive color separation and scanline jitter, intensified by hand closeness.",
    fragmentBody: pulseGlitchFragment,
  },
];

export const visualEffectPresets: VisualEffectPreset[] = [
  ...patchVisualEffectPresets,
  { ...globalVisualEffectPresets[0], fragmentBody: monochromeFragment },
  { ...globalVisualEffectPresets[1], fragmentBody: highContrastMonoFragment },
  { ...globalVisualEffectPresets[2], fragmentBody: sepiaToneFragment },
  { ...globalVisualEffectPresets[3], fragmentBody: coolToneFragment },
  { ...globalVisualEffectPresets[4], fragmentBody: duotoneFragment },
  { ...globalVisualEffectPresets[5], fragmentBody: colorPopFragment },
  { ...globalVisualEffectPresets[6], fragmentBody: softBlurFragment },
  { ...globalVisualEffectPresets[7], fragmentBody: radialBlurFragment },
  { ...globalVisualEffectPresets[8], fragmentBody: mosaicBlurFragment },
  { ...globalVisualEffectPresets[9], fragmentBody: edgeSketchFragment },
  { ...globalVisualEffectPresets[10], fragmentBody: neonEdgesFragment },
  { ...globalVisualEffectPresets[11], fragmentBody: feedbackTrailFragment },
];

export function resolveVisualEffectFragment(source: string): string | null {
  const requestedId = readEffectReference(source);
  if (!requestedId) {
    return null;
  }
  return (
    visualEffectPresets.find((preset) => preset.id === requestedId)?.fragmentBody ??
    null
  );
}

export function createGlobalVisualEffectFragment(effectIds: readonly string[]): string {
  const normalizedIds = normalizeGlobalVisualEffectIds(effectIds);
  if (normalizedIds.length === 0) {
    return cameraPassthroughFragment;
  }

  return `
var color = camera(uv).rgb;
let originalColor = color;
${normalizedIds.map((effectId, index) => globalEffectStep(effectId, index)).join("\n")}
return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
`.trim();
}

export function normalizeGlobalVisualEffectIds(
  effectIds: readonly string[] | undefined,
): string[] {
  const allowedIds = new Set(globalVisualEffectPresets.map((preset) => preset.id));
  const normalizedIds: string[] = [];

  for (const effectId of effectIds ?? []) {
    if (!allowedIds.has(effectId) || normalizedIds.includes(effectId)) {
      continue;
    }
    normalizedIds.push(effectId);
  }

  return normalizedIds;
}

function readEffectReference(source: string): string | null {
  const firstLine = source.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  const match = firstLine.match(/^\/\/\s*hello-cam:effect\s+([a-z0-9-]+)\s*$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function globalEffectStep(effectId: string, index: number): string {
  switch (effectId) {
    case "monochrome":
      return `
{
  let luma${index} = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  color = vec3<f32>(luma${index});
}`;
    case "high-contrast-mono":
      return `
{
  let luma${index} = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let contrast${index} = smoothstep(0.32, 0.78, luma${index} + params.level * 0.12);
  color = vec3<f32>(contrast${index});
}`;
    case "sepia-tone":
      return `
{
  let source${index} = color;
  let sepia${index} = vec3<f32>(
    dot(source${index}, vec3<f32>(0.393, 0.769, 0.189)),
    dot(source${index}, vec3<f32>(0.349, 0.686, 0.168)),
    dot(source${index}, vec3<f32>(0.272, 0.534, 0.131))
  );
  color = mix(source${index}, sepia${index}, 0.74) * vec3<f32>(1.04, 0.98, 0.88);
}`;
    case "cool-tone":
      return `
{
  let source${index} = color;
  let cool${index} = vec3<f32>(
    source${index}.r * 0.72 + source${index}.g * 0.08,
    source${index}.g * 1.02 + source${index}.b * 0.04,
    source${index}.b * 1.18 + source${index}.r * 0.08
  );
  let vignette${index} = 1.0 - smoothstep(0.42, 0.92, distance(uv, vec2<f32>(0.5, 0.5)));
  color = cool${index} * (0.78 + vignette${index} * 0.28);
}`;
    case "duotone":
      return `
{
  let luma${index} = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let shadow${index} = vec3<f32>(0.015, 0.07, 0.13);
  let highlight${index} = vec3<f32>(1.0, 0.56, 0.22);
  color = mix(shadow${index}, highlight${index}, smoothstep(0.04, 0.96, luma${index})) + color * 0.12;
}`;
    case "color-pop":
      return `
{
  let source${index} = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  let luma${index} = dot(source${index}, vec3<f32>(0.2126, 0.7152, 0.0722));
  let saturated${index} = pow(source${index}, vec3<f32>(0.82)) * vec3<f32>(1.08, 1.04, 1.16);
  color = mix(vec3<f32>(luma${index}), saturated${index}, 0.86 + params.treble * 0.18);
}`;
    case "soft-blur":
      return `
{
  let radius${index} = 1.6 + params.level * 5.0;
  let px${index} = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0)) * radius${index};
  let center${index} = camera(uv).rgb * 4.0;
  let cross${index} =
    camera(uv + vec2<f32>(px${index}.x, 0.0)).rgb +
    camera(uv - vec2<f32>(px${index}.x, 0.0)).rgb +
    camera(uv + vec2<f32>(0.0, px${index}.y)).rgb +
    camera(uv - vec2<f32>(0.0, px${index}.y)).rgb;
  let diagonal${index} =
    camera(uv + px${index}).rgb +
    camera(uv - px${index}).rgb +
    camera(uv + vec2<f32>(px${index}.x, -px${index}.y)).rgb +
    camera(uv + vec2<f32>(-px${index}.x, px${index}.y)).rgb;
  color = (center${index} + cross${index} * 2.0 + diagonal${index}) / 16.0;
}`;
    case "radial-blur":
      return `
{
  let center${index} = vec2<f32>(0.5, 0.5);
  let drive${index} = 0.025 + params.bass * 0.055 + params.handCloseness * 0.035;
  let dir${index} = (uv - center${index}) * drive${index};
  color =
    camera(uv).rgb * 0.24 +
    camera(uv - dir${index}).rgb * 0.22 +
    camera(uv - dir${index} * 2.0).rgb * 0.19 +
    camera(uv - dir${index} * 3.0).rgb * 0.15 +
    camera(uv - dir${index} * 4.0).rgb * 0.11 +
    camera(uv - dir${index} * 5.0).rgb * 0.09;
}`;
    case "mosaic-blur":
      return `
{
  let aspect${index} = max(params.width, 1.0) / max(params.height, 1.0);
  let cells${index} = 28.0 + (1.0 - clamp(params.level, 0.0, 1.0)) * 56.0;
  let grid${index} = vec2<f32>(cells${index}, cells${index} / aspect${index});
  let blockUv${index} = (floor(uv * grid${index}) + vec2<f32>(0.5, 0.5)) / grid${index};
  let px${index} = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0)) * 4.0;
  color =
    camera(blockUv${index}).rgb * 0.5 +
    camera(blockUv${index} + px${index}).rgb * 0.125 +
    camera(blockUv${index} - px${index}).rgb * 0.125 +
    camera(blockUv${index} + vec2<f32>(px${index}.x, -px${index}.y)).rgb * 0.125 +
    camera(blockUv${index} + vec2<f32>(-px${index}.x, px${index}.y)).rgb * 0.125;
}`;
    case "edge-sketch":
      return sobelStep(index, false);
    case "neon-edges":
      return sobelStep(index, true);
    case "feedback-trail":
      return `
{
  let center${index} = vec2<f32>(0.5, 0.5);
  let drift${index} = (uv - center${index}) * (0.006 + params.level * 0.015);
  let wobble${index} = vec2<f32>(sin(params.time * 1.7), cos(params.time * 1.13)) * 0.003;
  let trailA${index} = previous(uv + drift${index} + wobble${index}).rgb;
  let trailB${index} = previous(uv + drift${index} * 2.1 - wobble${index}).rgb;
  let tintedTrail${index} = max(trailA${index} * vec3<f32>(0.96, 0.84, 1.08), trailB${index} * vec3<f32>(0.66, 0.92, 1.16));
  color = color * 0.78 + tintedTrail${index} * 0.7;
}`;
    default:
      return "";
  }
}

function sobelStep(index: number, neon: boolean): string {
  const edgeColor = neon
    ? `
  let edge${index} = clamp(length(vec2<f32>(gx${index}, gy${index})) * (2.8 + params.level * 2.0), 0.0, 1.0);
  let hue${index} = vec3<f32>(0.08 + params.bass * 0.24, 0.72 + params.mid * 0.2, 1.0 + params.treble * 0.3);
  color = originalColor * 0.12 + hue${index} * pow(edge${index}, 0.72);`
    : `
  let edge${index} = smoothstep(0.06, 0.32, length(vec2<f32>(gx${index}, gy${index})));
  let paper${index} = vec3<f32>(0.93, 0.91, 0.86);
  let ink${index} = vec3<f32>(0.06, 0.08, 0.09);
  color = mix(paper${index}, ink${index}, edge${index});`;

  return `
{
  let px${index} = vec2<f32>(1.0 / max(params.width, 1.0), 1.0 / max(params.height, 1.0));
  let l00${index} = dot(camera(uv + px${index} * vec2<f32>(-1.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l10${index} = dot(camera(uv + px${index} * vec2<f32>(0.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l20${index} = dot(camera(uv + px${index} * vec2<f32>(1.0, -1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l01${index} = dot(camera(uv + px${index} * vec2<f32>(-1.0, 0.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l21${index} = dot(camera(uv + px${index} * vec2<f32>(1.0, 0.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l02${index} = dot(camera(uv + px${index} * vec2<f32>(-1.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l12${index} = dot(camera(uv + px${index} * vec2<f32>(0.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let l22${index} = dot(camera(uv + px${index} * vec2<f32>(1.0, 1.0)).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let gx${index} = -l00${index} - 2.0 * l01${index} - l02${index} + l20${index} + 2.0 * l21${index} + l22${index};
  let gy${index} = -l00${index} - 2.0 * l10${index} - l20${index} + l02${index} + 2.0 * l12${index} + l22${index};
${edgeColor}
}`;
}
