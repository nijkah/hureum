import {
  averageFrequencyRange,
  calculatePeak,
  calculateRms,
  silentAudioSnapshot,
  smoothValue,
  type AudioSnapshot,
} from "./analysis";

export interface MicAnalyzerOptions {
  fftSize?: number;
  smoothing?: number;
}

export interface MicAnalyzer {
  read(): AudioSnapshot;
  dispose(): void;
}

export async function createMicAnalyzer(
  options: MicAnalyzerOptions = {},
): Promise<MicAnalyzer> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone input is not available in this runtime.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Web Audio is not available in this runtime.");
  }

  const audioContext = new AudioContextCtor();
  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => undefined);
  }
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = options.fftSize ?? 2048;
  analyser.smoothingTimeConstant = 0.74;
  source.connect(analyser);

  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Float32Array(analyser.fftSize);
  let previous = { ...silentAudioSnapshot };
  const smoothing = options.smoothing ?? 0.76;

  return {
    read(): AudioSnapshot {
      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => undefined);
      }
      analyser.getFloatTimeDomainData(timeData);
      analyser.getByteFrequencyData(frequencyData);
      const next: AudioSnapshot = {
        level: Math.min(1, calculateRms(timeData) * 2.4),
        peak: Math.min(1, calculatePeak(timeData)),
        bass: averageFrequencyRange(frequencyData, 0.0, 0.08),
        mid: averageFrequencyRange(frequencyData, 0.08, 0.36),
        treble: averageFrequencyRange(frequencyData, 0.36, 1.0),
      };
      previous = {
        level: smoothValue(previous.level, next.level, smoothing),
        peak: smoothValue(previous.peak, next.peak, smoothing),
        bass: smoothValue(previous.bass, next.bass, smoothing),
        mid: smoothValue(previous.mid, next.mid, smoothing),
        treble: smoothValue(previous.treble, next.treble, smoothing),
      };
      return previous;
    },
    dispose(): void {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      void audioContext.close();
    },
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
