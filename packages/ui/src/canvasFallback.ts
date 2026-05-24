import type { AudioSnapshot } from "@hello-cam/audio";
import { normalizeGlobalVisualEffectIds } from "./visualEffects";

export interface CanvasFallbackInput {
  audio: AudioSnapshot;
  mirror: boolean;
  time: number;
  video: HTMLVideoElement | null;
  visualEffectIds?: readonly string[];
}

const feedbackCanvases = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const edgeCanvases = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const sketchPaperColor = [238, 232, 218] as const;
const sketchInkColor = [15, 20, 24] as const;

export function drawCanvasFallback(
  canvas: HTMLCanvasElement,
  input: CanvasFallbackInput,
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const displayWidth = Math.max(1, canvas.clientWidth || 1280);
  const displayHeight = Math.max(1, canvas.clientHeight || 720);
  const targetWidth = Math.floor(displayWidth * pixelRatio);
  const targetHeight = Math.floor(displayHeight * pixelRatio);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, displayWidth, displayHeight);

  const hasVideo =
    input.video &&
    input.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    input.video.videoWidth > 0 &&
    input.video.videoHeight > 0;
  const normalizedEffectIds = normalizeGlobalVisualEffectIds(input.visualEffectIds);

  if (hasVideo && input.video) {
    context.filter = canvasFilterForEffects(normalizedEffectIds);
    drawCoverVideo(
      context,
      input.video,
      displayWidth,
      displayHeight,
      input.mirror,
    );
    context.filter = "none";
    applyCanvasPixelEffects(canvas, context, normalizedEffectIds);
  } else {
    feedbackCanvases.delete(canvas);
    context.fillStyle = "#11191b";
    context.fillRect(0, 0, displayWidth, displayHeight);
  }
}

function canvasFilterForEffects(effectIds: readonly string[] | undefined): string {
  const normalizedIds = normalizeGlobalVisualEffectIds(effectIds);
  const filters: string[] = [];

  if (normalizedIds.includes("monochrome")) {
    filters.push("grayscale(1)");
  }
  if (normalizedIds.includes("high-contrast-mono")) {
    filters.push("grayscale(1)", "contrast(1.65)");
  }
  if (normalizedIds.includes("sepia-tone")) {
    filters.push("sepia(0.78)", "saturate(1.08)");
  }
  if (normalizedIds.includes("cool-tone")) {
    filters.push("hue-rotate(176deg)", "saturate(1.18)", "brightness(0.94)");
  }
  if (normalizedIds.includes("duotone")) {
    filters.push("contrast(1.28)", "saturate(1.55)", "hue-rotate(318deg)");
  }
  if (normalizedIds.includes("color-pop")) {
    filters.push("saturate(1.85)", "contrast(1.08)");
  }
  if (
    normalizedIds.includes("soft-blur") ||
    normalizedIds.includes("radial-blur") ||
    normalizedIds.includes("mosaic-blur")
  ) {
    filters.push("blur(5px)");
  }

  return filters.length > 0 ? filters.join(" ") : "none";
}

function applyCanvasPixelEffects(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  effectIds: readonly string[],
): void {
  if (effectIds.length === 0) {
    feedbackCanvases.delete(canvas);
    return;
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);

  for (const effectId of effectIds) {
    if (effectId === "edge-sketch") {
      applyCanvasEdgeEffect(canvas, context, false);
      continue;
    }
    if (effectId === "neon-edges") {
      applyCanvasEdgeEffect(canvas, context, true);
      continue;
    }
    if (effectId === "feedback-trail") {
      applyCanvasFeedbackTrail(canvas, context);
    }
  }

  context.restore();

  if (!effectIds.includes("feedback-trail")) {
    feedbackCanvases.delete(canvas);
  }
}

function applyCanvasEdgeEffect(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  neon: boolean,
): void {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 2 || height <= 2) {
    return;
  }

  const edgeCanvas = getScratchCanvas(edgeCanvases, canvas);
  const scale = Math.min(1, 560 / width, 360 / height);
  const edgeWidth = Math.max(2, Math.floor(width * scale));
  const edgeHeight = Math.max(2, Math.floor(height * scale));
  if (edgeCanvas.width !== edgeWidth || edgeCanvas.height !== edgeHeight) {
    edgeCanvas.width = edgeWidth;
    edgeCanvas.height = edgeHeight;
  }

  const edgeContext = edgeCanvas.getContext("2d", { willReadFrequently: true });
  if (!edgeContext) {
    return;
  }

  edgeContext.setTransform(1, 0, 0, 1, 0, 0);
  edgeContext.clearRect(0, 0, edgeWidth, edgeHeight);
  edgeContext.drawImage(canvas, 0, 0, edgeWidth, edgeHeight);

  let source: ImageData;
  try {
    source = edgeContext.getImageData(0, 0, edgeWidth, edgeHeight);
  } catch {
    return;
  }

  const output = edgeContext.createImageData(edgeWidth, edgeHeight);
  const inputData = source.data;
  const outputData = output.data;

  for (let y = 0; y < edgeHeight; y += 1) {
    for (let x = 0; x < edgeWidth; x += 1) {
      const offset = (y * edgeWidth + x) * 4;

      if (x === 0 || y === 0 || x === edgeWidth - 1 || y === edgeHeight - 1) {
        writeEdgePixel(outputData, offset, inputData, offset, 0, neon);
        continue;
      }

      const l00 = readLuma(inputData, edgeWidth, x - 1, y - 1);
      const l10 = readLuma(inputData, edgeWidth, x, y - 1);
      const l20 = readLuma(inputData, edgeWidth, x + 1, y - 1);
      const l01 = readLuma(inputData, edgeWidth, x - 1, y);
      const l21 = readLuma(inputData, edgeWidth, x + 1, y);
      const l02 = readLuma(inputData, edgeWidth, x - 1, y + 1);
      const l12 = readLuma(inputData, edgeWidth, x, y + 1);
      const l22 = readLuma(inputData, edgeWidth, x + 1, y + 1);
      const gx = -l00 - 2 * l01 - l02 + l20 + 2 * l21 + l22;
      const gy = -l00 - 2 * l10 - l20 + l02 + 2 * l12 + l22;
      const edge = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 18) / 132));

      writeEdgePixel(outputData, offset, inputData, offset, edge, neon);
    }
  }

  edgeContext.putImageData(output, 0, 0);
  context.imageSmoothingEnabled = true;
  context.drawImage(edgeCanvas, 0, 0, width, height);
}

function applyCanvasFeedbackTrail(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) {
    return;
  }

  const feedbackCanvas = getScratchCanvas(feedbackCanvases, canvas);
  const feedbackContext = feedbackCanvas.getContext("2d");
  if (!feedbackContext) {
    return;
  }

  const initialized =
    feedbackCanvas.width === width && feedbackCanvas.height === height;
  if (!initialized) {
    feedbackCanvas.width = width;
    feedbackCanvas.height = height;
    feedbackContext.drawImage(canvas, 0, 0, width, height);
    return;
  }

  const drift = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 0.48;
  context.filter = "hue-rotate(24deg) saturate(1.45) blur(1.5px)";
  context.drawImage(
    feedbackCanvas,
    -drift,
    -drift,
    width + drift * 2,
    height + drift * 2,
  );
  context.restore();

  feedbackContext.setTransform(1, 0, 0, 1, 0, 0);
  feedbackContext.globalAlpha = 0.86;
  feedbackContext.drawImage(canvas, 0, 0, width, height);
  feedbackContext.globalAlpha = 1;
}

function getScratchCanvas(
  store: WeakMap<HTMLCanvasElement, HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement {
  let scratchCanvas = store.get(canvas);
  if (!scratchCanvas) {
    scratchCanvas = document.createElement("canvas");
    store.set(canvas, scratchCanvas);
  }
  return scratchCanvas;
}

function readLuma(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): number {
  const offset = (y * width + x) * 4;
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function writeEdgePixel(
  outputData: Uint8ClampedArray,
  outputOffset: number,
  inputData: Uint8ClampedArray,
  inputOffset: number,
  edge: number,
  neon: boolean,
): void {
  const shapedEdge = neon ? Math.pow(edge, 0.58) : Math.pow(edge, 0.72);

  if (neon) {
    outputData[outputOffset] = Math.min(
      255,
      inputData[inputOffset] * 0.12 + 34 * shapedEdge,
    );
    outputData[outputOffset + 1] = Math.min(
      255,
      inputData[inputOffset + 1] * 0.18 + 218 * shapedEdge,
    );
    outputData[outputOffset + 2] = Math.min(
      255,
      inputData[inputOffset + 2] * 0.22 + 255 * shapedEdge,
    );
  } else {
    outputData[outputOffset] =
      sketchPaperColor[0] +
      (sketchInkColor[0] - sketchPaperColor[0]) * shapedEdge;
    outputData[outputOffset + 1] =
      sketchPaperColor[1] +
      (sketchInkColor[1] - sketchPaperColor[1]) * shapedEdge;
    outputData[outputOffset + 2] =
      sketchPaperColor[2] +
      (sketchInkColor[2] - sketchPaperColor[2]) * shapedEdge;
  }

  outputData[outputOffset + 3] = 255;
}

function drawCoverVideo(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirror: boolean,
): void {
  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (videoRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = height * videoRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / videoRatio;
    offsetY = (height - drawHeight) / 2;
  }

  if (mirror) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(
      video,
      width - offsetX - drawWidth,
      offsetY,
      drawWidth,
      drawHeight,
    );
    context.restore();
    return;
  }

  context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
}
