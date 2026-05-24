import { describe, expect, it } from "vitest";
import {
  coreNodeDefinitions,
  createDefaultProject,
  createRegistry,
  evaluateProject,
  parseProjectJson,
  serializeProject,
  topologicalSort,
  validateProject,
} from "../src";

describe("graph", () => {
  it("sorts the default project in dependency order", () => {
    const project = createDefaultProject();
    const order = topologicalSort(project);
    expect(order.indexOf("time_1")).toBeLessThan(order.indexOf("shader_1"));
    expect(order.indexOf("shader_1")).toBeLessThan(order.indexOf("output_1"));
  });

  it("detects cycles", () => {
    const project = createDefaultProject();
    project.connections.push({
      id: "cycle",
      from: { nodeId: "output_1", portId: "texture" },
      to: { nodeId: "shader_1", portId: "camera" },
    });
    const registry = createRegistry(coreNodeDefinitions);
    const issues = validateProject(project, registry);
    expect(issues.some((issue) => issue.code === "cycle")).toBe(true);
  });

  it("round trips project JSON", () => {
    const project = createDefaultProject();
    const source = serializeProject(project);
    expect(parseProjectJson(source)).toEqual(project);
  });

  it("evaluates core signal nodes", () => {
    const registry = createRegistry(coreNodeDefinitions);
    const result = evaluateProject(
      {
        format: "hello-cam-project",
        version: 1,
        nodes: [
          {
            id: "constant",
            type: "core.constant",
            position: { x: 0, y: 0 },
            parameters: { value: 0.5 },
          },
          {
            id: "map",
            type: "core.mapRange",
            position: { x: 1, y: 0 },
            parameters: {
              inMin: 0,
              inMax: 1,
              outMin: 10,
              outMax: 20,
              clamp: true,
            },
          },
        ],
        connections: [
          {
            id: "edge",
            from: { nodeId: "constant", portId: "value" },
            to: { nodeId: "map", portId: "value" },
          },
        ],
      },
      registry,
      { time: 0, deltaTime: 0, frame: 0 },
    );
    expect(result.values.map.value).toBe(15);
  });

  it("evaluates mapping helper nodes", () => {
    const registry = createRegistry(coreNodeDefinitions);
    const result = evaluateProject(
      {
        format: "hello-cam-project",
        version: 1,
        nodes: [
          {
            id: "constant",
            type: "core.constant",
            position: { x: 0, y: 0 },
            parameters: { value: 0.75 },
          },
          {
            id: "invert",
            type: "core.invert",
            position: { x: 1, y: 0 },
            parameters: { min: 0, max: 1 },
          },
          {
            id: "threshold",
            type: "core.threshold",
            position: { x: 2, y: 0 },
            parameters: { threshold: 0.5, mode: "above" },
          },
        ],
        connections: [
          {
            id: "invert-edge",
            from: { nodeId: "constant", portId: "value" },
            to: { nodeId: "invert", portId: "value" },
          },
          {
            id: "threshold-edge",
            from: { nodeId: "constant", portId: "value" },
            to: { nodeId: "threshold", portId: "value" },
          },
        ],
      },
      registry,
      { time: 0, deltaTime: 0, frame: 0 },
    );
    expect(result.values.invert.value).toBe(0.25);
    expect(result.values.threshold.gate).toBe(1);
  });
});
