import { PROJECT_FORMAT, PROJECT_VERSION } from "./defaults";
import type { Project } from "./types";

export function parseProjectJson(source: string): Project {
  const parsed = JSON.parse(source) as unknown;
  if (!isProject(parsed)) {
    throw new Error("Invalid Hello Cam project file.");
  }
  return parsed;
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function isProject(value: unknown): value is Project {
  if (!isRecord(value)) {
    return false;
  }
  if (value.format !== PROJECT_FORMAT || value.version !== PROJECT_VERSION) {
    return false;
  }
  return Array.isArray(value.nodes) && Array.isArray(value.connections);
}

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
