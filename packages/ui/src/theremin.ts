import { useCallback, useEffect, useRef, useState } from "react";
import { getSharedAudioBus, type AudioBusChannel } from "./audioBus";
import type { HandTrackingState } from "./handTracking";

export type ThereminBuiltInWaveform = "sine" | "triangle" | "sawtooth" | "square";
export type ThereminWaveform = ThereminBuiltInWaveform | "custom";
export type ThereminPitchSource =
  | "handDistance"
  | "handDistance3d"
  | "firstHandHeight"
  | "secondHandHeight";
export type ThereminPitchMode = "continuous" | "chromatic";

export const customWaveformPointCount = 32;

export interface ThereminSettings {
  pitchSource: ThereminPitchSource;
  pitchMode: ThereminPitchMode;
  concertA: number;
  waveform: ThereminWaveform;
  customWaveform: number[];
  minHz: number;
  maxHz: number;
  volume: number;
  glide: number;
  tone: number;
  delayMix: number;
  delayTime: number;
  delayFeedback: number;
  reverbMix: number;
}

export const defaultThereminSettings: ThereminSettings = {
  pitchSource: "handDistance",
  pitchMode: "continuous",
  concertA: 440,
  waveform: "sine",
  customWaveform: createBuiltinWaveformSamples("sine"),
  minHz: 110,
  maxHz: 880,
  volume: 0.14,
  glide: 0.045,
  tone: 0.52,
  delayMix: 0.08,
  delayTime: 0.18,
  delayFeedback: 0.18,
  reverbMix: 0.05,
};

interface ThereminAudioGraph {
  context: AudioContext;
  channel: AudioBusChannel;
  oscillator: OscillatorNode;
  filter: BiquadFilterNode;
  dryGain: GainNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayGain: GainNode;
  reverb: ConvolverNode;
  reverbGain: GainNode;
  masterGain: GainNode;
  waveformKey: string | null;
}

export interface ThereminState {
  active: boolean;
  frequency: number | null;
  noteName: string | null;
  gain: number;
  error: string | null;
  prime(): void;
}

export function useTransparentTheremin(
  enabled: boolean,
  tracking: HandTrackingState,
  settings: ThereminSettings = defaultThereminSettings,
): ThereminState {
  const graphRef = useRef<ThereminAudioGraph | null>(null);
  const [state, setState] = useState<ThereminState>({
    active: false,
    frequency: null,
    noteName: null,
    gain: 0,
    error: null,
    prime: () => undefined,
  });

  const prime = useCallback((): void => {
    try {
      graphRef.current = graphRef.current ?? createGraph();
      void graphRef.current.context.resume();
      setState((current) => ({ ...current, error: null }));
    } catch (caught) {
      setState((current) => ({
        ...current,
        active: false,
        frequency: null,
        noteName: null,
        gain: 0,
        error: caught instanceof Error ? caught.message : "Could not start theremin.",
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      closeGraph(graphRef.current);
      graphRef.current = null;
      setState({
        active: false,
        frequency: null,
        noteName: null,
        gain: 0,
        error: null,
        prime,
      });
      return;
    }

    prime();

    return () => {
      closeGraph(graphRef.current);
      graphRef.current = null;
    };
  }, [enabled, prime]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!enabled || !graph) {
      return;
    }

    const now = graph.context.currentTime;
    const pitchSignal = pitchSignalFromTracking(tracking, settings.pitchSource);
    const hasSignal = pitchSignal !== null;
    const targetFrequency = frequencyFromSignal(pitchSignal ?? 0, settings);
    const noteName = frequencyToNoteName(targetFrequency, settings.concertA);
    const targetGain = hasSignal ? clamp(settings.volume, 0, 0.6) : 0.0001;
    const smoothing = clamp(settings.glide, 0.005, 0.4);
    const tone = clamp(settings.tone, 0, 1);

    applyOscillatorWaveform(graph, settings);
    graph.oscillator.frequency.setTargetAtTime(targetFrequency, now, smoothing);
    graph.filter.frequency.setTargetAtTime(600 + tone * 7600, now, smoothing);
    graph.dryGain.gain.setTargetAtTime(
      targetGain * (1 - clamp(settings.delayMix + settings.reverbMix, 0, 0.85)),
      now,
      0.06,
    );
    graph.masterGain.gain.setTargetAtTime(hasSignal ? 1 : 0.0001, now, 0.08);
    graph.delay.delayTime.setTargetAtTime(
      clamp(settings.delayTime, 0.01, 1.2),
      now,
      0.04,
    );
    graph.delayGain.gain.setTargetAtTime(
      targetGain * clamp(settings.delayMix, 0, 0.85),
      now,
      0.06,
    );
    graph.delayFeedback.gain.setTargetAtTime(
      clamp(settings.delayFeedback, 0, 0.86),
      now,
      0.06,
    );
    graph.reverbGain.gain.setTargetAtTime(
      targetGain * clamp(settings.reverbMix, 0, 0.85),
      now,
      0.08,
    );

    setState({
      active: hasSignal,
      frequency: hasSignal ? targetFrequency : null,
      noteName: hasSignal ? noteName : null,
      gain: targetGain,
      error: null,
      prime,
    });
  }, [
    enabled,
    prime,
    settings,
    tracking.closeness,
    tracking.closeness3d,
    tracking.handCount,
    tracking.hands,
  ]);

  return { ...state, prime };
}

function createGraph(): ThereminAudioGraph {
  const bus = getSharedAudioBus();
  const context = bus.context;
  const channel = bus.createChannel({ lane: "performance" });
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const dryGain = context.createGain();
  const delay = context.createDelay(1.2);
  const delayFeedback = context.createGain();
  const delayGain = context.createGain();
  const reverb = context.createConvolver();
  const reverbGain = context.createGain();
  const masterGain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 110;
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.45;
  dryGain.gain.value = 0.0001;
  delay.delayTime.value = 0.18;
  delayFeedback.gain.value = 0.18;
  delayGain.gain.value = 0;
  reverb.buffer = createImpulseResponse(context);
  reverbGain.gain.value = 0;
  masterGain.gain.value = 0.0001;

  oscillator.connect(filter);
  filter.connect(dryGain);
  filter.connect(delay);
  filter.connect(reverb);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(delayGain);
  reverb.connect(reverbGain);
  dryGain.connect(masterGain);
  delayGain.connect(masterGain);
  reverbGain.connect(masterGain);
  masterGain.connect(channel.input);
  oscillator.start();

  return {
    context,
    channel,
    oscillator,
    filter,
    dryGain,
    delay,
    delayFeedback,
    delayGain,
    reverb,
    reverbGain,
    masterGain,
    waveformKey: null,
  };
}

function closeGraph(graph: ThereminAudioGraph | null): void {
  if (!graph) {
    return;
  }
  graph.oscillator.stop();
  graph.oscillator.disconnect();
  graph.filter.disconnect();
  graph.dryGain.disconnect();
  graph.delay.disconnect();
  graph.delayFeedback.disconnect();
  graph.delayGain.disconnect();
  graph.reverb.disconnect();
  graph.reverbGain.disconnect();
  graph.masterGain.disconnect();
  graph.channel.disconnect();
}

function pitchSignalFromTracking(
  tracking: HandTrackingState,
  source: ThereminPitchSource,
): number | null {
  if (source === "handDistance") {
    return tracking.handCount >= 2 ? tracking.closeness : null;
  }
  if (source === "handDistance3d") {
    return tracking.handCount >= 2 ? tracking.closeness3d : null;
  }
  const handIndex = source === "firstHandHeight" ? 0 : 1;
  const hand = tracking.hands[handIndex];
  if (!hand) {
    return null;
  }
  const wrist = hand[0];
  return wrist ? 1 - clamp(wrist.y, 0, 1) : null;
}

function frequencyFromSignal(signal: number, settings: ThereminSettings): number {
  const minHz = Math.max(20, Math.min(settings.minHz, settings.maxHz));
  const maxHz = Math.min(12000, Math.max(settings.minHz, settings.maxHz));
  const normalized = clamp(signal, 0, 1);
  const frequency = minHz * (maxHz / minHz) ** normalized;
  if (settings.pitchMode === "chromatic") {
    return quantizeFrequencyToChromatic(frequency, settings.concertA);
  }
  return frequency;
}

export function quantizeFrequencyToChromatic(
  frequency: number,
  concertA = 440,
): number {
  const midiNote = frequencyToMidiNote(frequency, concertA);
  return midiNoteToFrequency(Math.round(midiNote), concertA);
}

export function frequencyToNoteName(frequency: number, concertA = 440): string {
  const midiNote = Math.round(frequencyToMidiNote(frequency, concertA));
  const octave = Math.floor(midiNote / 12) - 1;
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
  return `${noteNames[((midiNote % 12) + 12) % 12]}${octave}`;
}

function frequencyToMidiNote(frequency: number, concertA = 440): number {
  const safeFrequency = Math.max(1, frequency);
  const safeConcertA = clamp(concertA, 400, 480);
  return 69 + 12 * Math.log2(safeFrequency / safeConcertA);
}

function midiNoteToFrequency(midiNote: number, concertA = 440): number {
  const safeConcertA = clamp(concertA, 400, 480);
  return safeConcertA * 2 ** ((midiNote - 69) / 12);
}

function applyOscillatorWaveform(
  graph: ThereminAudioGraph,
  settings: ThereminSettings,
): void {
  if (settings.waveform !== "custom") {
    if (graph.waveformKey !== settings.waveform) {
      graph.oscillator.type = settings.waveform;
      graph.waveformKey = settings.waveform;
    }
    return;
  }

  const samples = normalizeCustomWaveform(settings.customWaveform);
  const waveformKey = `custom:${samples.map((sample) => sample.toFixed(3)).join(",")}`;
  if (graph.waveformKey === waveformKey) {
    return;
  }

  graph.oscillator.setPeriodicWave(
    createPeriodicWaveFromSamples(graph.context, samples),
  );
  graph.waveformKey = waveformKey;
}

function createPeriodicWaveFromSamples(
  context: AudioContext,
  samples: number[],
): PeriodicWave {
  const sampleCount = samples.length;
  const harmonicCount = Math.min(24, Math.floor(sampleCount / 2));
  const real = new Float32Array(harmonicCount + 1);
  const imag = new Float32Array(harmonicCount + 1);
  const mean =
    samples.reduce((sum, sample) => sum + sample, 0) / Math.max(1, sampleCount);

  for (let harmonic = 1; harmonic <= harmonicCount; harmonic += 1) {
    let cosine = 0;
    let sine = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const phase = (Math.PI * 2 * harmonic * index) / sampleCount;
      const sample = samples[index] - mean;
      cosine += sample * Math.cos(phase);
      sine += sample * Math.sin(phase);
    }
    real[harmonic] = (2 / sampleCount) * cosine;
    imag[harmonic] = (2 / sampleCount) * sine;
  }

  return context.createPeriodicWave(real, imag, { disableNormalization: false });
}

export function createBuiltinWaveformSamples(
  waveform: ThereminBuiltInWaveform,
  count = customWaveformPointCount,
): number[] {
  return Array.from({ length: count }, (_, index) =>
    waveformValue(waveform, index / count),
  );
}

export function normalizeCustomWaveform(
  samples: readonly number[] | undefined,
): number[] {
  const source =
    samples && samples.length > 0
      ? samples
      : createBuiltinWaveformSamples("sine", customWaveformPointCount);
  return Array.from({ length: customWaveformPointCount }, (_, index) => {
    const sourceIndex = Math.min(
      source.length - 1,
      Math.floor((index / customWaveformPointCount) * source.length),
    );
    return clamp(source[sourceIndex] ?? 0, -1, 1);
  });
}

function waveformValue(waveform: ThereminBuiltInWaveform, phase: number): number {
  const cycle = phase % 1;
  if (waveform === "sine") {
    return Math.sin(cycle * Math.PI * 2);
  }
  if (waveform === "triangle") {
    return 1 - Math.abs(cycle - 0.5) * 4;
  }
  if (waveform === "sawtooth") {
    return 1 - cycle * 2;
  }
  return cycle < 0.5 ? 1 : -1;
}

function createImpulseResponse(context: AudioContext): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * 1.35);
  const impulse = context.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const decay = (1 - i / length) ** 2.4;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return impulse;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
