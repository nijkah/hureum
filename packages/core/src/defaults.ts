import type { Project, ProjectCalibration } from "./types";

export const PROJECT_FORMAT = "hello-cam-project" as const;
export const PROJECT_VERSION = 1 as const;

export const defaultProjectCalibration: ProjectCalibration = {
  camera: {
    mirror: true,
    resolution: "1280x720",
    fps: 30,
  },
  tracking: {
    handNear: 0.08,
    handFar: 0.72,
    handFar3d: 0.86,
    smoothingMs: 80,
    deadzone: 0.02,
    triggerThreshold: 0.65,
  },
};

export function projectCalibration(
  project: Pick<Project, "calibration">,
): ProjectCalibration {
  return {
    camera: {
      ...defaultProjectCalibration.camera,
      ...(project.calibration?.camera ?? {}),
    },
    tracking: {
      ...defaultProjectCalibration.tracking,
      ...(project.calibration?.tracking ?? {}),
    },
  };
}

export function createEmptyProject(): Project {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    calibration: defaultProjectCalibration,
    visualEffects: [],
  };
}

export function createDefaultProject(): Project {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
    calibration: defaultProjectCalibration,
    visualEffects: [],
    nodes: [
      {
        id: "time_1",
        type: "core.time",
        position: { x: 60, y: 80 },
        parameters: {},
      },
      {
        id: "camera_1",
        type: "input.camera",
        position: { x: 60, y: 260 },
        parameters: { deviceId: "default" },
      },
      {
        id: "mic_1",
        type: "audio.micLevel",
        position: { x: 60, y: 440 },
        parameters: { smoothing: 0.82 },
      },
      {
        id: "bands_1",
        type: "audio.audioBands",
        position: { x: 300, y: 440 },
        parameters: { smoothing: 0.78 },
      },
      {
        id: "shader_1",
        type: "render.shader",
        position: { x: 560, y: 190 },
        parameters: {
          label: "Camera Pass",
          fragmentBody: DEFAULT_FRAGMENT_BODY,
        },
      },
      {
        id: "output_1",
        type: "render.output",
        position: { x: 860, y: 230 },
        parameters: {},
      },
    ],
    connections: [
      {
        id: "edge_time_shader",
        from: { nodeId: "time_1", portId: "seconds" },
        to: { nodeId: "shader_1", portId: "time" },
      },
      {
        id: "edge_mic_shader",
        from: { nodeId: "mic_1", portId: "level" },
        to: { nodeId: "shader_1", portId: "level" },
      },
      {
        id: "edge_bass_shader",
        from: { nodeId: "bands_1", portId: "bass" },
        to: { nodeId: "shader_1", portId: "bass" },
      },
      {
        id: "edge_mid_shader",
        from: { nodeId: "bands_1", portId: "mid" },
        to: { nodeId: "shader_1", portId: "mid" },
      },
      {
        id: "edge_treble_shader",
        from: { nodeId: "bands_1", portId: "treble" },
        to: { nodeId: "shader_1", portId: "treble" },
      },
      {
        id: "edge_camera_shader",
        from: { nodeId: "camera_1", portId: "texture" },
        to: { nodeId: "shader_1", portId: "camera" },
      },
      {
        id: "edge_shader_output",
        from: { nodeId: "shader_1", portId: "texture" },
        to: { nodeId: "output_1", portId: "texture" },
      },
    ],
  };
}

export const DEFAULT_FRAGMENT_BODY = `
let cameraColor = camera(uv);
return vec4<f32>(cameraColor.rgb, 1.0);
`.trim();
