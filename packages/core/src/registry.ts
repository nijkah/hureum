import type { NodeDefinition } from "./types";

export class NodeRegistry {
  private readonly definitions = new Map<string, NodeDefinition>();

  register(definition: NodeDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Node type already registered: ${definition.type}`);
    }
    this.definitions.set(definition.type, definition);
  }

  registerMany(definitions: NodeDefinition[]): void {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  get(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  all(): NodeDefinition[] {
    return [...this.definitions.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }
}
