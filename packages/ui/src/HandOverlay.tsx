import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useLayoutEffect, useRef, useState } from "react";
import type { FaceTrackingState } from "./faceTracking";
import type { HandTrackingState } from "./handTracking";
import type { PoseTrackingState } from "./poseTracking";

const handConnections: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const faceContours: Array<{ className: string; indices: number[] }> = [
  {
    className: "face-oval",
    indices: [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
      379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
      234, 127, 162, 21, 54, 103, 67, 109, 10,
    ],
  },
  {
    className: "face-mouth",
    indices: [
      61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269,
      267, 0, 37, 39, 40, 185, 61,
    ],
  },
  {
    className: "face-eye",
    indices: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
  },
  {
    className: "face-eye",
    indices: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263],
  },
  { className: "face-brow", indices: [70, 63, 105, 66, 107] },
  { className: "face-brow", indices: [336, 296, 334, 293, 300] },
  { className: "face-nose", indices: [168, 6, 197, 195, 5, 4, 1] },
];

const facePointIndices = Array.from(
  new Set(faceContours.flatMap((contour) => contour.indices)),
);

const poseConnections: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32],
];

const minPoseVisibility = 0.35;

export interface TrackingOverlayVisibility {
  hands: boolean;
  face: boolean;
  pose: boolean;
}

export function TrackingOverlay({
  faceTracking,
  handTracking,
  mirror,
  poseTracking,
  visibility,
  video,
}: {
  faceTracking: FaceTrackingState;
  handTracking: HandTrackingState;
  mirror: boolean;
  poseTracking: PoseTrackingState;
  visibility: TrackingOverlayVisibility;
  video: HTMLVideoElement | null;
}) {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  const showHands = visibility.hands && handTracking.enabled;
  const showFace = visibility.face && faceTracking.enabled;
  const showPose = visibility.pose && poseTracking.enabled;

  useLayoutEffect(() => {
    if (!showHands && !showFace && !showPose) {
      setBounds({ width: 1, height: 1 });
      return;
    }

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    const currentOverlay = overlay;
    let frame = 0;

    function measure(): void {
      const rect = currentOverlay.getBoundingClientRect();
      const width = Math.max(1, rect.width || currentOverlay.clientWidth);
      const height = Math.max(1, rect.height || currentOverlay.clientHeight);
      setBounds((current) => {
        if (
          Math.round(current.width) === Math.round(width) &&
          Math.round(current.height) === Math.round(height)
        ) {
          return current;
        }
        return { width, height };
      });
    }

    measure();
    frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(currentOverlay);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showFace, showHands, showPose]);

  if (!showHands && !showFace && !showPose) {
    return null;
  }

  const transform = createVideoTransform(video, bounds.width, bounds.height);

  return (
    <svg
      aria-hidden="true"
      className="tracking-overlay"
      fill="none"
      focusable="false"
      preserveAspectRatio="none"
      ref={overlayRef}
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
    >
      {showPose &&
        poseTracking.landmarks.map((pose, poseIndex) => (
          <g className="pose-layer" key={`pose-${poseIndex}`}>
            {poseConnections.map(([from, to]) => {
              const fromPoint = pose[from];
              const toPoint = pose[to];
              if (!isVisiblePoseLandmark(fromPoint) || !isVisiblePoseLandmark(toPoint)) {
                return null;
              }
              return (
                <line
                  key={`${from}-${to}`}
                  x1={toScreenX(fromPoint, transform, mirror)}
                  x2={toScreenX(toPoint, transform, mirror)}
                  y1={toScreenY(fromPoint, transform)}
                  y2={toScreenY(toPoint, transform)}
                />
              );
            })}
            {pose.map((point, index) =>
              isVisiblePoseLandmark(point) ? (
                <circle
                  cx={toScreenX(point, transform, mirror)}
                  cy={toScreenY(point, transform)}
                  key={index}
                  r={isTorsoPoint(index) ? 5 : 3.4}
                />
              ) : null,
            )}
          </g>
        ))}
      {showFace &&
        faceTracking.landmarks.map((face, faceIndex) => (
          <g className="face-layer" key={`face-${faceIndex}`}>
            {faceContours.map((contour) =>
              contour.indices.slice(0, -1).map((from, index) => {
                const to = contour.indices[index + 1];
                const fromPoint = face[from];
                const toPoint = face[to];
                if (!fromPoint || !toPoint) {
                  return null;
                }
                return (
                  <line
                    className={contour.className}
                    key={`${contour.className}-${from}-${to}-${index}`}
                    x1={toScreenX(fromPoint, transform, mirror)}
                    x2={toScreenX(toPoint, transform, mirror)}
                    y1={toScreenY(fromPoint, transform)}
                    y2={toScreenY(toPoint, transform)}
                  />
                );
              }),
            )}
            {facePointIndices.map((index) => {
              const point = face[index];
              if (!point) {
                return null;
              }
              return (
                <circle
                  cx={toScreenX(point, transform, mirror)}
                  cy={toScreenY(point, transform)}
                  key={index}
                  r={isFaceAnchorPoint(index) ? 4 : 2.3}
                />
              );
            })}
          </g>
        ))}
      {showHands && (
        <>
          {handTracking.hands.map((hand, handIndex) => (
            <g className="hand-layer" key={`hand-${handIndex}`}>
              {handConnections.map(([from, to]) => (
                <line
                  key={`${from}-${to}`}
                  x1={toScreenX(hand[from], transform, mirror)}
                  x2={toScreenX(hand[to], transform, mirror)}
                  y1={toScreenY(hand[from], transform)}
                  y2={toScreenY(hand[to], transform)}
                />
              ))}
              {hand.map((point, index) => (
                <circle
                  cx={toScreenX(point, transform, mirror)}
                  cy={toScreenY(point, transform)}
                  key={index}
                  r={index === 0 ? 6 : 3.6}
                />
              ))}
            </g>
          ))}
          {handTracking.hands.length >= 2 && (
            <line
              className="hand-distance-line"
              x1={toScreenX(palmCenter(handTracking.hands[0]), transform, mirror)}
              x2={toScreenX(palmCenter(handTracking.hands[1]), transform, mirror)}
              y1={toScreenY(palmCenter(handTracking.hands[0]), transform)}
              y2={toScreenY(palmCenter(handTracking.hands[1]), transform)}
            />
          )}
        </>
      )}
    </svg>
  );
}

export function HandOverlay({
  mirror,
  tracking,
  video,
}: {
  mirror: boolean;
  tracking: HandTrackingState;
  video: HTMLVideoElement | null;
}) {
  return (
    <TrackingOverlay
      faceTracking={{
        active: false,
        blinkLeft: 0,
        blinkRight: 0,
        blendshapes: [],
        enabled: false,
        error: null,
        faceCount: 0,
        faces: [],
        headCenter: null,
        landmarks: [],
        loading: false,
        mouthOpen: 0,
      }}
      handTracking={tracking}
      mirror={mirror}
      poseTracking={{
        active: false,
        armSpan: null,
        bodyCenter: null,
        enabled: false,
        error: null,
        landmarks: [],
        loading: false,
        motionEnergy: 0,
        poseCount: 0,
        poses: [],
        shoulderAngle: null,
        worldLandmarks: [],
      }}
      video={video}
      visibility={{ hands: true, face: false, pose: false }}
    />
  );
}

interface VideoTransform {
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
}

function createVideoTransform(
  video: HTMLVideoElement | null,
  width: number,
  height: number,
): VideoTransform {
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return { drawWidth: width, drawHeight: height, offsetX: 0, offsetY: 0 };
  }

  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = width / height;
  if (videoRatio > canvasRatio) {
    const drawWidth = height * videoRatio;
    return {
      drawWidth,
      drawHeight: height,
      offsetX: (width - drawWidth) / 2,
      offsetY: 0,
    };
  }

  const drawHeight = width / videoRatio;
  return {
    drawWidth: width,
    drawHeight,
    offsetX: 0,
    offsetY: (height - drawHeight) / 2,
  };
}

function toScreenX(
  point: Pick<NormalizedLandmark, "x"> | undefined,
  transform: VideoTransform,
  mirror: boolean,
): number {
  const x = clamp01(point?.x ?? 0);
  return transform.offsetX + (mirror ? 1 - x : x) * transform.drawWidth;
}

function toScreenY(
  point: Pick<NormalizedLandmark, "y"> | undefined,
  transform: VideoTransform,
): number {
  return transform.offsetY + clamp01(point?.y ?? 0) * transform.drawHeight;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function isVisiblePoseLandmark(
  point: NormalizedLandmark | undefined,
): point is NormalizedLandmark {
  return (
    point !== undefined &&
    (point.visibility === undefined || point.visibility >= minPoseVisibility)
  );
}

function isTorsoPoint(index: number): boolean {
  return index === 11 || index === 12 || index === 23 || index === 24;
}

function isFaceAnchorPoint(index: number): boolean {
  return index === 1 || index === 10 || index === 152 || index === 33 || index === 263;
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
