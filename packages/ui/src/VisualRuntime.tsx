import {
  evaluateProject,
  projectCalibration,
  type Project,
} from "@hello-cam/core";
import {
  createWebGpuRenderer,
  isWebGpuAvailable,
  type ShaderUniforms,
  type WebGpuRenderer,
} from "@hello-cam/render-webgpu";
import {
  Circle,
  Download,
  Maximize2,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBridge } from "./bridge";
import { drawCanvasFallback } from "./canvasFallback";
import type { HandTrackingState } from "./handTracking";
import { TrackingOverlay } from "./HandOverlay";
import { nodeRegistry } from "./nodeCatalog";
import type { InteractiveRuntime } from "./runtimeState";
import {
  cameraPassthroughFragment,
  createGlobalVisualEffectFragment,
  normalizeGlobalVisualEffectIds,
  resolveVisualEffectFragment,
} from "./visualEffects";

interface VisualRuntimeProps {
  project: Project;
  runtime: InteractiveRuntime;
  renderPipeline?: "camera" | "graph";
  outputOnly?: boolean;
}

export function VisualRuntime({
  project,
  runtime,
  renderPipeline = "camera",
  outputOnly = false,
}: VisualRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGpuRenderer | null>(null);
  const media = runtime.media;
  const mediaRef = useRef(media);
  const frameRef = useRef(0);
  const previousTimeRef = useRef(performance.now());
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [rendererMode, setRendererMode] = useState<"canvas" | "webgpu">(
    renderPipeline === "graph" && isWebGpuAvailable() ? "webgpu" : "canvas",
  );
  const [recording, setRecording] = useState<{
    blob: Blob;
    url: string;
    createdAt: Date;
    mimeType: string;
  } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef<typeof recording>(null);
  const handTrackingRef = useRef(runtime.handTracking);
  const faceTrackingRef = useRef(runtime.faceTracking);
  const poseTrackingRef = useRef(runtime.poseTracking);
  const globalVisualEffectIds = useMemo(
    () => normalizeGlobalVisualEffectIds(project.visualEffects),
    [project.visualEffects],
  );
  const shouldRenderGraph =
    renderPipeline === "graph" || globalVisualEffectIds.length > 0;

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => {
    handTrackingRef.current = runtime.handTracking;
  }, [runtime.handTracking]);

  useEffect(() => {
    faceTrackingRef.current = runtime.faceTracking;
  }, [runtime.faceTracking]);

  useEffect(() => {
    poseTrackingRef.current = runtime.poseTracking;
  }, [runtime.poseTracking]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    rendererRef.current?.dispose();
    rendererRef.current = null;
  }, [rendererMode]);

  useEffect(() => {
    const nextRenderer =
      shouldRenderGraph && isWebGpuAvailable() ? "webgpu" : "canvas";
    setRendererMode(nextRenderer);
  }, [shouldRenderGraph]);

  const outputShaderNodeId = useMemo(() => findOutputShaderNodeId(project), [project]);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;

    async function drawFrame(): Promise<void> {
      const canvas = canvasRef.current;
      if (!canvas) {
        if (!cancelled) {
          animationFrame = requestAnimationFrame(() => void drawFrame());
        }
        return;
      }

      try {
        const now = performance.now();
        const time = now / 1000;
        const deltaTime = Math.max(0, (now - previousTimeRef.current) / 1000);
        previousTimeRef.current = now;
        const audio = mediaRef.current.readAudio();
        const calibration = projectCalibration(project);

        if (
          !shouldRenderGraph ||
          rendererMode === "canvas" ||
          !isWebGpuAvailable()
        ) {
          drawCanvasFallback(canvas, {
            audio,
            mirror: calibration.camera.mirror,
            time,
            visualEffectIds: globalVisualEffectIds,
            video: mediaRef.current.video,
          });
          frameRef.current += 1;
          setRenderError(null);
          if (!cancelled) {
            animationFrame = requestAnimationFrame(() => void drawFrame());
          }
          return;
        }

        if (!rendererRef.current) {
          rendererRef.current = createWebGpuRenderer(canvas, {
            width: 1280,
            height: 720,
          });
          await rendererRef.current.initialize();
        }

        const result = evaluateProject(project, nodeRegistry, {
          time,
          deltaTime,
          frame: frameRef.current,
          external: {
            audio,
            face: faceTrackingRef.current,
            hands: handTrackingRef.current,
            pose: poseTrackingRef.current,
          },
        });
        const shaderValues = outputShaderNodeId
          ? result.values[outputShaderNodeId]
          : undefined;
        const patchFragmentBody =
          typeof shaderValues?.fragmentBody === "string"
            ? normalizeFragmentBody(shaderValues.fragmentBody)
            : defaultFallbackFragment;
        const fragmentBody =
          globalVisualEffectIds.length > 0
            ? createGlobalVisualEffectFragment(globalVisualEffectIds)
            : patchFragmentBody;
        const handUniforms = createHandUniforms(
          handTrackingRef.current,
          calibration.camera.mirror,
        );

        await rendererRef.current.render({
          fragmentBody,
          cameraVideo: mediaRef.current.video,
          uniforms: {
            time: asNumber(shaderValues?.time, time),
            level: asNumber(shaderValues?.level, audio.level),
            bass: asNumber(shaderValues?.bass, audio.bass),
            mid: asNumber(shaderValues?.mid, audio.mid),
            treble: asNumber(shaderValues?.treble, audio.treble),
            frame: frameRef.current,
            cameraMirror: calibration.camera.mirror ? 1 : 0,
            ...handUniforms,
          },
        });
        frameRef.current += 1;
        setRenderError(null);
      } catch (caught) {
        setRendererMode("canvas");
        setRenderError(
          caught instanceof Error ? caught.message : "Render failed.",
        );
      }

      if (!cancelled) {
        animationFrame = requestAnimationFrame(() => void drawFrame());
      }
    }

    animationFrame = requestAnimationFrame(() => void drawFrame());
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [
    globalVisualEffectIds,
    outputShaderNodeId,
    project,
    rendererMode,
    shouldRenderGraph,
  ]);

  useEffect(() => {
    return () => {
      rendererRef.current?.dispose();
      recorderRef.current?.stop();
      if (recordingRef.current) {
        URL.revokeObjectURL(recordingRef.current.url);
      }
    };
  }, []);

  function startRecording(): void {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) {
      return;
    }
    clearRecording();
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, {
      mimeType: selectRecordingMimeType(),
    });
    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      setRecording({
        blob,
        url: URL.createObjectURL(blob),
        createdAt: new Date(),
        mimeType: recorder.mimeType || "video/webm",
      });
      setIsRecording(false);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }

  function stopRecording(): void {
    recorderRef.current?.stop();
  }

  function saveRecording(): void {
    if (!recording) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = recording.url;
    anchor.download = `hello-cam-${recording.createdAt.toISOString().replace(/[:.]/g, "-")}.webm`;
    anchor.click();
  }

  function clearRecording(): void {
    setRecording((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }

  async function openFullscreen(): Promise<void> {
    const bridge = getBridge();
    if (bridge) {
      await bridge.openFullscreenOutput({ data: project });
      return;
    }
    await canvasRef.current?.requestFullscreen();
  }

  return (
    <section className={outputOnly ? "runtime runtime-output" : "runtime"}>
      <div className="preview-shell">
        <canvas
          aria-label="Live preview"
          className="preview-canvas"
          key={`${renderPipeline}-${rendererMode}`}
          ref={canvasRef}
        />
        <TrackingOverlay
          faceTracking={runtime.faceTracking}
          handTracking={runtime.handTracking}
          mirror={projectCalibration(project).camera.mirror}
          poseTracking={runtime.poseTracking}
          video={runtime.media.video}
          visibility={{
            hands: runtime.handOverlayEnabled,
            face: runtime.faceOverlayEnabled,
            pose: runtime.poseOverlayEnabled,
          }}
        />
        {!outputOnly && (
          <div className="preview-actions" aria-label="Preview actions">
            <button
              className="icon-button"
              onClick={openFullscreen}
              title="Open fullscreen output"
              type="button"
            >
              <Maximize2 size={18} />
            </button>
            <button
              className="icon-button record-button"
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? "Stop recording" : "Record canvas video"}
              type="button"
            >
              {isRecording ? <Square size={18} /> : <Circle size={18} />}
            </button>
          </div>
        )}
        {outputOnly && runtime.errors && (
          <div className="preview-overlay">{runtime.errors}</div>
        )}
        {outputOnly && renderError && <div className="preview-overlay">{renderError}</div>}
        {recording && !outputOnly && (
          <div className="replay-panel">
            <div className="replay-header">
              <Play size={15} />
              <span>Replay ready</span>
              <small>{formatBytes(recording.blob.size)}</small>
            </div>
            <video
              className="replay-video"
              controls
              src={recording.url}
            />
            <div className="replay-actions">
              <button onClick={saveRecording} type="button">
                <Download size={15} />
                Save
              </button>
              <button onClick={clearRecording} type="button">
                <RotateCcw size={15} />
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function findOutputShaderNodeId(project: Project): string | null {
  const output = project.nodes.find((node) => node.type === "render.output");
  if (!output) {
    return project.nodes.find((node) => node.type === "render.shader")?.id ?? null;
  }
  const connection = project.connections.find(
    (edge) => edge.to.nodeId === output.id && edge.to.portId === "texture",
  );
  if (!connection) {
    return null;
  }
  const source = project.nodes.find((node) => node.id === connection.from.nodeId);
  return source?.type === "render.shader" ? source.id : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createHandUniforms(
  tracking: HandTrackingState,
  mirror: boolean,
): Pick<
  ShaderUniforms,
  | "handCount"
  | "handMidX"
  | "handMidY"
  | "handSpan"
  | "handCloseness"
  | "handAngle"
  | "handPinch"
  | "handGesture"
> {
  const first = tracking.hands[0] ?? null;
  const second = tracking.hands[1] ?? null;
  const firstCenter = first ? palmCenter(first) : null;
  const secondCenter = second ? palmCenter(second) : null;
  const midpoint =
    firstCenter && secondCenter
      ? {
          x: (firstCenter.x + secondCenter.x) / 2,
          y: (firstCenter.y + secondCenter.y) / 2,
        }
      : firstCenter ?? { x: 0.5, y: 0.5 };
  const displayFirst = firstCenter
    ? { x: mirror ? 1 - firstCenter.x : firstCenter.x, y: firstCenter.y }
    : null;
  const displaySecond = secondCenter
    ? { x: mirror ? 1 - secondCenter.x : secondCenter.x, y: secondCenter.y }
    : null;
  const fallbackSpan =
    displayFirst && displaySecond
      ? Math.hypot(displaySecond.x - displayFirst.x, displaySecond.y - displayFirst.y)
      : 0;
  const angle =
    displayFirst && displaySecond
      ? Math.atan2(
          displaySecond.y - displayFirst.y,
          displaySecond.x - displayFirst.x,
        )
      : 0;
  const pinch = Math.max(
    first ? pinchCloseness(first) : 0,
    second ? pinchCloseness(second) : 0,
  );

  return {
    handCount: clamp(Number.isFinite(tracking.handCount) ? tracking.handCount : 0, 0, 2),
    handMidX: clamp01(mirror ? 1 - midpoint.x : midpoint.x),
    handMidY: clamp01(midpoint.y),
    handSpan: clamp01(asNumber(tracking.distance, fallbackSpan)),
    handCloseness: clamp01(asNumber(tracking.closeness, 0)),
    handAngle: Number.isFinite(angle) ? angle : 0,
    handPinch: pinch,
    handGesture: pinch > 0.65 ? 1 : 0,
  };
}

function selectRecordingMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const defaultFallbackFragment = cameraPassthroughFragment;

function normalizeFragmentBody(fragmentBody: string): string {
  const presetFragment = resolveVisualEffectFragment(fragmentBody);
  if (presetFragment) {
    return presetFragment;
  }
  if (
    fragmentBody.includes("camMix + glow") &&
    fragmentBody.includes("params.bass") &&
    fragmentBody.includes("Aurora")
  ) {
    return defaultFallbackFragment;
  }
  if (
    fragmentBody.includes("camMix + glow") &&
    fragmentBody.includes("cameraBoost") &&
    fragmentBody.includes("params.treble")
  ) {
    return defaultFallbackFragment;
  }
  return fragmentBody;
}

type HandLandmark = HandTrackingState["hands"][number][number];

function palmCenter(hand: HandLandmark[]): { x: number; y: number } {
  const indices = [0, 5, 9, 13, 17];
  const points = indices
    .map((index) => hand[index])
    .filter((point): point is HandLandmark => Boolean(point));
  if (points.length === 0) {
    return { x: 0.5, y: 0.5 };
  }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function pinchCloseness(hand: HandLandmark[]): number {
  const thumbTip = hand[4];
  const indexTip = hand[8];
  if (!thumbTip || !indexTip) {
    return 0;
  }
  const scale = Math.max(handScale(hand), 0.001);
  const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  return 1 - normalize(distance / scale, 0.08, 0.32);
}

function handScale(hand: HandLandmark[]): number {
  const points = hand.filter(Boolean);
  if (points.length === 0) {
    return 0;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 0;
  }
  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
