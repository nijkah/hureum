import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { getSharedAudioBus, type AudioBusChannel } from "./audioBus";

export interface LoopClip {
  id: string;
  name: string;
  bufferId: string;
  startSec: number;
  endSec: number;
  loop: boolean;
  gain: number;
  muted: boolean;
  solo: boolean;
  playing: boolean;
}

export type LoopClipPatch = Partial<
  Omit<LoopClip, "id" | "bufferId" | "playing">
>;

export interface LoopStationState {
  clips: LoopClip[];
  masterGain: number;
  error: string | null;
  copiedClip: LoopClip | null;
  isAudioReady: boolean;
}

export interface LoopStationActions {
  importFiles(files: FileList | File[]): Promise<void>;
  playClip(id: string): void;
  stopClip(id: string): void;
  toggleClip(id: string): void;
  stopAll(): void;
  updateClip(id: string, patch: LoopClipPatch): void;
  duplicateClip(id: string): string | null;
  copyClip(id: string): void;
  pasteClip(): string | null;
  deleteClip(id: string): void;
  setMasterGain(value: number): void;
}

export type LoopStation = LoopStationState & LoopStationActions;

interface LoopStationAudioGraph {
  context: AudioContext;
  channel: AudioBusChannel;
  masterGain: GainNode;
}

interface ActivePlayback {
  source: AudioBufferSourceNode;
  gain: GainNode;
  token: number;
}

interface ClipRange {
  startSec: number;
  endSec: number;
  durationSec: number;
}

const defaultMasterGain = 0.85;
const minimumClipDurationSec = 0.001;

let nextLoopStationId = 0;

export function useLoopStation(): LoopStation {
  const [state, setState] = useState<LoopStationState>({
    clips: [],
    masterGain: defaultMasterGain,
    error: null,
    copiedClip: null,
    isAudioReady: false,
  });

  const activeRef = useRef<Map<string, ActivePlayback>>(new Map());
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const clipboardRef = useRef<LoopClip | null>(null);
  const clipsRef = useRef<LoopClip[]>([]);
  const graphRef = useRef<LoopStationAudioGraph | null>(null);
  const masterGainRef = useRef(defaultMasterGain);
  const mountedRef = useRef(true);
  const playbackTokenRef = useRef(0);

  const setStateIfMounted = useCallback(
    (updater: SetStateAction<LoopStationState>): void => {
      if (mountedRef.current) {
        setState(updater);
      }
    },
    [],
  );

  const setError = useCallback(
    (error: string | null): void => {
      setStateIfMounted((current) => ({ ...current, error }));
    },
    [setStateIfMounted],
  );

  const commitClips = useCallback(
    (clips: LoopClip[], error?: string | null): void => {
      clipsRef.current = clips;
      setStateIfMounted((current) => ({
        ...current,
        clips,
        error: error === undefined ? current.error : error,
      }));
    },
    [setStateIfMounted],
  );

  const ensureGraph = useCallback((): LoopStationAudioGraph | null => {
    if (graphRef.current) {
      return graphRef.current;
    }

    try {
      const graph = createLoopStationAudioGraph(masterGainRef.current);
      graphRef.current = graph;
      setStateIfMounted((current) => ({
        ...current,
        error: null,
        isAudioReady: true,
      }));
      return graph;
    } catch (caught) {
      setError(errorMessage(caught, "Could not create Loop Station audio graph."));
      return null;
    }
  }, [setError, setStateIfMounted]);

  const resumeGraph = useCallback(
    async (graph: LoopStationAudioGraph): Promise<boolean> => {
      try {
        if (graph.context.state === "suspended") {
          await graph.context.resume();
        }
        return true;
      } catch (caught) {
        setError(errorMessage(caught, "Could not resume Loop Station audio."));
        return false;
      }
    },
    [setError],
  );

  const stopActivePlayback = useCallback((id: string): void => {
    const active = activeRef.current.get(id);
    if (!active) {
      return;
    }

    activeRef.current.delete(id);
    disposeActivePlayback(active, true);
  }, []);

  const setClipPlaying = useCallback(
    (id: string, playing: boolean): void => {
      const clips = clipsRef.current.map((clip) =>
        clip.id === id && clip.playing !== playing ? { ...clip, playing } : clip,
      );
      commitClips(clips);
    },
    [commitClips],
  );

  const applyActiveGains = useCallback((clips = clipsRef.current): void => {
    const hasSolo = clips.some((clip) => clip.solo);
    for (const clip of clips) {
      const active = activeRef.current.get(clip.id);
      if (!active) {
        continue;
      }

      active.gain.gain.setTargetAtTime(
        audibleClipGain(clip, hasSolo),
        active.gain.context.currentTime,
        0.012,
      );
    }
  }, []);

  const startPlayback = useCallback(
    async (id: string): Promise<void> => {
      const clip = clipsRef.current.find((candidate) => candidate.id === id);
      if (!clip) {
        setError("Clip not found.");
        return;
      }

      const buffer = buffersRef.current.get(clip.bufferId);
      if (!buffer) {
        setError(`Audio buffer is not available for "${clip.name}".`);
        setClipPlaying(id, false);
        return;
      }

      const graph = ensureGraph();
      if (!graph) {
        setClipPlaying(id, false);
        return;
      }

      if (!(await resumeGraph(graph))) {
        setClipPlaying(id, false);
        return;
      }

      stopActivePlayback(id);

      const range = clipRange(clip, buffer);
      const source = graph.context.createBufferSource();
      const gain = graph.context.createGain();
      const hasSolo = clipsRef.current.some((candidate) => candidate.solo);
      const token = playbackTokenRef.current + 1;

      playbackTokenRef.current = token;
      source.buffer = buffer;
      source.loop = clip.loop;
      source.loopStart = range.startSec;
      source.loopEnd = range.endSec;
      gain.gain.value = audibleClipGain(clip, hasSolo);

      source.onended = () => {
        const current = activeRef.current.get(id);
        if (!current || current.token !== token) {
          return;
        }

        activeRef.current.delete(id);
        disposeActivePlayback(current, false);
        setClipPlaying(id, false);
      };

      try {
        source.connect(gain);
        gain.connect(graph.masterGain);
        activeRef.current.set(id, { source, gain, token });
        if (clip.loop) {
          source.start(0, range.startSec);
        } else {
          source.start(0, range.startSec, range.durationSec);
        }
        setClipPlaying(id, true);
        setError(null);
      } catch (caught) {
        activeRef.current.delete(id);
        disposeActivePlayback({ source, gain, token }, true);
        setClipPlaying(id, false);
        setError(errorMessage(caught, `Could not play "${clip.name}".`));
      }
    },
    [
      applyActiveGains,
      ensureGraph,
      resumeGraph,
      setClipPlaying,
      setError,
      stopActivePlayback,
    ],
  );

  const importFiles = useCallback(
    async (files: FileList | File[]): Promise<void> => {
      const selectedFiles = Array.from(files);
      if (selectedFiles.length === 0) {
        setError("No audio files selected.");
        return;
      }

      const graph = ensureGraph();
      if (!graph) {
        return;
      }

      if (!(await resumeGraph(graph))) {
        return;
      }

      const importedClips: LoopClip[] = [];
      const failures: string[] = [];

      for (const file of selectedFiles) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = await graph.context.decodeAudioData(arrayBuffer);
          const bufferId = createLoopStationId("buffer");
          buffersRef.current.set(bufferId, buffer);
          importedClips.push(createClipFromBuffer(file.name, bufferId, buffer));
        } catch (caught) {
          failures.push(
            `${file.name}: ${errorMessage(caught, "Could not decode audio file.")}`,
          );
        }
      }

      if (!mountedRef.current) {
        return;
      }

      if (importedClips.length === 0) {
        setError(
          failures.length > 0
            ? failures.join("\n")
            : "No audio files could be imported.",
        );
        return;
      }

      const error =
        failures.length > 0
          ? `Imported ${importedClips.length} file(s), but some failed:\n${failures.join(
              "\n",
            )}`
          : null;
      commitClips([...clipsRef.current, ...importedClips], error);
    },
    [commitClips, ensureGraph, resumeGraph, setError],
  );

  const playClip = useCallback(
    (id: string): void => {
      void startPlayback(id);
    },
    [startPlayback],
  );

  const stopClip = useCallback(
    (id: string): void => {
      const clip = clipsRef.current.find((candidate) => candidate.id === id);
      if (!clip) {
        setError("Clip not found.");
        return;
      }

      stopActivePlayback(id);
      setClipPlaying(id, false);
      setError(null);
    },
    [setClipPlaying, setError, stopActivePlayback],
  );

  const toggleClip = useCallback(
    (id: string): void => {
      const clip = clipsRef.current.find((candidate) => candidate.id === id);
      if (!clip) {
        setError("Clip not found.");
        return;
      }

      if (clip.playing || activeRef.current.has(id)) {
        stopClip(id);
        return;
      }

      void startPlayback(id);
    },
    [setError, startPlayback, stopClip],
  );

  const stopAll = useCallback((): void => {
    for (const id of activeRef.current.keys()) {
      stopActivePlayback(id);
    }

    commitClips(
      clipsRef.current.map((clip) =>
        clip.playing ? { ...clip, playing: false } : clip,
      ),
      null,
    );
  }, [commitClips, stopActivePlayback]);

  const updateClip = useCallback(
    (id: string, patch: LoopClipPatch): void => {
      const clips = clipsRef.current;
      const index = clips.findIndex((clip) => clip.id === id);
      if (index < 0) {
        setError("Clip not found.");
        return;
      }

      const previous = clips[index];
      const buffer = buffersRef.current.get(previous.bufferId);
      const nextClip = normalizeLoopClip(
        {
          ...previous,
          ...patch,
          id: previous.id,
          bufferId: previous.bufferId,
          playing: previous.playing,
        },
        buffer?.duration,
      );
      const nextClips = replaceClip(clips, index, nextClip);
      const shouldRestart =
        previous.playing &&
        (previous.startSec !== nextClip.startSec ||
          previous.endSec !== nextClip.endSec ||
          previous.loop !== nextClip.loop);

      commitClips(nextClips, null);

      if (shouldRestart) {
        void startPlayback(id);
        return;
      }

      applyActiveGains(nextClips);
    },
    [applyActiveGains, commitClips, setError, startPlayback],
  );

  const duplicateClip = useCallback(
    (id: string): string | null => {
      const clip = clipsRef.current.find((candidate) => candidate.id === id);
      if (!clip) {
        setError("Clip not found.");
        return null;
      }

      const duplicatedClip = normalizeLoopClip(
        {
          ...clip,
          id: createLoopStationId("clip"),
          name: copyName(clip.name),
          playing: false,
        },
        buffersRef.current.get(clip.bufferId)?.duration,
      );
      commitClips([...clipsRef.current, duplicatedClip], null);
      return duplicatedClip.id;
    },
    [commitClips, setError],
  );

  const copyClip = useCallback(
    (id: string): void => {
      const clip = clipsRef.current.find((candidate) => candidate.id === id);
      if (!clip) {
        setError("Clip not found.");
        return;
      }

      const copiedClip = { ...clip, playing: false };
      clipboardRef.current = copiedClip;
      setStateIfMounted((current) => ({
        ...current,
        copiedClip,
        error: null,
      }));
    },
    [setError, setStateIfMounted],
  );

  const pasteClip = useCallback((): string | null => {
    const copiedClip = clipboardRef.current;
    if (!copiedClip) {
      setError("No copied clip is available.");
      return null;
    }

    if (!buffersRef.current.has(copiedClip.bufferId)) {
      setError(`Audio buffer is not available for "${copiedClip.name}".`);
      return null;
    }

    const pastedClip = normalizeLoopClip(
      {
        ...copiedClip,
        id: createLoopStationId("clip"),
        name: copyName(copiedClip.name),
        playing: false,
      },
      buffersRef.current.get(copiedClip.bufferId)?.duration,
    );
    commitClips([...clipsRef.current, pastedClip], null);
    return pastedClip.id;
  }, [commitClips, setError]);

  const deleteClip = useCallback(
    (id: string): void => {
      const clip = clipsRef.current.find((candidate) => candidate.id === id);
      if (!clip) {
        setError("Clip not found.");
        return;
      }

      stopActivePlayback(id);
      commitClips(
        clipsRef.current.filter((candidate) => candidate.id !== id),
        null,
      );
    },
    [commitClips, setError, stopActivePlayback],
  );

  const setMasterGain = useCallback(
    (value: number): void => {
      const gain = clampFinite(value, 0, 1.5);
      masterGainRef.current = gain;

      const graph = graphRef.current;
      if (graph) {
        graph.masterGain.gain.setTargetAtTime(
          gain,
          graph.context.currentTime,
          0.012,
        );
      }

      setStateIfMounted((current) => ({
        ...current,
        masterGain: gain,
        error: null,
      }));
    },
    [setStateIfMounted],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      for (const active of activeRef.current.values()) {
        disposeActivePlayback(active, true);
      }
      activeRef.current.clear();
      buffersRef.current.clear();
      clipboardRef.current = null;
      clipsRef.current = [];

      const graph = graphRef.current;
      graphRef.current = null;
      if (graph) {
        graph.masterGain.disconnect();
        graph.channel.disconnect();
      }
    };
  }, []);

  return useMemo(
    () => ({
      ...state,
      importFiles,
      playClip,
      stopClip,
      toggleClip,
      stopAll,
      updateClip,
      duplicateClip,
      copyClip,
      pasteClip,
      deleteClip,
      setMasterGain,
    }),
    [
      copyClip,
      deleteClip,
      duplicateClip,
      importFiles,
      pasteClip,
      playClip,
      setMasterGain,
      state,
      stopAll,
      stopClip,
      toggleClip,
      updateClip,
    ],
  );
}

function createLoopStationAudioGraph(masterGainValue: number): LoopStationAudioGraph {
  const bus = getSharedAudioBus();
  const context = bus.context;
  const channel = bus.createChannel({ lane: "performance" });
  const masterGain = context.createGain();
  masterGain.gain.value = clampFinite(masterGainValue, 0, 1.5);
  masterGain.connect(channel.input);
  return { context, channel, masterGain };
}

function createClipFromBuffer(
  fileName: string,
  bufferId: string,
  buffer: AudioBuffer,
): LoopClip {
  return normalizeLoopClip(
    {
      id: createLoopStationId("clip"),
      name: clipNameFromFile(fileName),
      bufferId,
      startSec: 0,
      endSec: buffer.duration,
      loop: true,
      gain: 0.85,
      muted: false,
      solo: false,
      playing: false,
    },
    buffer.duration,
  );
}

function normalizeLoopClip(clip: LoopClip, bufferDuration?: number): LoopClip {
  const durationLimit = Math.max(
    minimumClipDurationSec,
    Number.isFinite(bufferDuration) && bufferDuration !== undefined
      ? bufferDuration
      : Math.max(clip.endSec, clip.startSec + minimumClipDurationSec),
  );
  const maxStartSec = Math.max(0, durationLimit - minimumClipDurationSec);
  const startSec = clampFinite(clip.startSec, 0, maxStartSec);
  const endSec = clampFinite(
    clip.endSec,
    startSec + minimumClipDurationSec,
    durationLimit,
  );

  return {
    ...clip,
    name: normalizeClipName(clip.name),
    startSec,
    endSec,
    loop: Boolean(clip.loop),
    gain: clampFinite(clip.gain, 0, 2),
    muted: Boolean(clip.muted),
    solo: Boolean(clip.solo),
    playing: Boolean(clip.playing),
  };
}

function clipRange(clip: LoopClip, buffer: AudioBuffer): ClipRange {
  const durationLimit = Math.max(minimumClipDurationSec, buffer.duration);
  const maxStartSec = Math.max(0, durationLimit - minimumClipDurationSec);
  const startSec = clampFinite(clip.startSec, 0, maxStartSec);
  const endSec = clampFinite(
    clip.endSec,
    startSec + minimumClipDurationSec,
    durationLimit,
  );

  return {
    startSec,
    endSec,
    durationSec: Math.max(minimumClipDurationSec, endSec - startSec),
  };
}

function audibleClipGain(clip: LoopClip, hasSolo: boolean): number {
  if (clip.muted || (hasSolo && !clip.solo)) {
    return 0;
  }
  return clampFinite(clip.gain, 0, 2);
}

function replaceClip(
  clips: LoopClip[],
  index: number,
  replacement: LoopClip,
): LoopClip[] {
  return clips.map((clip, clipIndex) =>
    clipIndex === index ? replacement : clip,
  );
}

function disposeActivePlayback(active: ActivePlayback, stopSource: boolean): void {
  active.source.onended = null;
  if (stopSource) {
    try {
      active.source.stop();
    } catch {
      // AudioBufferSourceNode.stop() throws when the source has already ended.
    }
  }

  try {
    active.source.disconnect();
  } catch {
    // Disconnect is best-effort during cleanup.
  }

  try {
    active.gain.disconnect();
  } catch {
    // Disconnect is best-effort during cleanup.
  }
}

function createLoopStationId(prefix: string): string {
  nextLoopStationId += 1;
  return `${prefix}_${Date.now().toString(36)}_${nextLoopStationId.toString(36)}`;
}

function clipNameFromFile(fileName: string): string {
  return normalizeClipName(fileName.replace(/\.[a-z0-9]{1,8}$/i, ""));
}

function normalizeClipName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "Untitled Clip";
}

function copyName(name: string): string {
  return `${normalizeClipName(name)} Copy`;
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message.length > 0
    ? caught.message
    : fallback;
}
