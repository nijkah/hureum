import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  defaultProjectCalibration,
  type ProjectTrackingCalibration,
} from "@hello-cam/core";
import { useEffect, useMemo, useState } from "react";

const mediapipeVersion = "0.10.35";
const wasmPath = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${mediapipeVersion}/wasm`;
const handModelPath =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface HandTrackingState {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  hands: NormalizedLandmark[][];
  handCount: number;
  distance: number | null;
  distance3d: number | null;
  closeness: number;
  closeness3d: number;
  pitchHz: number | null;
}

export const emptyHandTrackingState: HandTrackingState = {
  enabled: false,
  loading: false,
  error: null,
  hands: [],
  handCount: 0,
  distance: null,
  distance3d: null,
  closeness: 0,
  closeness3d: 0,
  pitchHz: null,
};

export function useHandTracking(
  enabled: boolean,
  video: HTMLVideoElement | null,
  calibration: ProjectTrackingCalibration = defaultProjectCalibration.tracking,
): HandTrackingState {
  const [state, setState] = useState<HandTrackingState>(emptyHandTrackingState);

  useEffect(() => {
    if (!enabled) {
      setState(emptyHandTrackingState);
      return;
    }

    if (!video) {
      setState({
        ...emptyHandTrackingState,
        enabled: true,
        loading: false,
        error: "Start camera to track hands.",
      });
      return;
    }

    let cancelled = false;
    let frame = 0;
    let landmarker: HandLandmarker | null = null;
    const sourceVideo = video;

    async function start(): Promise<void> {
      try {
        setState((current) => ({
          ...current,
          enabled: true,
          loading: true,
          error: null,
        }));
        landmarker = await createHandLandmarker();
        if (cancelled || !landmarker) {
          landmarker?.close();
          return;
        }

        const loop = (timestamp: number): void => {
          if (cancelled || !landmarker) {
            return;
          }
          if (
            sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            sourceVideo.videoWidth > 0 &&
            sourceVideo.videoHeight > 0
          ) {
            const result = landmarker.detectForVideo(sourceVideo, timestamp);
            setState(createTrackingState(result, calibration));
          }
          frame = window.requestAnimationFrame(loop);
        };
        frame = window.requestAnimationFrame(loop);
      } catch (caught) {
        setState({
          ...emptyHandTrackingState,
          enabled: true,
          loading: false,
          error:
            caught instanceof Error ? caught.message : "Could not start hand tracking.",
        });
      }
    }

    void start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      landmarker?.close();
    };
  }, [calibration.handFar, calibration.handFar3d, calibration.handNear, enabled, video]);

  return useMemo(() => state, [state]);
}

async function createHandLandmarker(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: handModelPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });
  } catch {
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: handModelPath,
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
    });
  }
}

function createTrackingState(
  result: HandLandmarkerResult,
  calibration: ProjectTrackingCalibration,
): HandTrackingState {
  const hands = result.landmarks ?? [];
  const distance = hands.length >= 2 ? distanceBetweenHands(hands[0], hands[1]) : null;
  const distance3d =
    hands.length >= 2 ? distanceBetweenHands3d(hands[0], hands[1]) : null;
  const closeness =
    distance === null
      ? 0
      : 1 - normalize(distance, calibration.handNear, calibration.handFar);
  const closeness3d =
    distance3d === null
      ? 0
      : 1 - normalize(distance3d, calibration.handNear, calibration.handFar3d);
  return {
    enabled: true,
    loading: false,
    error: null,
    hands,
    handCount: hands.length,
    distance,
    distance3d,
    closeness,
    closeness3d,
    pitchHz: distance === null ? null : pitchFromCloseness(closeness),
  };
}

function distanceBetweenHands(
  first: NormalizedLandmark[],
  second: NormalizedLandmark[],
): number {
  const a = palmCenter(first);
  const b = palmCenter(second);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceBetweenHands3d(
  first: NormalizedLandmark[],
  second: NormalizedLandmark[],
): number {
  const a = palmCenter(first);
  const b = palmCenter(second);
  const planarDistance = Math.hypot(a.x - b.x, a.y - b.y);
  const depthDelta = inferredDepthDelta(first, second);
  return Math.hypot(planarDistance, depthDelta);
}

function inferredDepthDelta(
  first: NormalizedLandmark[],
  second: NormalizedLandmark[],
): number {
  const firstScale = handScale(first);
  const secondScale = handScale(second);
  if (firstScale <= 0 || secondScale <= 0) {
    return 0;
  }
  return Math.abs(Math.log(firstScale / secondScale)) * 0.34;
}

function handScale(hand: NormalizedLandmark[]): number {
  const points = hand.filter(Boolean);
  if (points.length === 0) {
    return 0;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return Math.hypot(width, height);
}

function palmCenter(hand: NormalizedLandmark[]): { x: number; y: number } {
  const indices = [0, 5, 9, 13, 17];
  const points = indices
    .map((index) => hand[index])
    .filter((point): point is NormalizedLandmark => Boolean(point));
  if (points.length === 0) {
    return { x: 0.5, y: 0.5 };
  }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function pitchFromCloseness(closeness: number): number {
  const minHz = 110;
  const octaves = 3;
  return minHz * 2 ** (Math.min(1, Math.max(0, closeness)) * octaves);
}
