import {
  FaceLandmarker,
  FilesetResolver,
  type Classifications,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { useEffect, useMemo, useState } from "react";

const mediapipeVersion = "0.10.35";
const wasmPath = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${mediapipeVersion}/wasm`;
const faceModelPath =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export interface FacePoint {
  x: number;
  y: number;
  z: number;
}

export interface FaceTrackingState {
  enabled: boolean;
  loading: boolean;
  active: boolean;
  error: string | null;
  faces: NormalizedLandmark[][];
  landmarks: NormalizedLandmark[][];
  faceCount: number;
  blendshapes: Classifications[];
  mouthOpen: number;
  blinkLeft: number;
  blinkRight: number;
  headCenter: FacePoint | null;
}

export const emptyFaceTrackingState: FaceTrackingState = {
  enabled: false,
  loading: false,
  active: false,
  error: null,
  faces: [],
  landmarks: [],
  faceCount: 0,
  blendshapes: [],
  mouthOpen: 0,
  blinkLeft: 0,
  blinkRight: 0,
  headCenter: null,
};

export function useFaceTracking(
  enabled: boolean,
  video: HTMLVideoElement | null,
): FaceTrackingState {
  const [state, setState] = useState<FaceTrackingState>(emptyFaceTrackingState);

  useEffect(() => {
    if (!enabled) {
      setState(emptyFaceTrackingState);
      return;
    }

    if (typeof window === "undefined") {
      setState({
        ...emptyFaceTrackingState,
        enabled: true,
        error: "Face tracking requires a browser window.",
      });
      return;
    }

    if (!video) {
      setState({
        ...emptyFaceTrackingState,
        enabled: true,
        error: "Start camera to track faces.",
      });
      return;
    }

    let cancelled = false;
    let frame = 0;
    let landmarker: FaceLandmarker | null = null;
    const sourceVideo = video;

    async function start(): Promise<void> {
      try {
        setState((current) => ({
          ...current,
          enabled: true,
          loading: true,
          active: false,
          error: null,
        }));
        landmarker = await createFaceLandmarker();
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
            setState(createTrackingState(result));
          }
          frame = window.requestAnimationFrame(loop);
        };
        frame = window.requestAnimationFrame(loop);
      } catch (caught) {
        if (cancelled) {
          return;
        }
        setState({
          ...emptyFaceTrackingState,
          enabled: true,
          error:
            caught instanceof Error ? caught.message : "Could not start face tracking.",
        });
      }
    }

    void start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      landmarker?.close();
    };
  }, [enabled, video]);

  return useMemo(() => state, [state]);
}

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: faceModelPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
    });
  } catch {
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: faceModelPath,
      },
      runningMode: "VIDEO",
      numFaces: 2,
      minFaceDetectionConfidence: 0.55,
      minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
    });
  }
}

function createTrackingState(result: FaceLandmarkerResult): FaceTrackingState {
  const faces = result.faceLandmarks ?? [];
  const blendshapes = result.faceBlendshapes ?? [];
  const primaryFace = faces[0] ?? null;
  const primaryBlendshapes = blendshapes[0] ?? null;
  const mouthOpen =
    scoreFromBlendshape(primaryBlendshapes, "jawOpen") ?? mouthOpenFromLandmarks(primaryFace);
  const blinkLeft =
    scoreFromBlendshape(primaryBlendshapes, "eyeBlinkLeft") ??
    blinkFromLandmarks(primaryFace, "left");
  const blinkRight =
    scoreFromBlendshape(primaryBlendshapes, "eyeBlinkRight") ??
    blinkFromLandmarks(primaryFace, "right");

  return {
    enabled: true,
    loading: false,
    active: faces.length > 0,
    error: null,
    faces,
    landmarks: faces,
    faceCount: faces.length,
    blendshapes,
    mouthOpen,
    blinkLeft,
    blinkRight,
    headCenter: primaryFace ? centerOfLandmarks(primaryFace) : null,
  };
}

function scoreFromBlendshape(
  blendshapes: Classifications | null,
  categoryName: string,
): number | null {
  const category = blendshapes?.categories.find(
    (candidate) => candidate.categoryName === categoryName,
  );
  return typeof category?.score === "number" ? clamp01(category.score) : null;
}

function mouthOpenFromLandmarks(face: NormalizedLandmark[] | null): number {
  if (!face) {
    return 0;
  }
  const upperLip = face[13];
  const lowerLip = face[14];
  const leftMouth = face[61];
  const rightMouth = face[291];
  if (!upperLip || !lowerLip || !leftMouth || !rightMouth) {
    return 0;
  }
  const mouthWidth = distance2d(leftMouth, rightMouth);
  if (mouthWidth <= 0) {
    return 0;
  }
  const opening = Math.abs(lowerLip.y - upperLip.y) / mouthWidth;
  return normalize(opening, 0.03, 0.42);
}

function blinkFromLandmarks(
  face: NormalizedLandmark[] | null,
  side: "left" | "right",
): number {
  if (!face) {
    return 0;
  }
  const indices =
    side === "left"
      ? { upper: 386, lower: 374, inner: 362, outer: 263 }
      : { upper: 159, lower: 145, inner: 33, outer: 133 };
  const upper = face[indices.upper];
  const lower = face[indices.lower];
  const inner = face[indices.inner];
  const outer = face[indices.outer];
  if (!upper || !lower || !inner || !outer) {
    return 0;
  }
  const eyeWidth = distance2d(inner, outer);
  if (eyeWidth <= 0) {
    return 0;
  }
  const openness = Math.abs(lower.y - upper.y) / eyeWidth;
  return 1 - normalize(openness, 0.06, 0.24);
}

function centerOfLandmarks(face: NormalizedLandmark[]): FacePoint {
  const points = face.filter(Boolean);
  if (points.length === 0) {
    return { x: 0.5, y: 0.5, z: 0 };
  }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function distance2d(first: NormalizedLandmark, second: NormalizedLandmark): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) {
    return 0;
  }
  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
