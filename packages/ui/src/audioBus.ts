export type AudioPlaybackLane = "performance" | "audition";

export interface AudioBusChannel {
  context: AudioContext;
  input: GainNode;
  lane: AudioPlaybackLane;
  disconnect(): void;
}

export interface AudioBusChannelOptions {
  lane?: AudioPlaybackLane;
  gain?: number;
}

export interface SharedAudioBus {
  context: AudioContext;
  performanceInput: GainNode;
  auditionInput: GainNode;
  masterGain: GainNode;
  limiter: DynamicsCompressorNode;
  createChannel(options?: AudioBusChannelOptions): AudioBusChannel;
  resume(): Promise<void>;
  setMasterGain(value: number): void;
  stopAudition(): void;
}

type AudioContextConstructor = typeof AudioContext;

interface AudioContextWindow extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

let sharedAudioBus: SharedAudioBus | null = null;

export function getSharedAudioBus(): SharedAudioBus {
  if (sharedAudioBus && sharedAudioBus.context.state !== "closed") {
    return sharedAudioBus;
  }

  if (typeof window === "undefined") {
    throw new Error("Audio playback requires a browser runtime.");
  }

  const AudioContextClass =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not available in this browser.");
  }

  const context = new AudioContextClass();
  const performanceInput = context.createGain();
  const auditionInput = context.createGain();
  const masterGain = context.createGain();
  const limiter = context.createDynamicsCompressor();
  const auditionChannels = new Set<AudioBusChannel>();

  performanceInput.gain.value = 1;
  auditionInput.gain.value = 1;
  masterGain.gain.value = 1;
  limiter.threshold.value = -2;
  limiter.knee.value = 1;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.16;

  performanceInput.connect(masterGain);
  auditionInput.connect(masterGain);
  masterGain.connect(limiter);
  limiter.connect(context.destination);

  sharedAudioBus = {
    context,
    performanceInput,
    auditionInput,
    masterGain,
    limiter,
    createChannel(options = {}) {
      const lane = options.lane ?? "performance";
      const input = context.createGain();
      let connected = true;

      input.gain.value = clampFinite(options.gain ?? 1, 0, 2);
      input.connect(lane === "audition" ? auditionInput : performanceInput);

      const channel: AudioBusChannel = {
        context,
        input,
        lane,
        disconnect() {
          if (!connected) {
            return;
          }

          connected = false;
          try {
            input.disconnect();
          } catch {
            // Disconnect is best-effort because callers can race ended sources.
          }
          auditionChannels.delete(channel);
        },
      };

      if (lane === "audition") {
        auditionChannels.add(channel);
      }

      return channel;
    },
    async resume() {
      if (context.state === "suspended") {
        await context.resume();
      }
    },
    setMasterGain(value: number) {
      masterGain.gain.setTargetAtTime(
        clampFinite(value, 0, 1.5),
        context.currentTime,
        0.01,
      );
    },
    stopAudition() {
      for (const channel of Array.from(auditionChannels)) {
        channel.disconnect();
      }
    },
  };

  return sharedAudioBus;
}

function clampFinite(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, value));
}
