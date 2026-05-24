import {
  FilesetResolver,
  type Landmark,
  type NormalizedLandmark,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { useEffect, useMemo, useState } from "react";

const mediapipeVersion = "0.10.35";
const wasmPath = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${mediapipeVersion}/wasm`;
const poseModelPath =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const minVisibility = 0.35;

const poseLandmark = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const;

export interface PosePoint {
  x: number;
  y: number;
  z?: number;
}

export interface PoseSnapshot {
  landmarks: NormalizedLandmark[];
  worldLandmarks: Landmark[];
  bodyCenter: PosePoint | null;
  shoulderAngle: number | null;
  armSpan: number | null;
}

export interface PoseTrackingState {
  enabled: boolean;
  loading: boolean;
  active: boolean;
  error: string | null;
  poses: PoseSnapshot[];
  landmarks: NormalizedLandmark[][];
  worldLandmarks: Landmark[][];
  poseCount: number;
  bodyCenter: PosePoint | null;
  shoulderAngle: number | null;
  armSpan: number | null;
  motionEnergy: number;
}

export const emptyPoseTrackingState: PoseTrackingState = {
  enabled: false,
  loading: false,
  active: false,
  error: null,
  poses: [],
  landmarks: [],
  worldLandmarks: [],
  poseCount: 0,
  bodyCenter: null,
  shoulderAngle: null,
  armSpan: null,
  motionEnergy: 0,
};

export function usePoseTracking(
  enabled: boolean,
  video: HTMLVideoElement | null,
): PoseTrackingState {
  const [state, setState] = useState<PoseTrackingState>(emptyPoseTrackingState);

  useEffect(() => {
    if (!enabled) {
      setState(emptyPoseTrackingState);
      return;
    }

    if (typeof window === "undefined") {
      setState({
        ...emptyPoseTrackingState,
        enabled: true,
        error: "Pose tracking requires a browser window.",
      });
      return;
    }

    if (!video) {
      setState({
        ...emptyPoseTrackingState,
        enabled: true,
        loading: false,
        error: "Start camera to track body pose.",
      });
      return;
    }

    let cancelled = false;
    let frame = 0;
    let landmarker: PoseLandmarker | null = null;
    let previousPrimaryPose: NormalizedLandmark[] | null = null;
    const sourceVideo = video;

    async function start(): Promise<void> {
      try {
        setState((current) => ({
          ...current,
          enabled: true,
          loading: true,
          error: null,
        }));
        landmarker = await createPoseLandmarker();
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
            const nextState = createTrackingState(result, previousPrimaryPose);
            previousPrimaryPose = nextState.landmarks[0] ?? null;
            setState(nextState);
            result.close();
          }
          frame = window.requestAnimationFrame(loop);
        };
        frame = window.requestAnimationFrame(loop);
      } catch (caught) {
        setState({
          ...emptyPoseTrackingState,
          enabled: true,
          loading: false,
          error:
            caught instanceof Error ? caught.message : "Could not start pose tracking.",
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

async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: poseModelPath,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
  } catch {
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: poseModelPath,
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
  }
}

function createTrackingState(
  result: PoseLandmarkerResult,
  previousPrimaryPose: NormalizedLandmark[] | null,
): PoseTrackingState {
  const landmarks = result.landmarks ?? [];
  const worldLandmarks = result.worldLandmarks ?? [];
  const poses = landmarks.map((pose, index): PoseSnapshot => {
    const worldPose = worldLandmarks[index] ?? [];
    return {
      landmarks: pose,
      worldLandmarks: worldPose,
      bodyCenter: bodyCenter(pose),
      shoulderAngle: shoulderAngle(pose),
      armSpan: armSpan(pose),
    };
  });
  const primaryPose = poses[0] ?? null;
  const motionEnergy =
    landmarks.length > 0 ? poseMotionEnergy(landmarks[0], previousPrimaryPose) : 0;

  return {
    enabled: true,
    loading: false,
    active: poses.length > 0,
    error: null,
    poses,
    landmarks,
    worldLandmarks,
    poseCount: poses.length,
    bodyCenter: primaryPose?.bodyCenter ?? null,
    shoulderAngle: primaryPose?.shoulderAngle ?? null,
    armSpan: primaryPose?.armSpan ?? null,
    motionEnergy,
  };
}

function bodyCenter(pose: NormalizedLandmark[]): PosePoint | null {
  const torso = [
    pose[poseLandmark.leftShoulder],
    pose[poseLandmark.rightShoulder],
    pose[poseLandmark.leftHip],
    pose[poseLandmark.rightHip],
  ].filter(isVisibleLandmark);

  if (torso.length >= 2) {
    return averagePoint(torso);
  }

  const visiblePoints = pose.filter(isVisibleLandmark);
  if (visiblePoints.length === 0) {
    return null;
  }
  return averagePoint(visiblePoints);
}

function shoulderAngle(pose: NormalizedLandmark[]): number | null {
  const left = pose[poseLandmark.leftShoulder];
  const right = pose[poseLandmark.rightShoulder];
  if (!isVisibleLandmark(left) || !isVisibleLandmark(right)) {
    return null;
  }
  return radiansToDegrees(Math.atan2(right.y - left.y, right.x - left.x));
}

function armSpan(pose: NormalizedLandmark[]): number | null {
  const left = pose[poseLandmark.leftWrist] ?? pose[poseLandmark.leftElbow];
  const right = pose[poseLandmark.rightWrist] ?? pose[poseLandmark.rightElbow];
  if (!isVisibleLandmark(left) || !isVisibleLandmark(right)) {
    return null;
  }
  return distance2d(left, right);
}

function poseMotionEnergy(
  currentPose: NormalizedLandmark[],
  previousPose: NormalizedLandmark[] | null,
): number {
  if (!previousPose) {
    return 0;
  }

  let total = 0;
  let count = 0;
  const pointCount = Math.min(currentPose.length, previousPose.length);
  for (let index = 0; index < pointCount; index += 1) {
    const current = currentPose[index];
    const previous = previousPose[index];
    if (!isVisibleLandmark(current) || !isVisibleLandmark(previous)) {
      continue;
    }
    total += distance3d(current, previous);
    count += 1;
  }

  if (count === 0) {
    return 0;
  }
  return clamp(total / count / 0.06, 0, 1);
}

function averagePoint(points: NormalizedLandmark[]): PosePoint {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function isVisibleLandmark(
  point: NormalizedLandmark | undefined,
): point is NormalizedLandmark {
  return (
    point !== undefined &&
    (point.visibility === undefined || point.visibility >= minVisibility)
  );
}

function distance2d(first: PosePoint, second: PosePoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function distance3d(first: PosePoint, second: PosePoint): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    (first.z ?? 0) - (second.z ?? 0),
  );
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
