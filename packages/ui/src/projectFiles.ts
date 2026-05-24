import {
  createDefaultProject,
  parseProjectJson,
  serializeProject,
  type Project,
} from "@hello-cam/core";
import { getBridge } from "./bridge";

export async function openProjectFile(): Promise<{
  project: Project;
  path: string | null;
} | null> {
  const bridge = getBridge();
  if (bridge) {
    const result = await bridge.openProject();
    return result ? { project: result.data, path: result.path } : null;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) {
    return null;
  }
  return {
    project: parseProjectJson(await file.text()),
    path: null,
  };
}

export async function saveProjectFile(
  project: Project,
  path: string | null,
): Promise<string | null> {
  const bridge = getBridge();
  if (bridge) {
    const result = path
      ? await bridge.saveProject({ path, data: project })
      : await bridge.saveProjectAs({ data: project });
    return result.path;
  }

  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hello-cam-project.json";
  anchor.click();
  URL.revokeObjectURL(url);
  return null;
}

export async function saveProjectFileAs(project: Project): Promise<string | null> {
  const bridge = getBridge();
  if (bridge) {
    const result = await bridge.saveProjectAs({ data: project });
    return result.path;
  }
  return saveProjectFile(project, null);
}

export async function writeRecoverySnapshot(project: Project): Promise<void> {
  const bridge = getBridge();
  if (bridge) {
    await bridge.writeSnapshot({ data: project });
    return;
  }
  localStorage.setItem("hello-cam-recovery", serializeProject(project));
}

export function readLocalRecoverySnapshot(): Project | null {
  const source = localStorage.getItem("hello-cam-recovery");
  if (!source) {
    return null;
  }
  try {
    return parseProjectJson(source);
  } catch {
    return createDefaultProject();
  }
}
