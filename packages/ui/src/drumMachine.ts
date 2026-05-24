import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { getSharedAudioBus, type AudioBusChannel } from "./audioBus";

export type DrumVoiceType = "kick" | "snare" | "hat" | "clap";

export interface DrumStep {
  index: number;
  enabled: boolean;
  velocity: number;
}

export interface DrumTrack {
  id: string;
  name: string;
  voice: DrumVoiceType;
  sampleName: string | null;
  steps: DrumStep[];
  gain: number;
  muted: boolean;
  solo: boolean;
}

export type DrumTrackPatch = Partial<Omit<DrumTrack, "id">>;

export interface DrumMachineState {
  isPlaying: boolean;
  tempo: number;
  currentStep: number;
  tracks: DrumTrack[];
  masterGain: number;
  error: string | null;
}

export interface DrumMachineActions {
  play(): void;
  stop(): void;
  togglePlay(): void;
  setTempo(value: number): void;
  toggleStep(trackId: string, stepIndex: number): void;
  clearTrack(trackId: string): void;
  randomizeTrack(trackId: string): void;
  updateTrack(trackId: string, patch: DrumTrackPatch): void;
  setMasterGain(value: number): void;
}

export type DrumMachine = DrumMachineState & DrumMachineActions;

export interface UseDrumMachineOptions {
  tempo?: number;
  tracks?: DrumTrack[];
  masterGain?: number;
}

interface DrumMachineAudioGraph {
  context: AudioContext;
  channel: AudioBusChannel;
  masterGain: GainNode;
  noiseBuffer: AudioBuffer;
}

const drumStepCount = 16;
const defaultTempo = 120;
const minimumTempo = 40;
const maximumTempo = 240;
const defaultMasterGain = 0.85;
const minimumGain = 0;
const maximumGain = 1.5;
const schedulerLookaheadMs = 25;
const scheduleAheadSeconds = 0.11;
const startDelaySeconds = 0.05;

export function createDefaultDrumTracks(): DrumTrack[] {
  return [
    createTrack("kick", "Kick", "kick", "x---x---x---x---", 0.9),
    createTrack("snare", "Snare", "snare", "----x-------x---", 0.74),
    createTrack("hat", "Hat", "hat", "x-x-x-x-x-x-x-x-", 0.38),
    createTrack("clap", "Clap", "clap", "------------x---", 0.56),
  ];
}

export const defaultDrumTracks = createDefaultDrumTracks();

export function useDrumMachine(
  options: UseDrumMachineOptions = {},
): DrumMachine {
  const initialState = createInitialState(options);
  const [state, setState] = useState<DrumMachineState>(initialState);

  const graphRef = useRef<DrumMachineAudioGraph | null>(null);
  const mountedRef = useRef(true);
  const nextNoteTimeRef = useRef(0);
  const nextStepRef = useRef(0);
  const schedulerTimerRef = useRef<number | null>(null);
  const stateRef = useRef<DrumMachineState>(initialState);
  const uiTimerRefs = useRef<number[]>([]);

  const commitState = useCallback(
    (updater: SetStateAction<DrumMachineState>): void => {
      if (!mountedRef.current) {
        return;
      }

      const nextState = resolveStateAction(updater, stateRef.current);
      stateRef.current = nextState;
      setState(nextState);
    },
    [],
  );

  const setError = useCallback(
    (error: string | null): void => {
      commitState((current) => ({ ...current, error }));
    },
    [commitState],
  );

  const applyMasterGain = useCallback((value: number): void => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.masterGain.gain.setTargetAtTime(
      clampGain(value),
      graph.context.currentTime,
      0.01,
    );
  }, []);

  const ensureGraph = useCallback((): DrumMachineAudioGraph | null => {
    if (graphRef.current) {
      return graphRef.current;
    }

    try {
      const graph = createAudioGraph(stateRef.current.masterGain);
      graphRef.current = graph;
      return graph;
    } catch (caught) {
      setError(errorMessage(caught, "Could not create Drum Machine audio graph."));
      return null;
    }
  }, [setError]);

  const clearScheduler = useCallback((): void => {
    if (schedulerTimerRef.current !== null) {
      window.clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }

    for (const timer of uiTimerRefs.current) {
      window.clearTimeout(timer);
    }
    uiTimerRefs.current = [];
  }, []);

  const scheduleUiStep = useCallback(
    (stepIndex: number, time: number, context: AudioContext): void => {
      const delayMs = Math.max(0, (time - context.currentTime) * 1000);
      const timer = window.setTimeout(() => {
        uiTimerRefs.current = uiTimerRefs.current.filter(
          (candidate) => candidate !== timer,
        );

        if (!stateRef.current.isPlaying) {
          return;
        }

        commitState((current) => ({ ...current, currentStep: stepIndex }));
      }, delayMs);

      uiTimerRefs.current.push(timer);
    },
    [commitState],
  );

  const scheduler = useCallback((): void => {
    const graph = graphRef.current;
    if (!graph || !stateRef.current.isPlaying) {
      return;
    }

    while (nextNoteTimeRef.current < graph.context.currentTime + scheduleAheadSeconds) {
      const stepIndex = nextStepRef.current;
      const current = stateRef.current;

      scheduleStep(graph, current.tracks, stepIndex, nextNoteTimeRef.current);
      scheduleUiStep(stepIndex, nextNoteTimeRef.current, graph.context);

      nextNoteTimeRef.current += secondsPerSixteenth(current.tempo);
      nextStepRef.current = (stepIndex + 1) % drumStepCount;
    }
  }, [scheduleUiStep]);

  const stop = useCallback((): void => {
    clearScheduler();
    commitState((current) => ({
      ...current,
      isPlaying: false,
      currentStep: -1,
    }));
  }, [clearScheduler, commitState]);

  const play = useCallback((): void => {
    if (stateRef.current.isPlaying) {
      return;
    }

    const graph = ensureGraph();
    if (!graph) {
      return;
    }

    void graph.context
      .resume()
      .then(() => {
        if (!mountedRef.current) {
          return;
        }

        clearScheduler();
        nextStepRef.current = 0;
        nextNoteTimeRef.current = graph.context.currentTime + startDelaySeconds;
        applyMasterGain(stateRef.current.masterGain);
        commitState((current) => ({
          ...current,
          isPlaying: true,
          currentStep: -1,
          error: null,
        }));
        scheduler();
        schedulerTimerRef.current = window.setInterval(
          scheduler,
          schedulerLookaheadMs,
        );
      })
      .catch((caught: unknown) => {
        setError(errorMessage(caught, "Could not start Drum Machine audio."));
      });
  }, [applyMasterGain, clearScheduler, commitState, ensureGraph, scheduler, setError]);

  const togglePlay = useCallback((): void => {
    if (stateRef.current.isPlaying) {
      stop();
      return;
    }

    play();
  }, [play, stop]);

  const setTempo = useCallback(
    (value: number): void => {
      commitState((current) => ({
        ...current,
        tempo: clampNumber(value, minimumTempo, maximumTempo, defaultTempo),
      }));
    },
    [commitState],
  );

  const toggleStep = useCallback(
    (trackId: string, stepIndex: number): void => {
      const normalizedIndex = wrapStepIndex(stepIndex);
      commitState((current) => ({
        ...current,
        tracks: current.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                steps: track.steps.map((step) =>
                  step.index === normalizedIndex
                    ? { ...step, enabled: !step.enabled }
                    : step,
                ),
              }
            : track,
        ),
      }));
    },
    [commitState],
  );

  const clearTrack = useCallback(
    (trackId: string): void => {
      commitState((current) => ({
        ...current,
        tracks: current.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                steps: track.steps.map((step) => ({ ...step, enabled: false })),
              }
            : track,
        ),
      }));
    },
    [commitState],
  );

  const randomizeTrack = useCallback(
    (trackId: string): void => {
      commitState((current) => ({
        ...current,
        tracks: current.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                steps: randomizeSteps(track.voice),
              }
            : track,
        ),
      }));
    },
    [commitState],
  );

  const updateTrack = useCallback(
    (trackId: string, patch: DrumTrackPatch): void => {
      commitState((current) => ({
        ...current,
        tracks: current.tracks.map((track) =>
          track.id === trackId
            ? normalizeTrack({
                ...track,
                ...patch,
                id: track.id,
                steps: patch.steps ?? track.steps,
              })
            : track,
        ),
      }));
    },
    [commitState],
  );

  const setMasterGain = useCallback(
    (value: number): void => {
      const nextMasterGain = clampGain(value);
      applyMasterGain(nextMasterGain);
      commitState((current) => ({
        ...current,
        masterGain: nextMasterGain,
      }));
    },
    [applyMasterGain, commitState],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearScheduler();

      const graph = graphRef.current;
      graphRef.current = null;
      if (graph) {
        graph.masterGain.disconnect();
        graph.channel.disconnect();
      }
    };
  }, [clearScheduler]);

  return {
    ...state,
    play,
    stop,
    togglePlay,
    setTempo,
    toggleStep,
    clearTrack,
    randomizeTrack,
    updateTrack,
    setMasterGain,
  };
}

function createInitialState(options: UseDrumMachineOptions): DrumMachineState {
  return {
    isPlaying: false,
    tempo: clampNumber(options.tempo ?? defaultTempo, minimumTempo, maximumTempo, defaultTempo),
    currentStep: -1,
    tracks: cloneTracks(options.tracks ?? defaultDrumTracks),
    masterGain: clampGain(options.masterGain ?? defaultMasterGain),
    error: null,
  };
}

function resolveStateAction(
  action: SetStateAction<DrumMachineState>,
  current: DrumMachineState,
): DrumMachineState {
  if (typeof action === "function") {
    return action(current);
  }

  return action;
}

function createAudioGraph(masterGainValue: number): DrumMachineAudioGraph {
  const bus = getSharedAudioBus();
  const context = bus.context;
  const channel = bus.createChannel({ lane: "performance" });
  const masterGain = context.createGain();
  masterGain.gain.value = clampGain(masterGainValue);
  masterGain.connect(channel.input);

  return {
    context,
    channel,
    masterGain,
    noiseBuffer: createNoiseBuffer(context),
  };
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

function createTrack(
  id: string,
  name: string,
  voice: DrumVoiceType,
  pattern: string,
  gain: number,
): DrumTrack {
  return {
    id,
    name,
    voice,
    sampleName: null,
    steps: stepsFromPattern(pattern),
    gain,
    muted: false,
    solo: false,
  };
}

function stepsFromPattern(pattern: string): DrumStep[] {
  const cleanedPattern = pattern.replace(/\s/g, "");

  return Array.from({ length: drumStepCount }, (_, index) => {
    const marker = cleanedPattern[index] ?? "-";
    return {
      index,
      enabled: marker.toLowerCase() === "x",
      velocity: 1,
    };
  });
}

function cloneTracks(tracks: DrumTrack[]): DrumTrack[] {
  return tracks.map((track) => normalizeTrack(track));
}

function normalizeTrack(track: DrumTrack): DrumTrack {
  return {
    ...track,
    name: track.name.trim() || track.id,
    sampleName: track.sampleName?.trim() || null,
    gain: clampGain(track.gain),
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    steps: normalizeSteps(track.steps),
  };
}

function normalizeSteps(steps: DrumStep[]): DrumStep[] {
  return Array.from({ length: drumStepCount }, (_, index) => {
    const step = steps[index] ?? steps.find((candidate) => candidate.index === index);
    return {
      index,
      enabled: Boolean(step?.enabled),
      velocity: clampNumber(step?.velocity ?? 1, 0, 1.5, 1),
    };
  });
}

function randomizeSteps(voice: DrumVoiceType): DrumStep[] {
  const density = densityForVoice(voice);
  return Array.from({ length: drumStepCount }, (_, index) => {
    const enabled = Math.random() < density;
    return {
      index,
      enabled,
      velocity: enabled ? clampNumber(0.62 + Math.random() * 0.38, 0, 1.5, 1) : 1,
    };
  });
}

function densityForVoice(voice: DrumVoiceType): number {
  switch (voice) {
    case "kick":
      return 0.28;
    case "snare":
      return 0.18;
    case "hat":
      return 0.62;
    case "clap":
      return 0.14;
  }
}

function scheduleStep(
  graph: DrumMachineAudioGraph,
  tracks: DrumTrack[],
  stepIndex: number,
  time: number,
): void {
  const hasSolo = tracks.some((track) => track.solo);

  for (const track of tracks) {
    if (!isTrackAudible(track, hasSolo)) {
      continue;
    }

    const step = track.steps[stepIndex];
    if (!step?.enabled) {
      continue;
    }

    const gain = clampGain(track.gain) * clampNumber(step.velocity, 0, 1.5, 1);
    if (gain <= 0) {
      continue;
    }

    scheduleVoice(graph, track.voice, time, gain);
  }
}

function isTrackAudible(track: DrumTrack, hasSolo: boolean): boolean {
  if (track.muted) {
    return false;
  }

  return !hasSolo || track.solo;
}

function scheduleVoice(
  graph: DrumMachineAudioGraph,
  voice: DrumVoiceType,
  time: number,
  gain: number,
): void {
  switch (voice) {
    case "kick":
      scheduleKick(graph, time, gain);
      return;
    case "snare":
      scheduleSnare(graph, time, gain);
      return;
    case "hat":
      scheduleHat(graph, time, gain);
      return;
    case "clap":
      scheduleClap(graph, time, gain);
      return;
  }
}

function scheduleKick(
  graph: DrumMachineAudioGraph,
  time: number,
  gainAmount: number,
): void {
  const oscillator = graph.context.createOscillator();
  const gain = graph.context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(155, time);
  oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.13);
  oscillator.frequency.exponentialRampToValueAtTime(38, time + 0.32);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainAmount, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.36);

  oscillator.connect(gain);
  gain.connect(graph.masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.38);
}

function scheduleSnare(
  graph: DrumMachineAudioGraph,
  time: number,
  gainAmount: number,
): void {
  scheduleNoiseBurst(graph, time, 0.17, gainAmount * 0.72, "highpass", 1150);

  const oscillator = graph.context.createOscillator();
  const gain = graph.context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(185, time);
  gain.gain.setValueAtTime(gainAmount * 0.16, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

  oscillator.connect(gain);
  gain.connect(graph.masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.14);
}

function scheduleHat(
  graph: DrumMachineAudioGraph,
  time: number,
  gainAmount: number,
): void {
  scheduleNoiseBurst(graph, time, 0.055, gainAmount * 0.42, "highpass", 7000);
}

function scheduleClap(
  graph: DrumMachineAudioGraph,
  time: number,
  gainAmount: number,
): void {
  const offsets = [0, 0.018, 0.036, 0.072];
  for (const offset of offsets) {
    scheduleNoiseBurst(
      graph,
      time + offset,
      offset > 0.05 ? 0.13 : 0.052,
      gainAmount * 0.34,
      "bandpass",
      1600,
    );
  }
}

function scheduleNoiseBurst(
  graph: DrumMachineAudioGraph,
  time: number,
  duration: number,
  gainAmount: number,
  filterType: BiquadFilterType,
  frequency: number,
): void {
  const source = graph.context.createBufferSource();
  const filter = graph.context.createBiquadFilter();
  const gain = graph.context.createGain();

  source.buffer = graph.noiseBuffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, time);
  filter.Q.setValueAtTime(filterType === "bandpass" ? 1.2 : 0.7, time);

  gain.gain.setValueAtTime(Math.max(0.0001, gainAmount), time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(graph.masterGain);
  source.start(time);
  source.stop(time + duration + 0.01);
}

function secondsPerSixteenth(tempo: number): number {
  return 15 / clampNumber(tempo, minimumTempo, maximumTempo, defaultTempo);
}

function wrapStepIndex(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) {
    return 0;
  }

  return ((Math.trunc(stepIndex) % drumStepCount) + drumStepCount) % drumStepCount;
}

function clampGain(value: number): number {
  return clampNumber(value, minimumGain, maximumGain, defaultMasterGain);
}

function clampNumber(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}
