import type { AudioSnapshot } from "@hello-cam/audio";
import { normalizeGlobalVisualEffectIds } from "./visualEffects";

export interface CanvasFallbackInput {
  audio: AudioSnapshot;
  mirror: boolean;
  time: number;
  video: HTMLVideoElement | null;
  visualEffectIds?: readonly string[];
}

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

  if (hasVideo && input.video) {
    context.filter = canvasFilterForEffects(input.visualEffectIds);
    drawCoverVideo(
      context,
      input.video,
      displayWidth,
      displayHeight,
      input.mirror,
    );
    context.filter = "none";
  } else {
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
