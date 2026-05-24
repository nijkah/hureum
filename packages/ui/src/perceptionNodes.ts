import type { NodeDefinition } from "@hello-cam/core";
import type { FaceTrackingState } from "./faceTracking";
import type { HandTrackingState } from "./handTracking";
import type { PoseTrackingState } from "./poseTracking";

function handTrackingFromContext(
  external: Record<string, unknown> | undefined,
): Partial<HandTrackingState> {
  const value = external?.hands;
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Partial<HandTrackingState>;
}

function faceTrackingFromContext(
  external: Record<string, unknown> | undefined,
): Partial<FaceTrackingState> {
  const value = external?.face;
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Partial<FaceTrackingState>;
}

function poseTrackingFromContext(
  external: Record<string, unknown> | undefined,
): Partial<PoseTrackingState> {
  const value = external?.pose;
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Partial<PoseTrackingState>;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const perceptionNodeDefinitions: NodeDefinition[] = [
  {
    type: "input.hands",
    label: "Hand Tracker",
    category: "input",
    description: "Two-hand count, 2D/3D distance, closeness, and pitch.",
    inputs: [],
    outputs: [
      { id: "count", label: "Count", type: "number" },
      { id: "distance", label: "2D Distance", type: "number" },
      { id: "distance3d", label: "3D Distance", type: "number" },
      { id: "closeness", label: "Closeness", type: "number" },
      { id: "closeness3d", label: "3D Close", type: "number" },
      { id: "pitch", label: "Pitch Hz", type: "number" },
    ],
    parameters: [
      {
        id: "enabled",
        label: "Enabled",
        type: "boolean",
        defaultValue: true,
      },
    ],
    evaluate: ({ context, node }) => {
      if (node.parameters.enabled === false) {
        return {
          count: 0,
          distance: 0,
          distance3d: 0,
          closeness: 0,
          closeness3d: 0,
          pitch: 0,
        };
      }

      const hands = handTrackingFromContext(context.external);
      return {
        count: finiteNumber(hands.handCount, 0),
        distance: finiteNumber(hands.distance, 0),
        distance3d: finiteNumber(hands.distance3d, 0),
        closeness: finiteNumber(hands.closeness, 0),
        closeness3d: finiteNumber(hands.closeness3d, 0),
        pitch: finiteNumber(hands.pitchHz, 0),
      };
    },
  },
  {
    type: "input.face",
    label: "Face Tracker",
    category: "input",
    description: "Face count, mouth, blink, and head center controls.",
    inputs: [],
    outputs: [
      { id: "count", label: "Count", type: "number" },
      { id: "mouthOpen", label: "Mouth", type: "number" },
      { id: "blinkLeft", label: "Blink L", type: "number" },
      { id: "blinkRight", label: "Blink R", type: "number" },
      { id: "headX", label: "Head X", type: "number" },
      { id: "headY", label: "Head Y", type: "number" },
    ],
    parameters: [
      {
        id: "enabled",
        label: "Enabled",
        type: "boolean",
        defaultValue: true,
      },
    ],
    evaluate: ({ context, node }) => {
      if (node.parameters.enabled === false) {
        return {
          count: 0,
          mouthOpen: 0,
          blinkLeft: 0,
          blinkRight: 0,
          headX: 0,
          headY: 0,
        };
      }
      const face = faceTrackingFromContext(context.external);
      return {
        count: finiteNumber(face.faceCount, 0),
        mouthOpen: finiteNumber(face.mouthOpen, 0),
        blinkLeft: finiteNumber(face.blinkLeft, 0),
        blinkRight: finiteNumber(face.blinkRight, 0),
        headX: finiteNumber(face.headCenter?.x, 0),
        headY: finiteNumber(face.headCenter?.y, 0),
      };
    },
  },
  {
    type: "input.pose",
    label: "Body Pose",
    category: "input",
    description: "Body center, arm span, shoulder angle, and motion controls.",
    inputs: [],
    outputs: [
      { id: "count", label: "Count", type: "number" },
      { id: "centerX", label: "Center X", type: "number" },
      { id: "centerY", label: "Center Y", type: "number" },
      { id: "armSpan", label: "Arm Span", type: "number" },
      { id: "shoulderAngle", label: "Shoulder", type: "number" },
      { id: "motion", label: "Motion", type: "number" },
    ],
    parameters: [
      {
        id: "enabled",
        label: "Enabled",
        type: "boolean",
        defaultValue: true,
      },
    ],
    evaluate: ({ context, node }) => {
      if (node.parameters.enabled === false) {
        return {
          count: 0,
          centerX: 0,
          centerY: 0,
          armSpan: 0,
          shoulderAngle: 0,
          motion: 0,
        };
      }
      const pose = poseTrackingFromContext(context.external);
      return {
        count: finiteNumber(pose.poseCount, 0),
        centerX: finiteNumber(pose.bodyCenter?.x, 0),
        centerY: finiteNumber(pose.bodyCenter?.y, 0),
        armSpan: finiteNumber(pose.armSpan, 0),
        shoulderAngle: finiteNumber(pose.shoulderAngle, 0),
        motion: finiteNumber(pose.motionEnergy, 0),
      };
    },
  },
];
