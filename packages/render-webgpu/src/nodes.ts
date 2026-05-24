import { DEFAULT_FRAGMENT_BODY, type NodeDefinition } from "@hello-cam/core";

export const renderNodeDefinitions: NodeDefinition[] = [
  {
    type: "input.camera",
    label: "Camera Video",
    category: "input",
    description: "Live camera texture from the browser runtime.",
    inputs: [],
    outputs: [{ id: "texture", label: "Texture", type: "texture" }],
    parameters: [
      {
        id: "deviceId",
        label: "Device",
        type: "text",
        defaultValue: "default",
      },
    ],
    evaluate: () => ({ texture: "camera" }),
  },
  {
    type: "render.shader",
    label: "Visual Shader",
    category: "visual",
    description: "WGSL fragment body that generates the visual texture.",
    inputs: [
      { id: "time", label: "Time", type: "number" },
      { id: "level", label: "Level", type: "number" },
      { id: "bass", label: "Bass", type: "number" },
      { id: "mid", label: "Mid", type: "number" },
      { id: "treble", label: "Treble", type: "number" },
      { id: "camera", label: "Camera", type: "texture" },
    ],
    outputs: [{ id: "texture", label: "Texture", type: "texture" }],
    parameters: [
      {
        id: "label",
        label: "Label",
        type: "text",
        defaultValue: "Shader",
      },
      {
        id: "fragmentBody",
        label: "Fragment Body",
        type: "textarea",
        defaultValue: DEFAULT_FRAGMENT_BODY,
      },
    ],
    evaluate: ({ inputs, node }) => ({
      texture: "shader",
      time: asNumber(inputs.time, 0),
      level: asNumber(inputs.level, 0),
      bass: asNumber(inputs.bass, 0),
      mid: asNumber(inputs.mid, 0),
      treble: asNumber(inputs.treble, 0),
      fragmentBody:
        typeof node.parameters.fragmentBody === "string"
          ? node.parameters.fragmentBody
          : DEFAULT_FRAGMENT_BODY,
    }),
  },
  {
    type: "render.output",
    label: "Canvas Output",
    category: "output",
    description: "Final texture shown in the live preview.",
    inputs: [{ id: "texture", label: "Texture", type: "texture" }],
    outputs: [],
    parameters: [],
    evaluate: ({ inputs }) => ({ texture: inputs.texture }),
  },
];

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
