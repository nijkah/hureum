import { audioNodeDefinitions } from "@hello-cam/audio";
import {
  coreNodeDefinitions,
  createRegistry,
  type NodeDefinition,
  type ProjectNode,
} from "@hello-cam/core";
import { renderNodeDefinitions } from "@hello-cam/render-webgpu";
import { musicNodeDefinitions } from "./musicNodes";
import { perceptionNodeDefinitions } from "./perceptionNodes";

export const availableNodeDefinitions: NodeDefinition[] = [
  ...coreNodeDefinitions,
  ...perceptionNodeDefinitions,
  ...musicNodeDefinitions,
  ...audioNodeDefinitions,
  ...renderNodeDefinitions,
];

export const nodeRegistry = createRegistry(availableNodeDefinitions);

export const nodeCategoryLabels: Record<NodeDefinition["category"], string> = {
  input: "Sources",
  signal: "Signals",
  visual: "Visuals",
  output: "Output",
};

export function createNodeFromDefinition(
  definition: NodeDefinition,
  position: { x: number; y: number },
): ProjectNode {
  return {
    id: `${definition.type.replace(/[^a-z0-9]/gi, "_")}_${createIdSuffix()}`,
    type: definition.type,
    position,
    parameters: Object.fromEntries(
      definition.parameters.map((parameter) => [
        parameter.id,
        parameter.defaultValue,
      ]),
    ),
  };
}

export function findNodeDefinition(type: string): NodeDefinition | undefined {
  return nodeRegistry.get(type);
}

function createIdSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
