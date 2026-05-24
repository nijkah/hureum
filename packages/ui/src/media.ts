import {
  createMicAnalyzer,
  silentAudioSnapshot,
  type AudioSnapshot,
  type MicAnalyzer,
} from "@hello-cam/audio";
import {
  defaultProjectCalibration,
  type ProjectCameraCalibration,
} from "@hello-cam/core";
import { useEffect, useRef, useState } from "react";

export interface MediaState {
  cameraEnabled: boolean;
  micEnabled: boolean;
  audio: AudioSnapshot;
  video: HTMLVideoElement | null;
  cameraError: string | null;
  micError: string | null;
  setCameraEnabled(enabled: boolean): void;
  setMicEnabled(enabled: boolean): void;
  readAudio(): AudioSnapshot;
}

export function useMediaSources(
  cameraCalibration: ProjectCameraCalibration = defaultProjectCalibration.camera,
): MediaState {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [audio, setAudio] = useState<AudioSnapshot>(silentAudioSnapshot);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const analyzerRef = useRef<MicAnalyzer | null>(null);
  const audioRef = useRef<AudioSnapshot>(silentAudioSnapshot);

  useEffect(() => {
    if (!cameraEnabled) {
      setVideo(null);
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;

    async function start(): Promise<void> {
      try {
        setCameraError(null);
        const { width, height } = resolutionSize(cameraCalibration.resolution);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width,
            height,
            frameRate: cameraCalibration.fps,
          },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        const element = document.createElement("video");
        element.muted = true;
        element.playsInline = true;
        element.autoplay = true;
        element.srcObject = stream;
        await element.play();
        setVideo(element);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Could not start camera.";
        setCameraError(message);
        setCameraEnabled(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [cameraCalibration.fps, cameraCalibration.resolution, cameraEnabled]);

  useEffect(() => {
    if (!micEnabled) {
      analyzerRef.current?.dispose();
      analyzerRef.current = null;
      setAudio(silentAudioSnapshot);
      audioRef.current = silentAudioSnapshot;
      return;
    }

    let cancelled = false;

    async function start(): Promise<void> {
      try {
        setMicError(null);
        const analyzer = await createMicAnalyzer();
        if (cancelled) {
          analyzer.dispose();
          return;
        }
        analyzerRef.current = analyzer;
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Could not start microphone.";
        setMicError(message);
        setMicEnabled(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      analyzerRef.current?.dispose();
      analyzerRef.current = null;
    };
  }, [micEnabled]);

  return {
    cameraEnabled,
    micEnabled,
    audio,
    video,
    cameraError,
    micError,
    setCameraEnabled,
    setMicEnabled,
    readAudio(): AudioSnapshot {
      const snapshot = analyzerRef.current?.read() ?? silentAudioSnapshot;
      audioRef.current = snapshot;
      setAudio(snapshot);
      return snapshot;
    },
  };
}

function resolutionSize(
  resolution: ProjectCameraCalibration["resolution"],
): { width: number; height: number } {
  switch (resolution) {
    case "640x360":
      return { width: 640, height: 360 };
    case "1920x1080":
      return { width: 1920, height: 1080 };
    case "1280x720":
    default:
      return { width: 1280, height: 720 };
  }
}
