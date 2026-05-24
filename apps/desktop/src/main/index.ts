import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

let mainWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#eef3f1",
    title: "Hello Cam",
    webPreferences: {
      preload: path.join(dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void loadRenderer(mainWindow);
}

async function createOutputWindow(project: unknown): Promise<void> {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.focus();
    outputWindow.webContents.send("output:project", project);
    return;
  }

  outputWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    backgroundColor: "#11191b",
    title: "Hello Cam Output",
    webPreferences: {
      preload: path.join(dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  outputWindow.on("closed", () => {
    outputWindow = null;
  });
  await loadRenderer(outputWindow, "#/output");
  outputWindow.webContents.once("did-finish-load", () => {
    outputWindow?.webContents.send("output:project", project);
  });
}

async function loadRenderer(window: BrowserWindow, hash = ""): Promise<void> {
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash}`);
    return;
  }
  await window.loadFile(path.join(dirname, "../renderer/index.html"), {
    hash: hash.replace(/^#/, ""),
  });
}

function recoveryDirectory(): string {
  return path.join(app.getPath("userData"), "recovery");
}

ipcMain.handle("project:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open Hello Cam Project",
    filters: [{ name: "Hello Cam Project", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const filePath = result.filePaths[0];
  const source = await readFile(filePath, "utf8");
  return { path: filePath, data: JSON.parse(source) };
});

ipcMain.handle("project:save", async (_event, payload) => {
  const filePath = typeof payload?.path === "string" ? payload.path : null;
  if (!filePath) {
    return saveProjectAs(payload);
  }
  await writeFile(filePath, `${JSON.stringify(payload.data, null, 2)}\n`, "utf8");
  return { path: filePath };
});

ipcMain.handle("project:saveAs", async (_event, payload) => saveProjectAs(payload));

ipcMain.handle("autosave:writeSnapshot", async (_event, payload) => {
  await mkdir(recoveryDirectory(), { recursive: true });
  const filePath = path.join(recoveryDirectory(), "latest.hello-cam.json");
  await writeFile(filePath, `${JSON.stringify(payload.data, null, 2)}\n`, "utf8");
});

ipcMain.handle("autosave:listSnapshots", async () => {
  try {
    const directory = recoveryDirectory();
    const entries = await readdir(directory);
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          const filePath = path.join(directory, entry);
          const source = await readFile(filePath, "utf8");
          return { path: filePath, data: JSON.parse(source) };
        }),
    );
    return snapshots;
  } catch {
    return [];
  }
});

ipcMain.handle("window:openFullscreenOutput", async (_event, payload) => {
  await createOutputWindow(payload.data);
});

async function saveProjectAs(payload: { data: unknown }): Promise<{ path: string | null }> {
  const result = await dialog.showSaveDialog({
    title: "Save Hello Cam Project",
    defaultPath: "hello-cam-project.json",
    filters: [{ name: "Hello Cam Project", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) {
    return { path: null };
  }
  await writeFile(
    result.filePath,
    `${JSON.stringify(payload.data, null, 2)}\n`,
    "utf8",
  );
  return { path: result.filePath };
}

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
