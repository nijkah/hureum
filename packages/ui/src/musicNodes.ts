import type { NodeDefinition } from "@hello-cam/core";
import { compileGyeol, defaultGyeolSource } from "@hello-cam/gyeol";

function textParam(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export const musicNodeDefinitions: NodeDefinition[] = [
  {
    type: "music.gyeolScore",
    label: "Gyeol Score",
    category: "input",
    description: "Gyeol performance score compiled into music and visual events.",
    inputs: [],
    outputs: [
      { id: "tempo", label: "Tempo", type: "number" },
      { id: "eventCount", label: "Events", type: "number" },
      { id: "diagnosticCount", label: "Issues", type: "number" },
      { id: "events", label: "Gyeol Events", type: "event" },
      { id: "transport", label: "Transport", type: "signal" },
      { id: "audioEnergy", label: "Audio Energy", type: "signal" },
      { id: "visualEvents", label: "Visual Events", type: "event" },
    ],
    parameters: [
      {
        id: "source",
        label: "Gyeol",
        type: "textarea",
        defaultValue: defaultGyeolSource,
      },
      {
        id: "enabled",
        label: "Enabled",
        type: "boolean",
        defaultValue: true,
      },
      {
        id: "masterGain",
        label: "Master Gain",
        type: "number",
        defaultValue: 0.82,
        min: 0,
        max: 1.5,
        step: 0.01,
      },
      {
        id: "preload",
        label: "Preload",
        type: "boolean",
        defaultValue: true,
      },
    ],
    evaluate: ({ node }) => {
      if (node.parameters.enabled === false) {
        return {
          tempo: 0,
          eventCount: 0,
          diagnosticCount: 0,
          events: [],
          transport: { isPlaying: false, beat: 0 },
          audioEnergy: { rms: 0, low: 0, mid: 0, high: 0 },
          visualEvents: [],
        };
      }
      const compiled = compileGyeol(textParam(node.parameters.source, ""));
      const visualEvents = compiled.score.events.filter((event) => event.type === "visual");
      return {
        tempo: compiled.score.settings.bpm,
        eventCount: compiled.score.events.length,
        diagnosticCount: compiled.diagnostics.length,
        events: compiled.score.events,
        transport: { isPlaying: false, beat: 0, bpm: compiled.score.settings.bpm },
        audioEnergy: { rms: 0, low: 0, mid: 0, high: 0 },
        visualEvents,
      };
    },
  },
];
