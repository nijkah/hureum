import type { Project } from "@hello-cam/core";

export interface ProjectFileResult {
  path: string | null;
  data: Project;
}

export interface HelloCamBridge {
  openProject(): Promise<ProjectFileResult | null>;
  saveProject(payload: { path: string | null; data: Project }): Promise<{ path: string | null }>;
  saveProjectAs(payload: { data: Project }): Promise<{ path: string | null }>;
  writeSnapshot(payload: { data: Project }): Promise<void>;
  listSnapshots(): Promise<ProjectFileResult[]>;
  openFullscreenOutput(payload: { data: Project }): Promise<void>;
  onOutputProject(callback: (project: Project) => void): () => void;
}

declare global {
  interface Window {
    helloCam?: HelloCamBridge;
  }
}

export function getBridge(): HelloCamBridge | undefined {
  return typeof window === "undefined" ? undefined : window.helloCam;
}
