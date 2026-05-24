import { NodeRegistry } from "./registry";
import type {
  EvaluationContext,
  EvaluationResult,
  NodeDefinition,
  Project,
  ProjectConnection,
  ProjectNode,
  ValidationIssue,
} from "./types";

export function validateProject(
  project: Project,
  registry: NodeRegistry,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();

  for (const node of project.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "duplicate-node-id",
        message: `Duplicate node id: ${node.id}`,
        nodeId: node.id,
      });
    }
    nodeIds.add(node.id);

    if (!registry.get(node.type)) {
      issues.push({
        code: "missing-node-definition",
        message: `Missing node definition: ${node.type}`,
        nodeId: node.id,
      });
    }
  }

  for (const connection of project.connections) {
    const fromNode = project.nodes.find(
      (node) => node.id === connection.from.nodeId,
    );
    const toNode = project.nodes.find((node) => node.id === connection.to.nodeId);
    if (!fromNode || !toNode) {
      issues.push({
        code: "missing-node",
        message: `Connection references a missing node: ${connection.id}`,
        connectionId: connection.id,
      });
      continue;
    }

    const fromDefinition = registry.get(fromNode.type);
    const toDefinition = registry.get(toNode.type);
    if (!fromDefinition || !toDefinition) {
      continue;
    }

    const fromPort = fromDefinition.outputs.find(
      (port) => port.id === connection.from.portId,
    );
    const toPort = toDefinition.inputs.find(
      (port) => port.id === connection.to.portId,
    );

    if (!fromPort || !toPort) {
      issues.push({
        code: "missing-port",
        message: `Connection references a missing port: ${connection.id}`,
        connectionId: connection.id,
      });
      continue;
    }

    if (fromPort.type !== toPort.type) {
      issues.push({
        code: "port-type-mismatch",
        message: `Port type mismatch on connection: ${connection.id}`,
        connectionId: connection.id,
      });
    }
  }

  const order = topologicalSort(project);
  if (order.length !== project.nodes.length) {
    issues.push({ code: "cycle", message: "Graph contains a cycle." });
  }

  return issues;
}

export function evaluateProject(
  project: Project,
  registry: NodeRegistry,
  context: EvaluationContext,
): EvaluationResult {
  const issues = validateProject(project, registry);
  const blockingIssue = issues.find((issue) =>
    ["duplicate-node-id", "missing-node", "cycle"].includes(issue.code),
  );
  const order = topologicalSort(project);
  const values: Record<string, Record<string, unknown>> = {};

  if (blockingIssue) {
    return { order, values, issues };
  }

  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) {
      continue;
    }
    const definition = registry.get(node.type);
    if (!definition?.evaluate) {
      values[node.id] = {};
      continue;
    }
    const inputs = collectInputs(project.connections, node, values);
    values[node.id] = definition.evaluate({ node, inputs, context });
  }

  return { order, values, issues };
}

export function topologicalSort(project: Project): string[] {
  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of project.nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const connection of project.connections) {
    if (
      !nodesById.has(connection.from.nodeId) ||
      !nodesById.has(connection.to.nodeId)
    ) {
      continue;
    }
    outgoing.get(connection.from.nodeId)?.push(connection.to.nodeId);
    incoming.set(
      connection.to.nodeId,
      (incoming.get(connection.to.nodeId) ?? 0) + 1,
    );
  }

  const queue = [...incoming.entries()]
    .filter(([, count]) => count === 0)
    .map(([nodeId]) => nodeId);
  const order: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      break;
    }
    order.push(nodeId);
    for (const targetId of outgoing.get(nodeId) ?? []) {
      const nextCount = (incoming.get(targetId) ?? 0) - 1;
      incoming.set(targetId, nextCount);
      if (nextCount === 0) {
        queue.push(targetId);
      }
    }
  }

  return order;
}

export function createRegistry(definitions: NodeDefinition[]): NodeRegistry {
  const registry = new NodeRegistry();
  registry.registerMany(definitions);
  return registry;
}

function collectInputs(
  connections: ProjectConnection[],
  node: ProjectNode,
  values: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const connection of connections) {
    if (connection.to.nodeId !== node.id) {
      continue;
    }
    inputs[connection.to.portId] =
      values[connection.from.nodeId]?.[connection.from.portId];
  }
  return inputs;
}
