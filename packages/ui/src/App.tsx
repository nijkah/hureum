import "@xyflow/react/dist/style.css";
import {
  createDefaultProject,
  parseProjectJson,
  projectCalibration,
  serializeProject,
  validateProject,
  type Project,
} from "@hello-cam/core";
import {
  AudioWaveform,
  Cable,
  CircleDot,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FileAudio,
  FolderOpen,
  Hand,
  KeyboardMusic,
  Mic,
  MonitorPlay,
  PersonStanding,
  Play,
  RotateCcw,
  Save,
  ScanFace,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  compileGyeol,
  createGyeolEngine,
  defaultGyeolSource,
  giantStepsGyeolSource,
  sampleStackGyeolSource,
  type GyeolCompileResult,
  type GyeolEngine,
  type GyeolEngineState,
  type GyeolEvent,
} from "@hello-cam/gyeol";
import { getBridge } from "./bridge";
import { useDrumMachine, type DrumMachine, type DrumTrack } from "./drumMachine";
import { GraphEditor } from "./GraphEditor";
import {
  handKeyboardInstrumentOptions,
  handKeyboardOrderOptions,
  handKeyboardScaleOptions,
  type HandKeyboardSettings,
} from "./handKeyboard";
import { Inspector } from "./Inspector";
import { createNodeFromDefinition, findNodeDefinition, nodeRegistry } from "./nodeCatalog";
import { useLoopStation, type LoopClip, type LoopStation } from "./loopStation";
import {
  openProjectFile,
  readLocalRecoverySnapshot,
  saveProjectFile,
  saveProjectFileAs,
  writeRecoverySnapshot,
} from "./projectFiles";
import { useInteractiveRuntime, type InteractiveRuntime } from "./runtimeState";
import type { ThereminSettings } from "./theremin";
import { VisualRuntime } from "./VisualRuntime";
import {
  globalVisualEffectPresets,
  normalizeGlobalVisualEffectIds,
  patchVisualEffectPresets,
} from "./visualEffects";
import { WaveEditor } from "./WaveEditor";
import "./styles.css";

type WorkspaceMode = "compose" | "patch" | "perform";
type ComposerTool =
  | "theremin"
  | "keyboard"
  | "loop"
  | "drum"
  | "gyeol"
  | "mapping"
  | "hands"
  | "face"
  | "pose"
  | "mic"
  | "visual";

interface ToolItem {
  id: ComposerTool;
  label: string;
  icon: LucideIcon;
}

const toolItems: ToolItem[] = [
  { id: "theremin", label: "Hand Theremin", icon: AudioWaveform },
  { id: "keyboard", label: "Air Keyboard", icon: KeyboardMusic },
  { id: "loop", label: "Loop Station", icon: FileAudio },
  { id: "drum", label: "Drum Machine", icon: CircleDot },
  { id: "gyeol", label: "Gyeol", icon: Code2 },
  { id: "mapping", label: "Mapping", icon: SlidersHorizontal },
  { id: "hands", label: "Hands", icon: Hand },
  { id: "face", label: "Face", icon: ScanFace },
  { id: "pose", label: "Body", icon: PersonStanding },
  { id: "mic", label: "Mic", icon: Mic },
  { id: "visual", label: "Visual", icon: Sparkles },
];

export function HelloCamApp() {
  const isOutputRoute = window.location.hash === "#/output";
  return isOutputRoute ? <OutputOnlyApp /> : <EditorApp />;
}

function EditorApp() {
  const [project, setProject] = useState<Project>(() => createDefaultProject());
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("shader_1");
  const [mode, setMode] = useState<WorkspaceMode>("compose");
  const [selectedTool, setSelectedTool] = useState<ComposerTool>("theremin");
  const [gyeolSource, setGyeolSource] = useState(defaultGyeolSource);
  const [status, setStatus] = useState("Unsaved project");
  const runtime = useInteractiveRuntime(projectCalibration(project));
  const loopStation = useLoopStation();
  const drumMachine = useDrumMachine();
  const globalVisualEffectIds = useMemo(
    () => normalizeGlobalVisualEffectIds(project.visualEffects),
    [project.visualEffects],
  );
  const issues = useMemo(
    () => validateProject(project, nodeRegistry),
    [project],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void writeRecoverySnapshot(project).then(() => {
        localStorage.setItem("hello-cam-last-project", serializeProject(project));
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const gyeolNode = project.nodes.find((node) => node.type === "music.gyeolScore");
    const source = gyeolNode?.parameters.source;
    if (typeof source === "string") {
      setGyeolSource(source);
    }
  }, [project]);

  async function openProject(): Promise<void> {
    try {
      const result = await openProjectFile();
      if (!result) {
        return;
      }
      setProject(result.project);
      setProjectPath(result.path);
      setSelectedNodeId(result.project.nodes[0]?.id ?? null);
      setStatus(result.path ?? "Project opened");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Open failed");
    }
  }

  async function saveProject(): Promise<void> {
    try {
      const path = await saveProjectFile(project, projectPath);
      setProjectPath(path);
      setStatus(path ?? "Project exported");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Save failed");
    }
  }

  async function saveAsProject(): Promise<void> {
    try {
      const path = await saveProjectFileAs(project);
      setProjectPath(path);
      setStatus(path ?? "Project exported");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Save failed");
    }
  }

  function recoverLocalSnapshot(): void {
    const recovered = readLocalRecoverySnapshot();
    if (!recovered) {
      setStatus("No recovery snapshot found");
      return;
    }
    setProject(recovered);
    setProjectPath(null);
    setSelectedNodeId(recovered.nodes[0]?.id ?? null);
    setStatus("Recovered local snapshot");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">HC</span>
          <div>
            <h1>Hello Cam</h1>
            <p>{status}</p>
          </div>
        </div>
        <nav className="mode-tabs" aria-label="Workspace mode">
          <button
            className={mode === "compose" ? "mode-tab mode-tab-active" : "mode-tab"}
            onClick={() => setMode("compose")}
            type="button"
          >
            <SlidersHorizontal size={16} />
            Compose
          </button>
          <button
            className={mode === "patch" ? "mode-tab mode-tab-active" : "mode-tab"}
            onClick={() => setMode("patch")}
            type="button"
          >
            <Cable size={16} />
            Patch
          </button>
          <button
            className={mode === "perform" ? "mode-tab mode-tab-active" : "mode-tab"}
            onClick={() => setMode("perform")}
            type="button"
          >
            <MonitorPlay size={16} />
            Perform
          </button>
        </nav>
        <nav className="toolbar" aria-label="Project actions">
          <button onClick={openProject} title="Open project" type="button">
            <FolderOpen size={17} />
            Open
          </button>
          <button onClick={saveProject} title="Save project" type="button">
            <Save size={17} />
            Save
          </button>
          <button onClick={saveAsProject} title="Save project as" type="button">
            <FileDown size={17} />
            Save As
          </button>
          <button onClick={recoverLocalSnapshot} title="Recover snapshot" type="button">
            <RotateCcw size={17} />
            Recover
          </button>
        </nav>
      </header>
      {mode === "compose" && (
        <div className="composer-workspace">
          <ToolRail selectedTool={selectedTool} onSelectTool={setSelectedTool} />
          <div className="composer-stage">
            <VisualRuntime
              project={project}
              renderPipeline={
                selectedTool === "visual" || globalVisualEffectIds.length > 0
                  ? "graph"
                  : "camera"
              }
              runtime={runtime}
            />
          </div>
          <ComposerInspector
            gyeolSource={gyeolSource}
            drumMachine={drumMachine}
            issues={issues}
            loopStation={loopStation}
            project={project}
            runtime={runtime}
            selectedTool={selectedTool}
            onGyeolSourceChange={setGyeolSource}
            onOpenPatch={() => setMode("patch")}
            onPerform={() => setMode("perform")}
            onProjectChange={setProject}
          />
        </div>
      )}
      {mode === "patch" && (
        <div className="patch-workspace">
          <GraphEditor
            project={project}
            selectedNodeId={selectedNodeId}
            onProjectChange={setProject}
            onSelectNode={setSelectedNodeId}
          />
          <Inspector
            issues={issues}
            project={project}
            selectedNodeId={selectedNodeId}
            onProjectChange={setProject}
          />
        </div>
      )}
      {mode === "perform" && (
        <div className="perform-workspace">
          <VisualRuntime project={project} renderPipeline="graph" runtime={runtime} />
          <PerformancePanel
            issues={issues}
            loopStation={loopStation}
            runtime={runtime}
            onOpenPatch={() => setMode("patch")}
          />
        </div>
      )}
    </main>
  );
}

function ToolRail({
  selectedTool,
  onSelectTool,
}: {
  selectedTool: ComposerTool;
  onSelectTool(tool: ComposerTool): void;
}) {
  return (
    <nav className="tool-rail" aria-label="Creative tools">
      {toolItems.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            aria-pressed={tool.id === selectedTool}
            className={tool.id === selectedTool ? "tool-button tool-button-active" : "tool-button"}
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            type="button"
          >
            <Icon size={20} />
            <span>{tool.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ComposerInspector({
  gyeolSource,
  drumMachine,
  issues,
  loopStation,
  project,
  runtime,
  selectedTool,
  onGyeolSourceChange,
  onOpenPatch,
  onPerform,
  onProjectChange,
}: {
  gyeolSource: string;
  drumMachine: DrumMachine;
  issues: ReturnType<typeof validateProject>;
  loopStation: LoopStation;
  project: Project;
  runtime: InteractiveRuntime;
  selectedTool: ComposerTool;
  onGyeolSourceChange(source: string): void;
  onOpenPatch(): void;
  onPerform(): void;
  onProjectChange(project: Project): void;
}) {
  if (selectedTool === "theremin") {
    return (
      <ThereminPanel
        runtime={runtime}
        onOpenPatch={onOpenPatch}
        onPerform={onPerform}
      />
    );
  }
  if (selectedTool === "keyboard") {
    return (
      <HandKeyboardPanel
        runtime={runtime}
        onOpenPatch={onOpenPatch}
        onPerform={onPerform}
      />
    );
  }
  if (selectedTool === "loop") {
    return <LoopStationPanel loopStation={loopStation} />;
  }
  if (selectedTool === "drum") {
    return <DrumMachinePanel drumMachine={drumMachine} />;
  }
  if (selectedTool === "gyeol") {
    return (
      <GyeolPanel
        project={project}
        source={gyeolSource}
        onOpenPatch={onOpenPatch}
        onProjectChange={onProjectChange}
        onSourceChange={onGyeolSourceChange}
      />
    );
  }
  if (selectedTool === "mapping") {
    return (
      <MappingPanel
        project={project}
        onOpenPatch={onOpenPatch}
        onProjectChange={onProjectChange}
      />
    );
  }
  if (selectedTool === "hands") {
    return <HandTrackerPanel runtime={runtime} onOpenPatch={onOpenPatch} />;
  }
  if (selectedTool === "mic") {
    return <MicrophonePanel runtime={runtime} onOpenPatch={onOpenPatch} />;
  }
  if (selectedTool === "visual") {
    return (
      <VisualPanel
        issues={issues}
        project={project}
        onOpenPatch={onOpenPatch}
        onProjectChange={onProjectChange}
      />
    );
  }
  if (selectedTool === "face") {
    return <FaceTrackerPanel runtime={runtime} onOpenPatch={onOpenPatch} />;
  }
  return <PoseTrackerPanel runtime={runtime} onOpenPatch={onOpenPatch} />;
}

function ThereminPanel({
  runtime,
  onOpenPatch,
  onPerform,
}: {
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
  onPerform(): void;
}) {
  const settings = runtime.thereminSettings;
  const frequency = runtime.theremin.frequency;
  const noteName = runtime.theremin.noteName;

  function update<K extends keyof ThereminSettings>(
    key: K,
    value: ThereminSettings[K],
  ): void {
    runtime.setThereminSettings({ ...settings, [key]: value });
  }

  return (
    <aside className="tool-panel" aria-label="Theremin settings">
      <PanelHeading icon={AudioWaveform} kicker="Instrument" title="Hand Theremin" />
      <div className="primary-actions">
        <button
          className={runtime.thereminEnabled ? "primary-action primary-action-on" : "primary-action"}
          onClick={runtime.thereminEnabled ? runtime.stopTheremin : runtime.startTheremin}
          type="button"
        >
          <Play size={16} />
          {runtime.thereminEnabled ? "Stop" : "Play"}
        </button>
        <button
          className={runtime.handTrackingEnabled ? "secondary-action secondary-action-on" : "secondary-action"}
          onClick={() =>
            runtime.handTrackingEnabled
              ? runtime.stopHandTracking()
              : runtime.startHandTracking()
          }
          type="button"
        >
          <Hand size={16} />
          Track
        </button>
        <OverlayToggleButton
          enabled={runtime.handOverlayEnabled}
          label="Overlay"
          onToggle={() => runtime.setHandOverlayEnabled(!runtime.handOverlayEnabled)}
        />
      </div>
      <div className="signal-strip">
        <SignalPill label="Hands" value={`${runtime.handTracking.handCount}/2`} />
        <SignalPill
          label="Pitch"
          value={
            frequency
              ? `${noteName ? `${noteName} ` : ""}${Math.round(frequency)} Hz`
              : "waiting"
          }
        />
        <SignalPill
          label="Level"
          value={`${Math.round(settings.volume * 100)}%`}
        />
      </div>
      <section className="tool-section">
        <h3>Pitch</h3>
        <SelectField
          label="Source"
          value={settings.pitchSource}
          onChange={(value) => update("pitchSource", value)}
          options={[
            { label: "2D hand distance", value: "handDistance" },
            { label: "3D hand distance", value: "handDistance3d" },
            { label: "First hand height", value: "firstHandHeight" },
            { label: "Second hand height", value: "secondHandHeight" },
          ]}
        />
        <SelectField
          label="Mode"
          value={settings.pitchMode}
          onChange={(value) => update("pitchMode", value)}
          options={[
            { label: "Continuous", value: "continuous" },
            { label: "12-tone", value: "chromatic" },
          ]}
        />
        <div className="field-pair">
          <NumberField
            label="Low Hz"
            min={20}
            max={settings.maxHz}
            step={1}
            value={settings.minHz}
            onChange={(value) => update("minHz", value)}
          />
          <NumberField
            label="High Hz"
            min={settings.minHz}
            max={12000}
            step={1}
            value={settings.maxHz}
            onChange={(value) => update("maxHz", value)}
          />
        </div>
        {settings.pitchMode === "chromatic" && (
          <NumberField
            label="A4 Reference"
            min={400}
            max={480}
            step={0.1}
            value={settings.concertA}
            onChange={(value) => update("concertA", value)}
          />
        )}
      </section>
      <section className="tool-section">
        <h3>Voice</h3>
        <SelectField
          label="Wave"
          value={settings.waveform}
          onChange={(value) => update("waveform", value)}
          options={[
            { label: "Sine", value: "sine" },
            { label: "Triangle", value: "triangle" },
            { label: "Saw", value: "sawtooth" },
            { label: "Square", value: "square" },
            { label: "Custom", value: "custom" },
          ]}
        />
        <WaveEditor
          customWaveform={settings.customWaveform}
          onChange={(customWaveform) =>
            runtime.setThereminSettings({
              ...settings,
              customWaveform,
              waveform: "custom",
            })
          }
          waveform={settings.waveform}
        />
        <div className="knob-grid">
          <KnobField
            label="Volume"
            max={0.35}
            min={0}
            step={0.005}
            value={settings.volume}
            onChange={(value) => update("volume", value)}
            valueLabel={(value) => `${Math.round((value / 0.35) * 100)}%`}
          />
          <KnobField
            label="Tone"
            max={1}
            min={0}
            step={0.01}
            value={settings.tone}
            onChange={(value) => update("tone", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Glide"
            max={0.35}
            min={0.005}
            step={0.005}
            value={settings.glide}
            onChange={(value) => update("glide", value)}
            valueLabel={(value) => `${Math.round(value * 1000)} ms`}
          />
          <KnobField
            label="Echo"
            max={0.75}
            min={0}
            step={0.01}
            value={settings.delayMix}
            onChange={(value) => update("delayMix", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Delay"
            max={1.2}
            min={0.01}
            step={0.01}
            value={settings.delayTime}
            onChange={(value) => update("delayTime", value)}
            valueLabel={(value) => `${Math.round(value * 1000)} ms`}
          />
          <KnobField
            label="Feedback"
            max={0.85}
            min={0}
            step={0.01}
            value={settings.delayFeedback}
            onChange={(value) => update("delayFeedback", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Reverb"
            max={0.75}
            min={0}
            step={0.01}
            value={settings.reverbMix}
            onChange={(value) => update("reverbMix", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
        </div>
      </section>
      <PanelFooter onOpenPatch={onOpenPatch} onPerform={onPerform} />
      <RuntimeError errors={runtime.errors} />
    </aside>
  );
}

function HandKeyboardPanel({
  runtime,
  onOpenPatch,
  onPerform,
}: {
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
  onPerform(): void;
}) {
  const settings = runtime.handKeyboardSettings;
  const keyboard = runtime.handKeyboard;
  const activeNotes =
    keyboard.activeNotes.length > 0 ? keyboard.activeNotes.join(" ") : "waiting";

  function update<K extends keyof HandKeyboardSettings>(
    key: K,
    value: HandKeyboardSettings[K],
  ): void {
    runtime.setHandKeyboardSettings({ ...settings, [key]: value });
  }

  return (
    <aside className="tool-panel" aria-label="Air Keyboard settings">
      <PanelHeading icon={KeyboardMusic} kicker="Instrument" title="Air Keyboard" />
      <div className="primary-actions">
        <button
          className={runtime.handKeyboardEnabled ? "primary-action primary-action-on" : "primary-action"}
          onClick={
            runtime.handKeyboardEnabled
              ? runtime.stopHandKeyboard
              : runtime.startHandKeyboard
          }
          type="button"
        >
          <Play size={16} />
          {runtime.handKeyboardEnabled ? "Stop" : "Play"}
        </button>
        <button
          className={runtime.handTrackingEnabled ? "secondary-action secondary-action-on" : "secondary-action"}
          onClick={() =>
            runtime.handTrackingEnabled
              ? runtime.stopHandTracking()
              : runtime.startHandTracking()
          }
          type="button"
        >
          <Hand size={16} />
          Track
        </button>
        <OverlayToggleButton
          enabled={runtime.handOverlayEnabled}
          label="Overlay"
          onToggle={() => runtime.setHandOverlayEnabled(!runtime.handOverlayEnabled)}
        />
      </div>
      <div className="signal-strip">
        <SignalPill label="Hands" value={`${runtime.handTracking.handCount}/2`} />
        <SignalPill label="Keys" value={`${keyboard.activeCount}/10`} />
        <SignalPill label="Notes" value={activeNotes} />
      </div>
      <section className="tool-section">
        <h3>Keyboard</h3>
        <SelectField
          label="Instrument"
          value={settings.instrument}
          onChange={(value) => update("instrument", value)}
          options={handKeyboardInstrumentOptions}
        />
        <div className="field-pair">
          <SelectField
            label="Scale"
            value={settings.scale}
            onChange={(value) => update("scale", value)}
            options={handKeyboardScaleOptions}
          />
          <NumberField
            label="Root MIDI"
            max={84}
            min={36}
            step={1}
            value={settings.rootMidiNote}
            onChange={(value) => update("rootMidiNote", Math.round(value))}
          />
        </div>
        <SelectField
          label="Hand Order"
          value={settings.handOrder}
          onChange={(value) => update("handOrder", value)}
          options={handKeyboardOrderOptions}
        />
      </section>
      <section className="tool-section">
        <h3>Response</h3>
        <div className="knob-grid">
          <KnobField
            label="Volume"
            max={1}
            min={0}
            step={0.01}
            value={settings.volume}
            onChange={(value) => update("volume", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Tone"
            max={1}
            min={0}
            step={0.01}
            value={settings.tone}
            onChange={(value) => update("tone", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Press"
            max={0.98}
            min={0.08}
            step={0.01}
            value={settings.pressThreshold}
            onChange={(value) => update("pressThreshold", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Release"
            max={0.92}
            min={0}
            step={0.01}
            value={settings.releaseThreshold}
            onChange={(value) => update("releaseThreshold", value)}
            valueLabel={(value) => `${Math.round(value * 100)}%`}
          />
          <KnobField
            label="Curve"
            max={3}
            min={0.35}
            step={0.05}
            value={settings.velocityCurve}
            onChange={(value) => update("velocityCurve", value)}
            valueLabel={(value) => `${value.toFixed(2)}x`}
          />
        </div>
      </section>
      <section className="tool-section">
        <h3>Keys</h3>
        <div className="air-keyboard-grid">
          {keyboard.keys.map((key) => (
            <div
              className={[
                "air-key",
                key.visible ? "air-key-visible" : "",
                key.pressed ? "air-key-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={key.id}
            >
              <div className="air-key-header">
                <strong>{key.noteName}</strong>
                <span>{key.label}</span>
              </div>
              <div className="air-key-meter">
                <span
                  style={
                    {
                      "--air-key-bend": `${Math.round(key.bend * 100)}%`,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <PanelFooter onOpenPatch={onOpenPatch} onPerform={onPerform} />
      <RuntimeError errors={runtime.errors} />
    </aside>
  );
}

function LoopStationPanel({ loopStation }: { loopStation: LoopStation }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const selectedClip =
    loopStation.clips.find((clip) => clip.id === selectedClipId) ??
    loopStation.clips[0] ??
    null;

  useEffect(() => {
    if (loopStation.clips.length === 0) {
      setSelectedClipId(null);
      return;
    }
    if (!selectedClipId || !loopStation.clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(loopStation.clips[0]?.id ?? null);
    }
  }, [loopStation.clips, selectedClipId]);

  function importSelectedFiles(files: FileList | null): void {
    if (!files || files.length === 0) {
      return;
    }
    void loopStation.importFiles(files);
  }

  function playAll(): void {
    for (const clip of loopStation.clips) {
      loopStation.playClip(clip.id);
    }
  }

  return (
    <aside className="tool-panel" aria-label="Loop Station">
      <PanelHeading icon={FileAudio} kicker="Sampler" title="Loop Station" />
      <input
        accept="audio/*"
        className="hidden-file-input"
        multiple
        onChange={(event) => {
          importSelectedFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />
      <div className="primary-actions">
        <button
          className="primary-action"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Upload size={16} />
          Import
        </button>
        <button className="secondary-action" onClick={loopStation.stopAll} type="button">
          <Square size={16} />
          Stop All
        </button>
      </div>
      <div className="signal-strip">
        <SignalPill label="Clips" value={`${loopStation.clips.length}`} />
        <SignalPill
          label="Playing"
          value={`${loopStation.clips.filter((clip) => clip.playing).length}`}
        />
        <SignalPill
          label="Master"
          value={`${Math.round(loopStation.masterGain * 100)}%`}
        />
      </div>
      <section className="tool-section">
        <div className="section-title-row">
          <h3>Clips</h3>
          <div className="inline-actions">
            <button
              disabled={loopStation.clips.length === 0}
              onClick={playAll}
              type="button"
            >
              <Play size={14} />
              Play All
            </button>
            <button
              disabled={!loopStation.copiedClip}
              onClick={() => {
                const id = loopStation.pasteClip();
                if (id) {
                  setSelectedClipId(id);
                }
              }}
              type="button"
            >
              <Copy size={14} />
              Paste
            </button>
          </div>
        </div>
        {loopStation.clips.length === 0 ? (
          <div className="empty-state">Import audio files to create editable loop clips.</div>
        ) : (
          <div className="clip-grid">
            {loopStation.clips.map((clip) => (
              <LoopClipCard
                clip={clip}
                isSelected={clip.id === selectedClip?.id}
                key={clip.id}
                onCopy={() => loopStation.copyClip(clip.id)}
                onDelete={() => loopStation.deleteClip(clip.id)}
                onDuplicate={() => {
                  const id = loopStation.duplicateClip(clip.id);
                  if (id) {
                    setSelectedClipId(id);
                  }
                }}
                onSelect={() => setSelectedClipId(clip.id)}
                onToggle={() => loopStation.toggleClip(clip.id)}
              />
            ))}
          </div>
        )}
      </section>
      <section className="tool-section">
        <h3>Edit</h3>
        {selectedClip ? (
          <LoopClipInspector clip={selectedClip} loopStation={loopStation} />
        ) : (
          <div className="empty-state">No clip selected.</div>
        )}
        <KnobField
          label="Master"
          max={1.5}
          min={0}
          step={0.01}
          value={loopStation.masterGain}
          onChange={loopStation.setMasterGain}
          valueLabel={(value) => `${Math.round(value * 100)}%`}
        />
      </section>
      <RuntimeError errors={loopStation.error ?? ""} />
    </aside>
  );
}

function LoopClipCard({
  clip,
  isSelected,
  onCopy,
  onDelete,
  onDuplicate,
  onSelect,
  onToggle,
}: {
  clip: LoopClip;
  isSelected: boolean;
  onCopy(): void;
  onDelete(): void;
  onDuplicate(): void;
  onSelect(): void;
  onToggle(): void;
}) {
  return (
    <div className={isSelected ? "clip-card clip-card-selected" : "clip-card"}>
      <button className="clip-main" onClick={onSelect} type="button">
        <strong>{clip.name}</strong>
        <span>{formatClipDuration(clip)}</span>
      </button>
      <div className="clip-card-actions">
        <button className="icon-button" onClick={onToggle} title="Play or stop" type="button">
          {clip.playing ? <Square size={15} /> : <Play size={15} />}
        </button>
        <button className="icon-button" onClick={onCopy} title="Copy clip" type="button">
          <Copy size={15} />
        </button>
        <button className="icon-button" onClick={onDuplicate} title="Duplicate clip" type="button">
          <Scissors size={15} />
        </button>
        <button className="icon-button" onClick={onDelete} title="Delete clip" type="button">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function LoopClipInspector({
  clip,
  loopStation,
}: {
  clip: LoopClip;
  loopStation: LoopStation;
}) {
  return (
    <div className="clip-inspector">
      <NumberField
        label="Start"
        min={0}
        max={clip.endSec}
        step={0.01}
        value={clip.startSec}
        onChange={(value) => loopStation.updateClip(clip.id, { startSec: value })}
      />
      <NumberField
        label="End"
        min={clip.startSec + 0.01}
        max={Math.max(clip.endSec, clip.startSec + 0.01)}
        step={0.01}
        value={clip.endSec}
        onChange={(value) => loopStation.updateClip(clip.id, { endSec: value })}
      />
      <KnobField
        label="Gain"
        max={2}
        min={0}
        step={0.01}
        value={clip.gain}
        onChange={(value) => loopStation.updateClip(clip.id, { gain: value })}
        valueLabel={(value) => `${Math.round(value * 100)}%`}
      />
      <div className="clip-toggle-row">
        <label>
          <input
            checked={clip.loop}
            onChange={(event) =>
              loopStation.updateClip(clip.id, { loop: event.target.checked })
            }
            type="checkbox"
          />
          Loop
        </label>
        <label>
          <input
            checked={clip.muted}
            onChange={(event) =>
              loopStation.updateClip(clip.id, { muted: event.target.checked })
            }
            type="checkbox"
          />
          Mute
        </label>
        <label>
          <input
            checked={clip.solo}
            onChange={(event) =>
              loopStation.updateClip(clip.id, { solo: event.target.checked })
            }
            type="checkbox"
          />
          Solo
        </label>
      </div>
    </div>
  );
}

function GyeolPanel({
  project,
  source,
  onOpenPatch,
  onProjectChange,
  onSourceChange,
}: {
  project: Project;
  source: string;
  onOpenPatch(): void;
  onProjectChange(project: Project): void;
  onSourceChange(source: string): void;
}) {
  const compiled = useMemo(() => compileGyeol(source), [source]);
  const player = useGyeolPlayer(compiled);
  const score = compiled.score;
  const existingNode = project.nodes.find((node) => node.type === "music.gyeolScore");
  const errors = compiled.diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => `Line ${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`)
    .join("\n");

  function saveToPatch(): void {
    const definition = findNodeDefinition("music.gyeolScore");
    if (!definition) {
      return;
    }
    if (existingNode) {
      onProjectChange({
        ...project,
        nodes: project.nodes.map((node) =>
          node.id === existingNode.id
            ? {
                ...node,
                parameters: { ...node.parameters, source, enabled: true },
              }
            : node,
        ),
      });
      return;
    }

    const node = createNodeFromDefinition(definition, {
      x: 120 + project.nodes.length * 18,
      y: 120 + project.nodes.length * 16,
    });
    onProjectChange({
      ...project,
      nodes: [
        ...project.nodes,
        {
          ...node,
          parameters: { ...node.parameters, source, enabled: true },
        },
      ],
    });
  }

  return (
    <aside className="tool-panel" aria-label="Gyeol">
      <PanelHeading icon={Code2} kicker="Score" title="Gyeol" />
      <div className="primary-actions">
        <button
          className={player.isPlaying ? "primary-action primary-action-on" : "primary-action"}
          disabled={score.events.length === 0 || Boolean(errors)}
          onClick={player.togglePlay}
          type="button"
        >
          {player.isPlaying ? <Square size={16} /> : <Play size={16} />}
          {player.isPlaying ? "Stop" : "Play"}
        </button>
        <button className="secondary-action" onClick={player.preload} type="button">
          <Upload size={16} />
          Preload
        </button>
        <button className="secondary-action" onClick={player.panic} type="button">
          <Square size={16} />
          Panic
        </button>
        <button className="primary-action" onClick={saveToPatch} type="button">
          <Save size={16} />
          Save Score
        </button>
        <button
          className="secondary-action"
          onClick={() => onSourceChange(defaultGyeolSource)}
          type="button"
        >
          <RotateCcw size={16} />
          Load Sample
        </button>
        <button
          className="secondary-action"
          onClick={() => onSourceChange(giantStepsGyeolSource)}
          type="button"
        >
          <RotateCcw size={16} />
          Giant Steps
        </button>
        <button
          className="secondary-action"
          onClick={() => onSourceChange(sampleStackGyeolSource)}
          type="button"
        >
          <RotateCcw size={16} />
          Sample Stack
        </button>
        <button className="secondary-action" onClick={onOpenPatch} type="button">
          <Cable size={16} />
          Patch
        </button>
      </div>
      <div className="signal-strip">
        <SignalPill label="Tempo" value={`${score.settings.bpm}`} />
        <SignalPill label="Tracks" value={`${score.tracks.length}`} />
        <SignalPill
          label="Now"
          value={
            player.activeEvent
              ? `${player.activeEvent.trackId} @ ${player.currentBeat.toFixed(2)}`
              : `${score.events.length} events`
          }
        />
      </div>
      <section className="tool-section">
        <h3>Transport</h3>
        <KnobField
          label="Master"
          max={1.5}
          min={0}
          step={0.01}
          value={player.masterGain}
          onChange={player.setMasterGain}
          valueLabel={(value) => `${Math.round(value * 100)}%`}
        />
      </section>
      <section className="tool-section">
        <h3>Source</h3>
        <textarea
          className="gyeol-editor"
          spellCheck={false}
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
        />
      </section>
      <section className="tool-section">
        <h3>Preview</h3>
        {score.events.length === 0 ? (
          <div className="empty-state">No Gyeol events generated.</div>
        ) : (
          <div className="event-list">
            {score.events.slice(0, 12).map((event, index) => (
              <div
                className={
                  player.activeEvent?.id === event.id
                    ? "event-row event-row-active"
                    : "event-row"
                }
                key={`${event.id}-${index}`}
              >
                <strong>{event.trackId}</strong>
                <span>{eventLabel(event)}</span>
                <small>{event.beat.toFixed(2)} beat</small>
                <button
                  className="icon-button"
                  onClick={() => player.triggerEvent(event)}
                  title="Preview event"
                  type="button"
                >
                  <Play size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="tool-section">
        <h3>Diagnostics</h3>
        {compiled.diagnostics.length === 0 ? (
          <div className="empty-state">No diagnostics.</div>
        ) : (
          <div className="event-list">
            {compiled.diagnostics.slice(0, 8).map((diagnostic, index) => (
              <div className="event-row" key={`${diagnostic.code}-${diagnostic.line}-${index}`}>
                <strong>{diagnostic.severity}</strong>
                <span>{diagnostic.message}</span>
                <small>{diagnostic.line}:{diagnostic.column}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <RuntimeError errors={[errors, player.error].filter(Boolean).join("\n")} />
    </aside>
  );
}

interface GyeolPlayer extends GyeolEngineState {
  error: string | null;
  play(): void;
  stop(): void;
  togglePlay(): void;
  preload(): void;
  panic(): void;
  setMasterGain(value: number): void;
  triggerEvent(event: GyeolEvent): void;
}

function useGyeolPlayer(compiled: GyeolCompileResult): GyeolPlayer {
  const engine = useMemo<GyeolEngine>(
    () => createGyeolEngine({ fallbackOnSampleFailure: true }),
    [],
  );
  const [engineState, setEngineState] = useState<GyeolEngineState>(() => engine.getState());
  const [error, setError] = useState<string | null>(null);
  const hasErrors = compiled.diagnostics.some((diagnostic) => diagnostic.severity === "error");

  useEffect(() => engine.subscribe(setEngineState), [engine]);

  useEffect(() => {
    setError(null);
    if (hasErrors) {
      engine.stop();
      return;
    }
    void engine.load(compiled.score).catch((caught: unknown) => {
      setError(errorMessage(caught, "Could not load Gyeol score."));
    });
  }, [compiled.score, engine, hasErrors]);

  useEffect(
    () => () => {
      void engine.dispose();
    },
    [engine],
  );

  function play(): void {
    if (hasErrors) {
      setError("Fix Gyeol errors before playback.");
      return;
    }
    void engine.play().catch((caught: unknown) => {
      setError(errorMessage(caught, "Could not start Gyeol playback."));
    });
  }

  function preload(): void {
    if (hasErrors) {
      setError("Fix Gyeol errors before preload.");
      return;
    }
    void engine.load(compiled.score).catch((caught: unknown) => {
      setError(errorMessage(caught, "Could not preload Gyeol score."));
    });
  }

  function triggerEvent(event: GyeolEvent): void {
    try {
      engine.trigger(event);
    } catch (caught) {
      setError(errorMessage(caught, "Could not preview Gyeol event."));
    }
  }

  function togglePlay(): void {
    if (engineState.isPlaying) {
      engine.stop();
      return;
    }
    play();
  }

  return {
    ...engineState,
    error,
    play,
    stop: engine.stop.bind(engine),
    togglePlay,
    preload,
    panic: engine.panic.bind(engine),
    setMasterGain: engine.setMasterGain.bind(engine),
    triggerEvent,
  };
}

function eventLabel(event: GyeolEvent): string {
  if (event.value.kind === "drum") {
    return event.value.name;
  }
  if (event.value.kind === "sample") {
    return event.value.sampleId;
  }
  if (event.value.kind === "note") {
    return event.value.notes.join(" ");
  }
  if (event.value.kind === "chord") {
    return event.value.name;
  }
  return event.type;
}

function MappingPanel({
  project,
  onOpenPatch,
  onProjectChange,
}: {
  project: Project;
  onOpenPatch(): void;
  onProjectChange(project: Project): void;
}) {
  const calibration = projectCalibration(project);

  function updateCamera<K extends keyof typeof calibration.camera>(
    key: K,
    value: (typeof calibration.camera)[K],
  ): void {
    onProjectChange({
      ...project,
      calibration: {
        ...calibration,
        camera: { ...calibration.camera, [key]: value },
      },
    });
  }

  function updateTracking<K extends keyof typeof calibration.tracking>(
    key: K,
    value: (typeof calibration.tracking)[K],
  ): void {
    onProjectChange({
      ...project,
      calibration: {
        ...calibration,
        tracking: { ...calibration.tracking, [key]: value },
      },
    });
  }

  function addMappingNode(type: string): void {
    const definition = findNodeDefinition(type);
    if (!definition) {
      return;
    }
    const node = createNodeFromDefinition(definition, {
      x: 180 + project.nodes.length * 18,
      y: 160 + project.nodes.length * 14,
    });
    const parameters =
      type === "core.smooth"
        ? { ...node.parameters, timeMs: calibration.tracking.smoothingMs }
        : type === "core.deadzone"
          ? { ...node.parameters, radius: calibration.tracking.deadzone }
          : type === "core.threshold"
            ? {
                ...node.parameters,
                threshold: calibration.tracking.triggerThreshold,
              }
            : node.parameters;
    onProjectChange({
      ...project,
      nodes: [...project.nodes, { ...node, parameters }],
    });
  }

  return (
    <aside className="tool-panel" aria-label="Mapping and calibration">
      <PanelHeading icon={SlidersHorizontal} kicker="Control" title="Mapping" />
      <div className="signal-grid">
        <SignalPill
          label="Mirror"
          value={calibration.camera.mirror ? "on" : "off"}
        />
        <SignalPill label="Camera" value={calibration.camera.resolution} />
        <SignalPill
          label="Hands"
          value={`${calibration.tracking.handNear.toFixed(2)}..${calibration.tracking.handFar.toFixed(2)}`}
        />
        <SignalPill
          label="Smooth"
          value={`${Math.round(calibration.tracking.smoothingMs)} ms`}
        />
      </div>
      <section className="tool-section">
        <h3>Camera</h3>
        <SelectField
          label="Mirror"
          value={calibration.camera.mirror ? "on" : "off"}
          onChange={(value) => updateCamera("mirror", value === "on")}
          options={[
            { label: "On", value: "on" },
            { label: "Off", value: "off" },
          ]}
        />
        <SelectField
          label="Resolution"
          value={calibration.camera.resolution}
          onChange={(value) => updateCamera("resolution", value)}
          options={[
            { label: "640 x 360", value: "640x360" },
            { label: "1280 x 720", value: "1280x720" },
            { label: "1920 x 1080", value: "1920x1080" },
          ]}
        />
        <SelectField
          label="FPS"
          value={String(calibration.camera.fps)}
          onChange={(value) =>
            updateCamera("fps", Number(value) as typeof calibration.camera.fps)
          }
          options={[
            { label: "24", value: "24" },
            { label: "30", value: "30" },
            { label: "60", value: "60" },
          ]}
        />
      </section>
      <section className="tool-section">
        <h3>Tracking</h3>
        <div className="field-pair">
          <NumberField
            label="Near"
            max={calibration.tracking.handFar}
            min={0.01}
            step={0.01}
            value={calibration.tracking.handNear}
            onChange={(value) => updateTracking("handNear", value)}
          />
          <NumberField
            label="Far"
            max={1.5}
            min={calibration.tracking.handNear}
            step={0.01}
            value={calibration.tracking.handFar}
            onChange={(value) => updateTracking("handFar", value)}
          />
        </div>
        <div className="field-pair">
          <NumberField
            label="Far 3D"
            max={2}
            min={calibration.tracking.handNear}
            step={0.01}
            value={calibration.tracking.handFar3d}
            onChange={(value) => updateTracking("handFar3d", value)}
          />
          <NumberField
            label="Smooth ms"
            max={2000}
            min={0}
            step={1}
            value={calibration.tracking.smoothingMs}
            onChange={(value) => updateTracking("smoothingMs", value)}
          />
        </div>
        <div className="field-pair">
          <NumberField
            label="Deadzone"
            max={0.3}
            min={0}
            step={0.005}
            value={calibration.tracking.deadzone}
            onChange={(value) => updateTracking("deadzone", value)}
          />
          <NumberField
            label="Trigger"
            max={1}
            min={0}
            step={0.01}
            value={calibration.tracking.triggerThreshold}
            onChange={(value) => updateTracking("triggerThreshold", value)}
          />
        </div>
      </section>
      <section className="tool-section">
        <h3>Patch Nodes</h3>
        <div className="primary-actions">
          {[
            ["core.normalize", "Normalize"],
            ["core.smooth", "Smooth"],
            ["core.deadzone", "Deadzone"],
            ["core.curve", "Curve"],
            ["core.threshold", "Trigger"],
            ["core.hold", "Hold"],
          ].map(([type, label]) => (
            <button
              className="secondary-action"
              key={type}
              onClick={() => addMappingNode(type)}
              type="button"
            >
              <SlidersHorizontal size={16} />
              {label}
            </button>
          ))}
        </div>
      </section>
      <button className="primary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
    </aside>
  );
}

function DrumMachinePanel({ drumMachine }: { drumMachine: DrumMachine }) {
  return (
    <aside className="tool-panel" aria-label="Drum Machine">
      <PanelHeading icon={CircleDot} kicker="Rhythm" title="Drum Machine" />
      <div className="primary-actions">
        <button
          className={drumMachine.isPlaying ? "primary-action primary-action-on" : "primary-action"}
          onClick={drumMachine.togglePlay}
          type="button"
        >
          {drumMachine.isPlaying ? <Square size={16} /> : <Play size={16} />}
          {drumMachine.isPlaying ? "Stop" : "Play"}
        </button>
        <button className="secondary-action" onClick={drumMachine.stop} type="button">
          <Square size={16} />
          Reset
        </button>
      </div>
      <div className="signal-strip">
        <SignalPill label="Tempo" value={`${drumMachine.tempo} BPM`} />
        <SignalPill
          label="Step"
          value={drumMachine.currentStep >= 0 ? `${drumMachine.currentStep + 1}/16` : "ready"}
        />
        <SignalPill
          label="Master"
          value={`${Math.round(drumMachine.masterGain * 100)}%`}
        />
      </div>
      <section className="tool-section">
        <h3>Controls</h3>
        <NumberField
          label="Tempo"
          min={40}
          max={240}
          step={1}
          value={drumMachine.tempo}
          onChange={drumMachine.setTempo}
        />
        <KnobField
          label="Master"
          max={1.5}
          min={0}
          step={0.01}
          value={drumMachine.masterGain}
          onChange={drumMachine.setMasterGain}
          valueLabel={(value) => `${Math.round(value * 100)}%`}
        />
      </section>
      <section className="tool-section">
        <h3>Pattern</h3>
        <div className="drum-grid">
          {drumMachine.tracks.map((track) => (
            <DrumTrackRow
              currentStep={drumMachine.currentStep}
              drumMachine={drumMachine}
              key={track.id}
              track={track}
            />
          ))}
        </div>
      </section>
      <RuntimeError errors={drumMachine.error ?? ""} />
    </aside>
  );
}

function DrumTrackRow({
  currentStep,
  drumMachine,
  track,
}: {
  currentStep: number;
  drumMachine: DrumMachine;
  track: DrumTrack;
}) {
  return (
    <div className="drum-track-row">
      <div className="drum-track-meta">
        <strong>{track.name}</strong>
        <span>{Math.round(track.gain * 100)}%</span>
      </div>
      <div className="drum-steps">
        {track.steps.map((step) => (
          <button
            aria-label={`${track.name} step ${step.index + 1}`}
            className={[
              "drum-step",
              step.enabled ? "drum-step-on" : "",
              currentStep === step.index ? "drum-step-current" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={step.index}
            onClick={() => drumMachine.toggleStep(track.id, step.index)}
            type="button"
          />
        ))}
      </div>
      <div className="drum-track-actions">
        <button onClick={() => drumMachine.randomizeTrack(track.id)} type="button">
          Random
        </button>
        <button onClick={() => drumMachine.clearTrack(track.id)} type="button">
          Clear
        </button>
        <label>
          <input
            checked={track.muted}
            onChange={(event) =>
              drumMachine.updateTrack(track.id, { muted: event.target.checked })
            }
            type="checkbox"
          />
          Mute
        </label>
        <label>
          <input
            checked={track.solo}
            onChange={(event) =>
              drumMachine.updateTrack(track.id, { solo: event.target.checked })
            }
            type="checkbox"
          />
          Solo
        </label>
      </div>
    </div>
  );
}

function HandTrackerPanel({
  runtime,
  onOpenPatch,
}: {
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
}) {
  const tracking = runtime.handTracking;
  return (
    <aside className="tool-panel" aria-label="Hand tracker settings">
      <PanelHeading icon={Hand} kicker="Tracker" title="Hand Tracker" />
      <div className="primary-actions">
        <button
          className={runtime.handTrackingEnabled ? "primary-action primary-action-on" : "primary-action"}
          onClick={() =>
            runtime.handTrackingEnabled
              ? runtime.stopHandTracking()
              : runtime.startHandTracking()
          }
          type="button"
        >
          <Hand size={16} />
          {runtime.handTrackingEnabled ? "Stop" : "Track"}
        </button>
        <button
          className={runtime.media.cameraEnabled ? "secondary-action secondary-action-on" : "secondary-action"}
          onClick={() => runtime.media.setCameraEnabled(!runtime.media.cameraEnabled)}
          type="button"
        >
          <Video size={16} />
          Camera
        </button>
        <OverlayToggleButton
          enabled={runtime.handOverlayEnabled}
          label="Overlay"
          onToggle={() => runtime.setHandOverlayEnabled(!runtime.handOverlayEnabled)}
        />
      </div>
      <div className="signal-grid">
        <SignalPill label="Hands" value={`${tracking.handCount}/2`} />
        <SignalPill
          label="Distance"
          value={tracking.distance === null ? "none" : tracking.distance.toFixed(2)}
        />
        <SignalPill
          label="3D"
          value={tracking.distance3d === null ? "none" : tracking.distance3d.toFixed(2)}
        />
        <SignalPill label="Close" value={`${Math.round(tracking.closeness3d * 100)}%`} />
        <SignalPill
          label="Pitch"
          value={tracking.pitchHz ? `${Math.round(tracking.pitchHz)} Hz` : "none"}
        />
      </div>
      <section className="tool-section">
        <h3>Outputs</h3>
        <OutputList
          values={[
            "hand count",
            "2D distance",
            "3D distance",
            "closeness",
            "pitch hint",
          ]}
        />
      </section>
      <button className="secondary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
      <RuntimeError errors={runtime.errors} />
    </aside>
  );
}

function FaceTrackerPanel({
  runtime,
  onOpenPatch,
}: {
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
}) {
  const tracking = runtime.faceTracking;
  return (
    <aside className="tool-panel" aria-label="Face tracker settings">
      <PanelHeading icon={ScanFace} kicker="Tracker" title="Face Tracker" />
      <div className="primary-actions">
        <button
          className={runtime.faceTrackingEnabled ? "primary-action primary-action-on" : "primary-action"}
          onClick={() =>
            runtime.faceTrackingEnabled
              ? runtime.stopFaceTracking()
              : runtime.startFaceTracking()
          }
          type="button"
        >
          <ScanFace size={16} />
          {runtime.faceTrackingEnabled ? "Stop" : "Track"}
        </button>
        <button
          className={runtime.media.cameraEnabled ? "secondary-action secondary-action-on" : "secondary-action"}
          onClick={() => runtime.media.setCameraEnabled(!runtime.media.cameraEnabled)}
          type="button"
        >
          <Video size={16} />
          Camera
        </button>
        <OverlayToggleButton
          enabled={runtime.faceOverlayEnabled}
          label="Overlay"
          onToggle={() => runtime.setFaceOverlayEnabled(!runtime.faceOverlayEnabled)}
        />
      </div>
      <div className="signal-grid">
        <SignalPill label="Faces" value={`${tracking.faceCount}`} />
        <SignalPill label="Mouth" value={`${Math.round(tracking.mouthOpen * 100)}%`} />
        <SignalPill label="Blink L" value={`${Math.round(tracking.blinkLeft * 100)}%`} />
        <SignalPill label="Blink R" value={`${Math.round(tracking.blinkRight * 100)}%`} />
        <SignalPill
          label="Head"
          value={
            tracking.headCenter
              ? `${tracking.headCenter.x.toFixed(2)}, ${tracking.headCenter.y.toFixed(2)}`
              : "none"
          }
        />
      </div>
      <section className="tool-section">
        <h3>Outputs</h3>
        <OutputList
          values={["face count", "mouth open", "left blink", "right blink", "head x/y"]}
        />
      </section>
      <button className="secondary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
      <RuntimeError errors={tracking.error ?? ""} />
    </aside>
  );
}

function PoseTrackerPanel({
  runtime,
  onOpenPatch,
}: {
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
}) {
  const tracking = runtime.poseTracking;
  return (
    <aside className="tool-panel" aria-label="Body tracker settings">
      <PanelHeading icon={PersonStanding} kicker="Tracker" title="Body Tracker" />
      <div className="primary-actions">
        <button
          className={runtime.poseTrackingEnabled ? "primary-action primary-action-on" : "primary-action"}
          onClick={() =>
            runtime.poseTrackingEnabled
              ? runtime.stopPoseTracking()
              : runtime.startPoseTracking()
          }
          type="button"
        >
          <PersonStanding size={16} />
          {runtime.poseTrackingEnabled ? "Stop" : "Track"}
        </button>
        <button
          className={runtime.media.cameraEnabled ? "secondary-action secondary-action-on" : "secondary-action"}
          onClick={() => runtime.media.setCameraEnabled(!runtime.media.cameraEnabled)}
          type="button"
        >
          <Video size={16} />
          Camera
        </button>
        <OverlayToggleButton
          enabled={runtime.poseOverlayEnabled}
          label="Overlay"
          onToggle={() => runtime.setPoseOverlayEnabled(!runtime.poseOverlayEnabled)}
        />
      </div>
      <div className="signal-grid">
        <SignalPill label="Bodies" value={`${tracking.poseCount}`} />
        <SignalPill
          label="Center"
          value={
            tracking.bodyCenter
              ? `${tracking.bodyCenter.x.toFixed(2)}, ${tracking.bodyCenter.y.toFixed(2)}`
              : "none"
          }
        />
        <SignalPill
          label="Arm Span"
          value={tracking.armSpan === null ? "none" : tracking.armSpan.toFixed(2)}
        />
        <SignalPill
          label="Shoulder"
          value={
            tracking.shoulderAngle === null
              ? "none"
              : `${Math.round(tracking.shoulderAngle)} deg`
          }
        />
        <SignalPill label="Motion" value={`${Math.round(tracking.motionEnergy * 100)}%`} />
      </div>
      <section className="tool-section">
        <h3>Outputs</h3>
        <OutputList
          values={["body center", "arm span", "shoulder angle", "motion energy"]}
        />
      </section>
      <button className="secondary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
      <RuntimeError errors={tracking.error ?? ""} />
    </aside>
  );
}

function MicrophonePanel({
  runtime,
  onOpenPatch,
}: {
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
}) {
  return (
    <aside className="tool-panel" aria-label="Microphone settings">
      <PanelHeading icon={Mic} kicker="Tracker" title="Microphone" />
      <div className="primary-actions">
        <button
          className={runtime.media.micEnabled ? "primary-action primary-action-on" : "primary-action"}
          onClick={() => runtime.media.setMicEnabled(!runtime.media.micEnabled)}
          type="button"
        >
          <Mic size={16} />
          {runtime.media.micEnabled ? "Stop" : "Listen"}
        </button>
      </div>
      <div className="signal-grid">
        <SignalPill label="Level" value={`${Math.round(runtime.media.audio.level * 100)}%`} />
        <SignalPill label="Peak" value={`${Math.round(runtime.media.audio.peak * 100)}%`} />
        <SignalPill label="Bass" value={`${Math.round(runtime.media.audio.bass * 100)}%`} />
        <SignalPill label="Treble" value={`${Math.round(runtime.media.audio.treble * 100)}%`} />
      </div>
      <section className="tool-section">
        <h3>Outputs</h3>
        <OutputList values={["level", "peak", "bass", "mid", "treble"]} />
      </section>
      <button className="secondary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
      <RuntimeError errors={runtime.errors} />
    </aside>
  );
}

function VisualPanel({
  issues,
  project,
  onOpenPatch,
  onProjectChange,
}: {
  issues: ReturnType<typeof validateProject>;
  project: Project;
  onOpenPatch(): void;
  onProjectChange(project: Project): void;
}) {
  const shaderNode = project.nodes.find((node) => node.type === "render.shader");
  const activeEffectId = readActiveEffectId(
    typeof shaderNode?.parameters.fragmentBody === "string"
      ? shaderNode.parameters.fragmentBody
      : "",
  );
  const activeGlobalEffectIds = normalizeGlobalVisualEffectIds(project.visualEffects);

  function toggleGlobalEffect(effectId: string): void {
    const nextEffectIds = activeGlobalEffectIds.includes(effectId)
      ? activeGlobalEffectIds.filter((candidate) => candidate !== effectId)
      : [...activeGlobalEffectIds, effectId];
    onProjectChange({ ...project, visualEffects: nextEffectIds });
  }

  function clearGlobalEffects(): void {
    onProjectChange({ ...project, visualEffects: [] });
  }

  function applyEffect(effectId: string): void {
    const body = `// hello-cam:effect ${effectId}`;
    if (shaderNode) {
      onProjectChange({
        ...project,
        nodes: project.nodes.map((node) =>
          node.id === shaderNode.id
            ? {
                ...node,
                parameters: { ...node.parameters, fragmentBody: body },
              }
            : node,
        ),
      });
      return;
    }

    const definition = findNodeDefinition("render.shader");
    if (!definition) {
      return;
    }
    const node = createNodeFromDefinition(definition, {
      x: 160 + project.nodes.length * 24,
      y: 140 + project.nodes.length * 18,
    });
    onProjectChange({
      ...project,
      nodes: [
        ...project.nodes,
        {
          ...node,
          parameters: { ...node.parameters, fragmentBody: body },
        },
      ],
    });
  }

  return (
    <aside className="tool-panel" aria-label="Visual settings">
      <PanelHeading icon={Sparkles} kicker="Output" title="Visual Patch" />
      <div className="signal-grid">
        <SignalPill label="Graph" value={issues.length === 0 ? "valid" : `${issues.length} issues`} />
        <SignalPill label="Effects" value={`${activeGlobalEffectIds.length}`} />
      </div>
      <section className="tool-section">
        <h3>Surface</h3>
        <OutputList values={["camera texture", "shader texture", "fullscreen canvas", "recording"]} />
      </section>
      <section className="tool-section">
        <div className="section-title-row">
          <h3>Global Effects</h3>
          <div className="inline-actions">
            <button
              disabled={activeGlobalEffectIds.length === 0}
              onClick={clearGlobalEffects}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="effect-preset-grid effect-preset-grid-compact">
          {globalVisualEffectPresets.map((preset) => {
            const active = activeGlobalEffectIds.includes(preset.id);
            return (
              <button
                aria-pressed={active}
                className={
                  active
                    ? "effect-preset effect-preset-active"
                    : "effect-preset"
                }
                key={preset.id}
                onClick={() => toggleGlobalEffect(preset.id)}
                type="button"
              >
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="tool-section">
        <h3>Patch Presets</h3>
        <div className="effect-preset-grid">
          {patchVisualEffectPresets.map((preset) => (
            <button
              className={
                preset.id === activeEffectId
                  ? "effect-preset effect-preset-active"
                  : "effect-preset"
              }
              key={preset.id}
              onClick={() => applyEffect(preset.id)}
              type="button"
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>
      <button className="primary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
    </aside>
  );
}

function readActiveEffectId(fragmentBody: string): string | null {
  const firstLine = fragmentBody.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return firstLine.match(/^\/\/\s*hello-cam:effect\s+([a-z0-9-]+)\s*$/i)?.[1] ?? null;
}

function PerformancePanel({
  issues,
  loopStation,
  runtime,
  onOpenPatch,
}: {
  issues: ReturnType<typeof validateProject>;
  loopStation: LoopStation;
  runtime: InteractiveRuntime;
  onOpenPatch(): void;
}) {
  return (
    <aside className="tool-panel performance-panel" aria-label="Performance status">
      <PanelHeading icon={MonitorPlay} kicker="Stage" title="Performance" />
      <div className="signal-grid">
        <SignalPill label="Camera" value={runtime.media.video ? "on" : "off"} />
        <SignalPill label="Hands" value={`${runtime.handTracking.handCount}/2`} />
        <SignalPill
          label="Loops"
          value={`${loopStation.clips.filter((clip) => clip.playing).length}/${loopStation.clips.length}`}
        />
        <SignalPill
          label="Pitch"
          value={runtime.theremin.frequency ? `${Math.round(runtime.theremin.frequency)} Hz` : "off"}
        />
        <SignalPill label="Keys" value={`${runtime.handKeyboard.activeCount}/10`} />
        <SignalPill label="Graph" value={issues.length === 0 ? "valid" : `${issues.length}`} />
      </div>
      <button className="secondary-action wide-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Open Patch
      </button>
      <RuntimeError errors={runtime.errors} />
    </aside>
  );
}

function PanelHeading({
  icon: Icon,
  kicker,
  title,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
}) {
  return (
    <div className="tool-panel-heading">
      <Icon size={22} />
      <div>
        <span>{kicker}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function PanelFooter({
  onOpenPatch,
  onPerform,
}: {
  onOpenPatch(): void;
  onPerform(): void;
}) {
  return (
    <div className="panel-footer">
      <button className="secondary-action" onClick={onOpenPatch} type="button">
        <Cable size={16} />
        Patch
      </button>
      <button className="primary-action" onClick={onPerform} type="button">
        <MonitorPlay size={16} />
        Done
      </button>
    </div>
  );
}

function SignalPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="signal-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OverlayToggleButton({
  enabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  label: string;
  onToggle(): void;
}) {
  return (
    <button
      className={enabled ? "secondary-action secondary-action-on" : "secondary-action"}
      onClick={onToggle}
      type="button"
    >
      {enabled ? <Eye size={16} /> : <EyeOff size={16} />}
      {label}
    </button>
  );
}

function RuntimeError({ errors }: { errors: string }) {
  return errors ? <div className="tool-error">{errors}</div> : null;
}

function OutputList({ values }: { values: string[] }) {
  return (
    <div className="output-list">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function SelectField<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: T): void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <label className="composer-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange(value: number): void;
  step: number;
  value: number;
}) {
  return (
    <label className="composer-field">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function KnobField({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueLabel = formatControlValue,
}: {
  label: string;
  max: number;
  min: number;
  onChange(value: number): void;
  step: number;
  value: number;
  valueLabel?(value: number): string;
}) {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + ratio * 270;
  return (
    <label className="knob-field">
      <span>{label}</span>
      <div
        className="knob-dial"
        style={
          {
            "--knob-angle": `${angle}deg`,
            "--knob-fill": `${ratio * 75}%`,
        } as CSSProperties
        }
      >
        <input
          aria-label={label}
          max={max}
          min={min}
          step={step}
          type="range"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <strong>{valueLabel(value)}</strong>
    </label>
  );
}

function formatControlValue(value: number): string {
  return value >= 10 ? Math.round(value).toString() : value.toFixed(2);
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function formatClipDuration(clip: LoopClip): string {
  return `${Math.max(0, clip.endSec - clip.startSec).toFixed(2)}s`;
}

function OutputOnlyApp() {
  const [project, setProject] = useState<Project>(() => {
    const local = localStorage.getItem("hello-cam-last-project");
    if (!local) {
      return createDefaultProject();
    }
    try {
      return parseProjectJson(local);
    } catch {
      return createDefaultProject();
    }
  });
  const runtime = useInteractiveRuntime(projectCalibration(project));

  useEffect(() => {
    const bridge = getBridge();
    return bridge?.onOutputProject((nextProject) => {
      setProject(nextProject);
      localStorage.setItem("hello-cam-last-project", serializeProject(nextProject));
    });
  }, []);

  return (
    <main className="output-shell">
      <VisualRuntime
        outputOnly
        project={project}
        renderPipeline="graph"
        runtime={runtime}
      />
    </main>
  );
}
