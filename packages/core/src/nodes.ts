import type { NodeDefinition } from "./types";

interface SignalNodeState {
  value: number;
  previousInput: number;
  lastFrame: number;
}

const signalNodeState = new Map<string, SignalNodeState>();

function numberParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringParam(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const coreNodeDefinitions: NodeDefinition[] = [
  {
    type: "core.time",
    label: "Clock",
    category: "input",
    description: "Seconds, delta time, and frame count.",
    inputs: [],
    outputs: [
      { id: "seconds", label: "Seconds", type: "number" },
      { id: "delta", label: "Delta", type: "number" },
      { id: "frame", label: "Frame", type: "number" },
    ],
    parameters: [],
    evaluate: ({ context }) => ({
      seconds: context.time,
      delta: context.deltaTime,
      frame: context.frame,
    }),
  },
  {
    type: "core.constant",
    label: "Number",
    category: "signal",
    description: "A fixed numeric signal.",
    inputs: [],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "value",
        label: "Value",
        type: "number",
        defaultValue: 1,
        step: 0.01,
      },
    ],
    evaluate: ({ node }) => ({ value: numberParam(node.parameters.value, 1) }),
  },
  {
    type: "core.mapRange",
    label: "Scale",
    category: "signal",
    description: "Remap a signal from one numeric range into another.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "inMin",
        label: "Input Min",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
      {
        id: "inMax",
        label: "Input Max",
        type: "number",
        defaultValue: 1,
        step: 0.01,
      },
      {
        id: "outMin",
        label: "Output Min",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
      {
        id: "outMax",
        label: "Output Max",
        type: "number",
        defaultValue: 1,
        step: 0.01,
      },
      {
        id: "clamp",
        label: "Clamp",
        type: "boolean",
        defaultValue: true,
      },
    ],
    evaluate: ({ node, inputs }) => {
      const value = numberParam(inputs.value, 0);
      const inMin = numberParam(node.parameters.inMin, 0);
      const inMax = numberParam(node.parameters.inMax, 1);
      const outMin = numberParam(node.parameters.outMin, 0);
      const outMax = numberParam(node.parameters.outMax, 1);
      const shouldClamp = node.parameters.clamp !== false;
      const span = inMax - inMin;
      const normalized = span === 0 ? 0 : (value - inMin) / span;
      const t = shouldClamp ? clamp01(normalized) : normalized;
      return { value: outMin + (outMax - outMin) * t };
    },
  },
  {
    type: "core.normalize",
    label: "Normalize",
    category: "signal",
    description: "Convert a value from a measured range into 0..1.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "min",
        label: "Min",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
      {
        id: "max",
        label: "Max",
        type: "number",
        defaultValue: 1,
        step: 0.01,
      },
      {
        id: "clamp",
        label: "Clamp",
        type: "boolean",
        defaultValue: true,
      },
    ],
    evaluate: ({ node, inputs }) => {
      const value = asNumber(inputs.value);
      const min = numberParam(node.parameters.min, 0);
      const max = numberParam(node.parameters.max, 1);
      const span = max - min;
      const normalized = span === 0 ? 0 : (value - min) / span;
      return { value: node.parameters.clamp === false ? normalized : clamp01(normalized) };
    },
  },
  {
    type: "core.clamp",
    label: "Clamp",
    category: "signal",
    description: "Limit a numeric signal to a fixed minimum and maximum.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "min",
        label: "Min",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
      {
        id: "max",
        label: "Max",
        type: "number",
        defaultValue: 1,
        step: 0.01,
      },
    ],
    evaluate: ({ node, inputs }) => {
      const min = numberParam(node.parameters.min, 0);
      const max = numberParam(node.parameters.max, 1);
      return { value: clamp(asNumber(inputs.value), Math.min(min, max), Math.max(min, max)) };
    },
  },
  {
    type: "core.invert",
    label: "Invert",
    category: "signal",
    description: "Flip a numeric signal inside a target range.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "min",
        label: "Min",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
      {
        id: "max",
        label: "Max",
        type: "number",
        defaultValue: 1,
        step: 0.01,
      },
    ],
    evaluate: ({ node, inputs }) => {
      const min = numberParam(node.parameters.min, 0);
      const max = numberParam(node.parameters.max, 1);
      return { value: min + max - asNumber(inputs.value) };
    },
  },
  {
    type: "core.deadzone",
    label: "Deadzone",
    category: "signal",
    description: "Suppress tiny movement around a center value.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "center",
        label: "Center",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
      {
        id: "radius",
        label: "Radius",
        type: "number",
        defaultValue: 0.02,
        min: 0,
        step: 0.005,
      },
    ],
    evaluate: ({ node, inputs }) => {
      const value = asNumber(inputs.value);
      const center = numberParam(node.parameters.center, 0);
      const radius = Math.max(0, numberParam(node.parameters.radius, 0.02));
      return { value: Math.abs(value - center) <= radius ? center : value };
    },
  },
  {
    type: "core.curve",
    label: "Curve",
    category: "signal",
    description: "Shape a 0..1 control signal with a response curve.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "easeInOut",
        options: [
          { label: "Linear", value: "linear" },
          { label: "Ease In", value: "easeIn" },
          { label: "Ease Out", value: "easeOut" },
          { label: "Ease In/Out", value: "easeInOut" },
          { label: "Exponential", value: "exponential" },
          { label: "Logarithmic", value: "logarithmic" },
        ],
      },
      {
        id: "amount",
        label: "Amount",
        type: "number",
        defaultValue: 2,
        min: 0.1,
        max: 8,
        step: 0.1,
      },
    ],
    evaluate: ({ node, inputs }) => {
      const value = clamp01(asNumber(inputs.value));
      const amount = clamp(numberParam(node.parameters.amount, 2), 0.1, 8);
      const mode = stringParam(node.parameters.mode, "easeInOut");
      return { value: applyCurve(value, mode, amount) };
    },
  },
  {
    type: "core.smooth",
    label: "Smooth",
    category: "signal",
    description: "Low-pass filter a jittery control signal over time.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "timeMs",
        label: "Time ms",
        type: "number",
        defaultValue: 80,
        min: 0,
        max: 2000,
        step: 1,
      },
    ],
    evaluate: ({ context, node, inputs }) => {
      const input = asNumber(inputs.value);
      const timeMs = Math.max(0, numberParam(node.parameters.timeMs, 80));
      const previous = signalNodeState.get(node.id);
      if (!previous || context.frame <= previous.lastFrame || timeMs === 0) {
        signalNodeState.set(node.id, {
          value: input,
          previousInput: input,
          lastFrame: context.frame,
        });
        return { value: input };
      }
      const alpha = 1 - Math.exp(-Math.max(0, context.deltaTime) / (timeMs / 1000));
      const value = previous.value + (input - previous.value) * clamp01(alpha);
      signalNodeState.set(node.id, {
        value,
        previousInput: input,
        lastFrame: context.frame,
      });
      return { value };
    },
  },
  {
    type: "core.threshold",
    label: "Trigger",
    category: "signal",
    description: "Turn a continuous value into a gate or one-frame trigger.",
    inputs: [{ id: "value", label: "Value", type: "number" }],
    outputs: [{ id: "gate", label: "Gate", type: "number" }],
    parameters: [
      {
        id: "threshold",
        label: "Threshold",
        type: "number",
        defaultValue: 0.65,
        step: 0.01,
      },
      {
        id: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "above",
        options: [
          { label: "Above", value: "above" },
          { label: "Below", value: "below" },
          { label: "Rising Edge", value: "rising" },
          { label: "Falling Edge", value: "falling" },
        ],
      },
    ],
    evaluate: ({ context, node, inputs }) => {
      const value = asNumber(inputs.value);
      const threshold = numberParam(node.parameters.threshold, 0.65);
      const mode = stringParam(node.parameters.mode, "above");
      const previous = signalNodeState.get(node.id);
      const wasAbove = (previous?.previousInput ?? value) >= threshold;
      const isAbove = value >= threshold;
      const gate =
        mode === "below"
          ? !isAbove
          : mode === "rising"
            ? !wasAbove && isAbove
            : mode === "falling"
              ? wasAbove && !isAbove
              : isAbove;
      signalNodeState.set(node.id, {
        value: gate ? 1 : 0,
        previousInput: value,
        lastFrame: context.frame,
      });
      return { gate: gate ? 1 : 0 };
    },
  },
  {
    type: "core.hold",
    label: "Hold",
    category: "signal",
    description: "Sample a value when a gate is active and hold the last sample.",
    inputs: [
      { id: "value", label: "Value", type: "number" },
      { id: "gate", label: "Gate", type: "number" },
    ],
    outputs: [{ id: "value", label: "Value", type: "number" }],
    parameters: [
      {
        id: "threshold",
        label: "Gate Threshold",
        type: "number",
        defaultValue: 0.5,
        step: 0.01,
      },
      {
        id: "initial",
        label: "Initial",
        type: "number",
        defaultValue: 0,
        step: 0.01,
      },
    ],
    evaluate: ({ context, node, inputs }) => {
      const value = asNumber(inputs.value);
      const gate = asNumber(inputs.gate);
      const threshold = numberParam(node.parameters.threshold, 0.5);
      const previous = signalNodeState.get(node.id);
      const held =
        gate >= threshold
          ? value
          : (previous?.value ?? numberParam(node.parameters.initial, 0));
      signalNodeState.set(node.id, {
        value: held,
        previousInput: value,
        lastFrame: context.frame,
      });
      return { value: held };
    },
  },
];

function applyCurve(value: number, mode: string, amount: number): number {
  switch (mode) {
    case "linear":
      return value;
    case "easeIn":
      return value ** amount;
    case "easeOut":
      return 1 - (1 - value) ** amount;
    case "exponential":
      return (Math.exp(value * amount) - 1) / (Math.exp(amount) - 1);
    case "logarithmic":
      return Math.log(1 + value * amount) / Math.log(1 + amount);
    case "easeInOut":
    default:
      return value < 0.5
        ? 0.5 * (value * 2) ** amount
        : 1 - 0.5 * ((1 - value) * 2) ** amount;
  }
}
