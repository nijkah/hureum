export interface AudioSnapshot {
  level: number;
  peak: number;
  bass: number;
  mid: number;
  treble: number;
}

export const silentAudioSnapshot: AudioSnapshot = {
  level: 0,
  peak: 0,
  bass: 0,
  mid: 0,
  treble: 0,
};

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

export function calculatePeak(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

export function smoothValue(previous: number, next: number, smoothing: number): number {
  const amount = Math.min(0.98, Math.max(0, smoothing));
  return previous * amount + next * (1 - amount);
}

export function averageFrequencyRange(
  data: Uint8Array,
  startRatio: number,
  endRatio: number,
): number {
  if (data.length === 0) {
    return 0;
  }
  const start = Math.max(0, Math.floor(data.length * startRatio));
  const end = Math.min(data.length, Math.max(start + 1, Math.floor(data.length * endRatio)));
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    sum += data[index] ?? 0;
  }
  return sum / (end - start) / 255;
}
