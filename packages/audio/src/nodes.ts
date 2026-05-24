import type { NodeDefinition } from "@hello-cam/core";
import { silentAudioSnapshot, type AudioSnapshot } from "./analysis";

function audioSnapshotFromContext(external: Record<string, unknown> | undefined): AudioSnapshot {
  const value = external?.audio;
  if (!value || typeof value !== "object") {
    return silentAudioSnapshot;
  }
  return { ...silentAudioSnapshot, ...(value as Partial<AudioSnapshot>) };
}

export const audioNodeDefinitions: NodeDefinition[] = [
  {
    type: "audio.micLevel",
    label: "Microphone Level",
    category: "input",
    description: "Smoothed microphone volume and peak level.",
    inputs: [],
    outputs: [
      { id: "level", label: "Level", type: "number" },
      { id: "peak", label: "Peak", type: "number" },
    ],
    parameters: [
      {
        id: "smoothing",
        label: "Smoothing",
        type: "number",
        defaultValue: 0.82,
        min: 0,
        max: 0.98,
        step: 0.01,
      },
    ],
    evaluate: ({ context }) => {
      const audio = audioSnapshotFromContext(context.external);
      return { level: audio.level, peak: audio.peak };
    },
  },
  {
    type: "audio.audioBands",
    label: "Frequency Bands",
    category: "input",
    description: "Bass, mid, and treble energy from the microphone.",
    inputs: [],
    outputs: [
      { id: "bass", label: "Bass", type: "number" },
      { id: "mid", label: "Mid", type: "number" },
      { id: "treble", label: "Treble", type: "number" },
    ],
    parameters: [
      {
        id: "smoothing",
        label: "Smoothing",
        type: "number",
        defaultValue: 0.78,
        min: 0,
        max: 0.98,
        step: 0.01,
      },
    ],
    evaluate: ({ context }) => {
      const audio = audioSnapshotFromContext(context.external);
      return { bass: audio.bass, mid: audio.mid, treble: audio.treble };
    },
  },
];
