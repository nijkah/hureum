import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSharedAudioBus, type AudioBusChannel } from "./audioBus";
import type { HandTrackingState } from "./handTracking";

type BuiltInOscillatorType = Exclude<OscillatorType, "custom">;

export type HandKeyboardInstrumentId = "piano" | "organ" | "pad" | "pluck";
export type HandKeyboardScale = "major" | "minor" | "pentatonic" | "chromatic";
export type HandKeyboardOrder = "leftToRight" | "tracker";

export interface HandKeyboardSettings {
  instrument: HandKeyboardInstrumentId;
  scale: HandKeyboardScale;
  rootMidiNote: number;
  volume: number;
  tone: number;
  pressThreshold: number;
  releaseThreshold: number;
  velocityCurve: number;
  handOrder: HandKeyboardOrder;
}

export interface HandKeyboardKeyState {
  id: string;
  label: string;
  noteName: string;
  midiNote: number;
  bend: number;
  velocity: number;
  pressed: boolean;
  visible: boolean;
}

export interface HandKeyboardState {
  active: boolean;
  keys: HandKeyboardKeyState[];
  activeNotes: string[];
  activeCount: number;
  error: string | null;
  prime(): void;
}

interface HandKeyboardGraph {
  context: AudioContext;
  channel: AudioBusChannel;
  masterGain: GainNode;
  voice: HandKeyboardVoice;
  instrument: HandKeyboardInstrumentId;
}

interface HandKeyboardVoice {
  noteOn(event: HandKeyboardNoteEvent): void;
  noteOff(keyId: string): void;
  updateNote(event: HandKeyboardNoteEvent): void;
  releaseAll(): void;
  dispose(): void;
}

interface HandKeyboardNoteEvent {
  keyId: string;
  midiNote: number;
  frequency: number;
  velocity: number;
  bend: number;
  tone: number;
}

interface PressedKeyRecord {
  midiNote: number;
}

interface FingerBendDetector {
  base: number;
  joint: number;
  tip: number;
  straightAngle: number;
  bentAngle: number;
}

interface FingerDefinition extends FingerBendDetector {
  id: string;
  label: string;
  extraBends?: FingerBendDetector[];
  sensitivity?: number;
}

interface HandSlot {
  hand: NormalizedLandmark[];
  sourceIndex: number;
  x: number;
}

interface SynthPartial {
  waveform: BuiltInOscillatorType;
  frequencyRatio: number;
  gain: number;
  detuneCents?: number;
}

interface SynthInstrumentSpec {
  id: HandKeyboardInstrumentId;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  maxVoiceGain: number;
  pressureGain: number;
  filterType: BiquadFilterType;
  filterQ: number;
  filterMinHz: number;
  filterMaxHz: number;
  filterVelocityBoost: number;
  partials: SynthPartial[];
}

interface ActiveSynthNote {
  keyId: string;
  midiNote: number;
  startedAt: number;
  output: GainNode;
  filter: BiquadFilterNode;
  oscillators: OscillatorNode[];
  partialGains: GainNode[];
  cleanupTimer: number | null;
}

const fingerDefinitions: FingerDefinition[] = [
  {
    id: "thumb",
    label: "Thumb",
    base: 1,
    joint: 2,
    tip: 4,
    straightAngle: 158,
    bentAngle: 104,
    extraBends: [
      {
        base: 0,
        joint: 1,
        tip: 2,
        straightAngle: 146,
        bentAngle: 104,
      },
      {
        base: 1,
        joint: 2,
        tip: 3,
        straightAngle: 168,
        bentAngle: 120,
      },
    ],
    sensitivity: 1.14,
  },
  {
    id: "index",
    label: "Index",
    base: 5,
    joint: 6,
    tip: 8,
    straightAngle: 171,
    bentAngle: 96,
  },
  {
    id: "middle",
    label: "Middle",
    base: 9,
    joint: 10,
    tip: 12,
    straightAngle: 171,
    bentAngle: 96,
  },
  {
    id: "ring",
    label: "Ring",
    base: 13,
    joint: 14,
    tip: 16,
    straightAngle: 171,
    bentAngle: 96,
  },
  {
    id: "pinky",
    label: "Pinky",
    base: 17,
    joint: 18,
    tip: 20,
    straightAngle: 169,
    bentAngle: 120,
    sensitivity: 1.12,
  },
];

const scaleIntervals: Record<HandKeyboardScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const instrumentSpecs: Record<HandKeyboardInstrumentId, SynthInstrumentSpec> = {
  piano: {
    id: "piano",
    attack: 0.006,
    decay: 0.26,
    sustain: 0.34,
    release: 0.2,
    maxVoiceGain: 0.12,
    pressureGain: 0.18,
    filterType: "lowpass",
    filterQ: 0.9,
    filterMinHz: 1250,
    filterMaxHz: 7200,
    filterVelocityBoost: 0.55,
    partials: [
      { waveform: "triangle", frequencyRatio: 1, gain: 1 },
      { waveform: "sine", frequencyRatio: 2, gain: 0.34, detuneCents: 1.2 },
      { waveform: "sine", frequencyRatio: 3, gain: 0.13, detuneCents: -2.5 },
    ],
  },
  organ: {
    id: "organ",
    attack: 0.012,
    decay: 0.035,
    sustain: 0.92,
    release: 0.08,
    maxVoiceGain: 0.085,
    pressureGain: 0.42,
    filterType: "lowpass",
    filterQ: 0.42,
    filterMinHz: 950,
    filterMaxHz: 8200,
    filterVelocityBoost: 0.35,
    partials: [
      { waveform: "sine", frequencyRatio: 1, gain: 1 },
      { waveform: "sine", frequencyRatio: 2, gain: 0.52 },
      { waveform: "square", frequencyRatio: 1, gain: 0.18 },
    ],
  },
  pad: {
    id: "pad",
    attack: 0.18,
    decay: 0.32,
    sustain: 0.76,
    release: 0.62,
    maxVoiceGain: 0.072,
    pressureGain: 0.58,
    filterType: "lowpass",
    filterQ: 1.1,
    filterMinHz: 620,
    filterMaxHz: 5400,
    filterVelocityBoost: 0.7,
    partials: [
      { waveform: "sawtooth", frequencyRatio: 1, gain: 0.48, detuneCents: -5 },
      { waveform: "sawtooth", frequencyRatio: 1, gain: 0.48, detuneCents: 5 },
      { waveform: "triangle", frequencyRatio: 0.5, gain: 0.2 },
    ],
  },
  pluck: {
    id: "pluck",
    attack: 0.004,
    decay: 0.18,
    sustain: 0.08,
    release: 0.12,
    maxVoiceGain: 0.11,
    pressureGain: 0.08,
    filterType: "bandpass",
    filterQ: 1.65,
    filterMinHz: 1300,
    filterMaxHz: 9200,
    filterVelocityBoost: 0.9,
    partials: [
      { waveform: "triangle", frequencyRatio: 1, gain: 0.88 },
      { waveform: "sine", frequencyRatio: 2.01, gain: 0.22 },
    ],
  },
};

export const handKeyboardInstrumentOptions: Array<{
  label: string;
  value: HandKeyboardInstrumentId;
}> = [
  { label: "Piano", value: "piano" },
  { label: "Organ", value: "organ" },
  { label: "Pad", value: "pad" },
  { label: "Pluck", value: "pluck" },
];

export const handKeyboardScaleOptions: Array<{
  label: string;
  value: HandKeyboardScale;
}> = [
  { label: "Major", value: "major" },
  { label: "Minor", value: "minor" },
  { label: "Pentatonic", value: "pentatonic" },
  { label: "Chromatic", value: "chromatic" },
];

export const handKeyboardOrderOptions: Array<{
  label: string;
  value: HandKeyboardOrder;
}> = [
  { label: "Left to right", value: "leftToRight" },
  { label: "Tracker order", value: "tracker" },
];

export const defaultHandKeyboardSettings: HandKeyboardSettings = {
  instrument: "piano",
  scale: "major",
  rootMidiNote: 60,
  volume: 0.58,
  tone: 0.62,
  pressThreshold: 0.62,
  releaseThreshold: 0.38,
  velocityCurve: 1.25,
  handOrder: "leftToRight",
};

export function useHandKeyboard(
  enabled: boolean,
  tracking: HandTrackingState,
  settings: HandKeyboardSettings = defaultHandKeyboardSettings,
): HandKeyboardState {
  const graphRef = useRef<HandKeyboardGraph | null>(null);
  const pressedKeysRef = useRef<Map<string, PressedKeyRecord>>(new Map());
  const settingsRef = useRef(settings);
  const [state, setState] = useState<HandKeyboardState>(() => ({
    active: false,
    keys: createKeyboardKeys(null, defaultHandKeyboardSettings),
    activeNotes: [],
    activeCount: 0,
    error: null,
    prime: () => undefined,
  }));

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const prime = useCallback((): void => {
    try {
      const nextGraph = ensureGraph(graphRef.current, settingsRef.current);
      graphRef.current = nextGraph;
      void nextGraph.context.resume();
      setState((current) => ({ ...current, error: null }));
    } catch (caught) {
      setState((current) => ({
        ...current,
        active: false,
        activeCount: 0,
        activeNotes: [],
        error:
          caught instanceof Error ? caught.message : "Could not start Air Keyboard.",
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      closeGraph(graphRef.current);
      graphRef.current = null;
      pressedKeysRef.current.clear();
      setState({
        active: false,
        keys: createKeyboardKeys(null, settings),
        activeNotes: [],
        activeCount: 0,
        error: null,
        prime,
      });
      return;
    }

    prime();

    return () => {
      closeGraph(graphRef.current);
      graphRef.current = null;
      pressedKeysRef.current.clear();
    };
  }, [enabled, prime]);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({
        ...current,
        keys: createKeyboardKeys(null, settings),
        prime,
      }));
      return;
    }

    let graph: HandKeyboardGraph;
    try {
      const instrumentChanged =
        graphRef.current !== null &&
        graphRef.current.instrument !== settings.instrument;
      graph = ensureGraph(graphRef.current, settings);
      graphRef.current = graph;
      if (instrumentChanged) {
        pressedKeysRef.current.clear();
      }
      graph.masterGain.gain.setTargetAtTime(
        normalizeSettings(settings).volume,
        graph.context.currentTime,
        0.02,
      );
    } catch (caught) {
      setState((current) => ({
        ...current,
        active: false,
        activeCount: 0,
        activeNotes: [],
        error:
          caught instanceof Error ? caught.message : "Could not update Air Keyboard.",
        prime,
      }));
      return;
    }

    const nextState = reconcileKeyboardState(
      graph,
      tracking,
      settings,
      pressedKeysRef.current,
    );
    setState({
      ...nextState,
      error: null,
      prime,
    });
  }, [enabled, prime, settings, tracking.handCount, tracking.hands]);

  return { ...state, prime };
}

function ensureGraph(
  current: HandKeyboardGraph | null,
  settings: HandKeyboardSettings,
): HandKeyboardGraph {
  const normalized = normalizeSettings(settings);
  if (current && current.instrument === normalized.instrument) {
    return current;
  }

  if (current) {
    current.voice.releaseAll();
    current.voice.dispose();
  }

  const bus = getSharedAudioBus();
  const context = bus.context;
  const channel = current?.channel ?? bus.createChannel({ lane: "performance" });
  const masterGain = current?.masterGain ?? context.createGain();

  if (!current) {
    masterGain.connect(channel.input);
  }
  masterGain.gain.value = normalized.volume;

  return {
    context,
    channel,
    masterGain,
    voice: new SynthInstrumentVoice(
      context,
      masterGain,
      instrumentSpecs[normalized.instrument],
    ),
    instrument: normalized.instrument,
  };
}

function closeGraph(graph: HandKeyboardGraph | null): void {
  if (!graph) {
    return;
  }
  graph.voice.releaseAll();
  graph.voice.dispose();
  graph.masterGain.disconnect();
  graph.channel.disconnect();
}

function reconcileKeyboardState(
  graph: HandKeyboardGraph,
  tracking: HandTrackingState,
  settings: HandKeyboardSettings,
  pressedKeys: Map<string, PressedKeyRecord>,
): Omit<HandKeyboardState, "error" | "prime"> {
  const normalized = normalizeSettings(settings);
  const keys = createKeyboardKeys(tracking, normalized);
  const activeNotes: string[] = [];

  for (const key of keys) {
    const previous = pressedKeys.get(key.id);
    const wasPressed = previous !== undefined;
    const event = noteEventFromKey(key, normalized);

    if (wasPressed) {
      if (!key.visible || key.bend <= normalized.releaseThreshold) {
        graph.voice.noteOff(key.id);
        pressedKeys.delete(key.id);
        key.pressed = false;
      } else if (previous.midiNote !== key.midiNote) {
        graph.voice.noteOff(key.id);
        graph.voice.noteOn(event);
        pressedKeys.set(key.id, { midiNote: key.midiNote });
        key.pressed = true;
      } else {
        graph.voice.updateNote(event);
        key.pressed = true;
      }
    } else if (key.visible && key.bend >= normalized.pressThreshold) {
      graph.voice.noteOn(event);
      pressedKeys.set(key.id, { midiNote: key.midiNote });
      key.pressed = true;
    } else {
      key.pressed = false;
    }

    if (key.pressed) {
      activeNotes.push(key.noteName);
    }
  }

  const liveKeyIds = new Set(keys.map((key) => key.id));
  for (const keyId of Array.from(pressedKeys.keys())) {
    if (!liveKeyIds.has(keyId)) {
      graph.voice.noteOff(keyId);
      pressedKeys.delete(keyId);
    }
  }

  return {
    active: activeNotes.length > 0,
    keys,
    activeNotes,
    activeCount: activeNotes.length,
  };
}

function createKeyboardKeys(
  tracking: HandTrackingState | null,
  settings: HandKeyboardSettings,
): HandKeyboardKeyState[] {
  const normalized = normalizeSettings(settings);
  const hands = resolveHandSlots(tracking, normalized.handOrder);
  const keys: HandKeyboardKeyState[] = [];

  for (let handSlot = 0; handSlot < 2; handSlot += 1) {
    const slot = hands[handSlot] ?? null;
    for (let fingerIndex = 0; fingerIndex < fingerDefinitions.length; fingerIndex += 1) {
      const finger = fingerDefinitions[fingerIndex];
      const keyIndex = handSlot * fingerDefinitions.length + fingerIndex;
      const midiNote = midiNoteForKey(keyIndex, normalized);
      const bend = slot ? fingerBend(slot.hand, finger) : 0;
      const velocity = velocityFromBend(bend, normalized);

      keys.push({
        id: `hand-${handSlot}-${finger.id}`,
        label: `H${handSlot + 1} ${finger.label}`,
        noteName: midiNoteToNoteName(midiNote),
        midiNote,
        bend,
        velocity,
        pressed: false,
        visible: Boolean(slot),
      });
    }
  }

  return keys;
}

function resolveHandSlots(
  tracking: HandTrackingState | null,
  order: HandKeyboardOrder,
): HandSlot[] {
  const hands = tracking?.hands ?? [];
  const slots = hands.slice(0, 2).map((hand, sourceIndex) => ({
    hand,
    sourceIndex,
    x: palmCenter(hand).x,
  }));

  if (order === "leftToRight") {
    return slots.sort((first, second) => first.x - second.x);
  }

  return slots.sort((first, second) => first.sourceIndex - second.sourceIndex);
}

function fingerBend(
  hand: NormalizedLandmark[],
  finger: FingerDefinition,
): number {
  const detectors = [finger, ...(finger.extraBends ?? [])];
  const bend = Math.max(
    0,
    ...detectors.map((detector) => detectorBend(hand, detector)),
  );

  return clamp(bend * (finger.sensitivity ?? 1), 0, 1);
}

function detectorBend(
  hand: NormalizedLandmark[],
  detector: FingerBendDetector,
): number {
  const base = hand[detector.base];
  const joint = hand[detector.joint];
  const tip = hand[detector.tip];
  if (!base || !joint || !tip) {
    return 0;
  }

  const angle = angleAtJoint(base, joint, tip);
  return clamp(
    (detector.straightAngle - angle) /
      (detector.straightAngle - detector.bentAngle),
    0,
    1,
  );
}

function angleAtJoint(
  first: NormalizedLandmark,
  joint: NormalizedLandmark,
  second: NormalizedLandmark,
): number {
  const firstVector = {
    x: first.x - joint.x,
    y: first.y - joint.y,
    z: (first.z ?? 0) - (joint.z ?? 0),
  };
  const secondVector = {
    x: second.x - joint.x,
    y: second.y - joint.y,
    z: (second.z ?? 0) - (joint.z ?? 0),
  };
  const dot =
    firstVector.x * secondVector.x +
    firstVector.y * secondVector.y +
    firstVector.z * secondVector.z;
  const firstLength = Math.hypot(firstVector.x, firstVector.y, firstVector.z);
  const secondLength = Math.hypot(secondVector.x, secondVector.y, secondVector.z);
  if (firstLength <= 0 || secondLength <= 0) {
    return 180;
  }

  return (
    Math.acos(clamp(dot / (firstLength * secondLength), -1, 1)) *
    (180 / Math.PI)
  );
}

function palmCenter(hand: NormalizedLandmark[]): { x: number; y: number } {
  const indices = [0, 5, 9, 13, 17];
  const points = indices
    .map((index) => hand[index])
    .filter((point): point is NormalizedLandmark => Boolean(point));
  if (points.length === 0) {
    return { x: 0.5, y: 0.5 };
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function noteEventFromKey(
  key: HandKeyboardKeyState,
  settings: HandKeyboardSettings,
): HandKeyboardNoteEvent {
  return {
    keyId: key.id,
    midiNote: key.midiNote,
    frequency: midiNoteToFrequency(key.midiNote),
    velocity: key.velocity,
    bend: key.bend,
    tone: settings.tone,
  };
}

function midiNoteForKey(index: number, settings: HandKeyboardSettings): number {
  const intervals = scaleIntervals[settings.scale];
  const octave = Math.floor(index / intervals.length);
  const interval = intervals[index % intervals.length] ?? 0;
  return settings.rootMidiNote + octave * 12 + interval;
}

function midiNoteToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

function midiNoteToNoteName(midiNote: number): string {
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const octave = Math.floor(midiNote / 12) - 1;
  return `${noteNames[((midiNote % 12) + 12) % 12]}${octave}`;
}

function velocityFromBend(
  bend: number,
  settings: HandKeyboardSettings,
): number {
  const pressure = clamp(
    (bend - settings.releaseThreshold) /
      Math.max(0.001, 1 - settings.releaseThreshold),
    0,
    1,
  );
  return clamp(0.28 + 0.72 * pressure ** settings.velocityCurve, 0, 1);
}

function normalizeSettings(settings: HandKeyboardSettings): HandKeyboardSettings {
  const pressThreshold = clampFinite(settings.pressThreshold, 0.05, 0.98, 0.62);
  const releaseThreshold = clampFinite(
    settings.releaseThreshold,
    0,
    Math.max(0, pressThreshold - 0.03),
    Math.min(0.38, pressThreshold - 0.03),
  );
  const instrument = instrumentSpecs[settings.instrument]
    ? settings.instrument
    : defaultHandKeyboardSettings.instrument;
  const scale = scaleIntervals[settings.scale]
    ? settings.scale
    : defaultHandKeyboardSettings.scale;
  const handOrder =
    settings.handOrder === "tracker" ? "tracker" : defaultHandKeyboardSettings.handOrder;

  return {
    instrument,
    scale,
    rootMidiNote: Math.round(
      clampFinite(settings.rootMidiNote, 36, 84, defaultHandKeyboardSettings.rootMidiNote),
    ),
    volume: clampFinite(settings.volume, 0, 1.2, defaultHandKeyboardSettings.volume),
    tone: clampFinite(settings.tone, 0, 1, defaultHandKeyboardSettings.tone),
    pressThreshold,
    releaseThreshold,
    velocityCurve: clampFinite(
      settings.velocityCurve,
      0.35,
      3,
      defaultHandKeyboardSettings.velocityCurve,
    ),
    handOrder,
  };
}

class SynthInstrumentVoice implements HandKeyboardVoice {
  private readonly activeNotes = new Map<string, ActiveSynthNote>();

  private readonly notes = new Set<ActiveSynthNote>();

  private readonly cleanupTimers = new Set<number>();

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
    private readonly spec: SynthInstrumentSpec,
  ) {}

  noteOn(event: HandKeyboardNoteEvent): void {
    this.noteOff(event.keyId);

    const now = this.context.currentTime;
    const output = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const oscillators: OscillatorNode[] = [];
    const partialGains: GainNode[] = [];
    const peakGain = this.peakGain(event);
    const attackTime = now + Math.max(0.001, this.spec.attack);

    filter.type = this.spec.filterType;
    filter.Q.value = this.spec.filterQ;
    filter.frequency.setValueAtTime(this.filterFrequency(event), now);
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), attackTime);
    output.gain.setTargetAtTime(
      Math.max(0.0001, this.sustainGain(event)),
      attackTime,
      Math.max(0.001, this.spec.decay),
    );

    for (const partial of this.spec.partials) {
      const oscillator = this.context.createOscillator();
      const partialGain = this.context.createGain();
      oscillator.type = partial.waveform;
      oscillator.frequency.value = event.frequency * partial.frequencyRatio;
      oscillator.detune.value = partial.detuneCents ?? 0;
      partialGain.gain.value = partial.gain;
      oscillator.connect(partialGain);
      partialGain.connect(filter);
      oscillator.start(now);
      oscillators.push(oscillator);
      partialGains.push(partialGain);
    }

    filter.connect(output);
    output.connect(this.output);

    const note: ActiveSynthNote = {
      keyId: event.keyId,
      midiNote: event.midiNote,
      startedAt: now,
      output,
      filter,
      oscillators,
      partialGains,
      cleanupTimer: null,
    };
    this.activeNotes.set(event.keyId, note);
    this.notes.add(note);
  }

  noteOff(keyId: string): void {
    const note = this.activeNotes.get(keyId);
    if (!note) {
      return;
    }

    this.activeNotes.delete(keyId);
    const now = this.context.currentTime;
    const release = Math.max(0.02, this.spec.release);
    note.output.gain.cancelScheduledValues(now);
    note.output.gain.setTargetAtTime(0.0001, now, release / 3);

    for (const oscillator of note.oscillators) {
      try {
        oscillator.stop(now + release + 0.04);
      } catch {
        // Oscillators can already be stopping when a setting change races note off.
      }
    }

    const cleanupTimer = window.setTimeout(() => {
      this.cleanupTimers.delete(cleanupTimer);
      this.disposeNote(note);
    }, (release + 0.08) * 1000);
    note.cleanupTimer = cleanupTimer;
    this.cleanupTimers.add(cleanupTimer);
  }

  updateNote(event: HandKeyboardNoteEvent): void {
    const note = this.activeNotes.get(event.keyId);
    if (!note || note.midiNote !== event.midiNote) {
      return;
    }

    const now = this.context.currentTime;
    const age = now - note.startedAt;
    note.filter.frequency.setTargetAtTime(this.filterFrequency(event), now, 0.04);

    if (age > this.spec.attack + this.spec.decay * 0.45) {
      note.output.gain.setTargetAtTime(this.sustainGain(event), now, 0.045);
    }
  }

  releaseAll(): void {
    for (const keyId of Array.from(this.activeNotes.keys())) {
      this.noteOff(keyId);
    }
  }

  dispose(): void {
    for (const timer of this.cleanupTimers) {
      window.clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    for (const note of Array.from(this.notes)) {
      for (const oscillator of note.oscillators) {
        try {
          oscillator.stop();
        } catch {
          // The oscillator may have already stopped during normal release.
        }
      }
      this.disposeNote(note);
    }
    this.activeNotes.clear();
  }

  private peakGain(event: HandKeyboardNoteEvent): number {
    return Math.max(0.0001, this.spec.maxVoiceGain * clamp(event.velocity, 0, 1));
  }

  private sustainGain(event: HandKeyboardNoteEvent): number {
    const pressure = clamp(event.velocity, 0, 1);
    const pressureScale =
      1 - this.spec.pressureGain + this.spec.pressureGain * pressure;
    return Math.max(0.0001, this.peakGain(event) * this.spec.sustain * pressureScale);
  }

  private filterFrequency(event: HandKeyboardNoteEvent): number {
    const tone = clamp(event.tone, 0, 1);
    const toneFrequency =
      this.spec.filterMinHz *
      (this.spec.filterMaxHz / this.spec.filterMinHz) ** tone;
    return clamp(
      toneFrequency * (1 + event.velocity * this.spec.filterVelocityBoost),
      80,
      14000,
    );
  }

  private disposeNote(note: ActiveSynthNote): void {
    if (note.cleanupTimer !== null) {
      window.clearTimeout(note.cleanupTimer);
      this.cleanupTimers.delete(note.cleanupTimer);
      note.cleanupTimer = null;
    }

    for (const oscillator of note.oscillators) {
      oscillator.disconnect();
    }
    for (const partialGain of note.partialGains) {
      partialGain.disconnect();
    }
    note.filter.disconnect();
    note.output.disconnect();
    this.notes.delete(note);
  }
}

function clampFinite(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return clamp(value, minimum, maximum);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
