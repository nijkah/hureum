import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("helloCam", {
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (payload: unknown) => ipcRenderer.invoke("project:save", payload),
  saveProjectAs: (payload: unknown) =>
    ipcRenderer.invoke("project:saveAs", payload),
  writeSnapshot: (payload: unknown) =>
    ipcRenderer.invoke("autosave:writeSnapshot", payload),
  listSnapshots: () => ipcRenderer.invoke("autosave:listSnapshots"),
  openFullscreenOutput: (payload: unknown) =>
    ipcRenderer.invoke("window:openFullscreenOutput", payload),
  onOutputProject: (callback: (project: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, project: unknown): void => {
      callback(project);
    };
    ipcRenderer.on("output:project", listener);
    return () => ipcRenderer.removeListener("output:project", listener);
  },
});
