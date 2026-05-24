import {
  defaultProjectCalibration,
  type ProjectCalibration,
} from "@hello-cam/core";
import { useEffect, useState } from "react";
import type { FaceTrackingState } from "./faceTracking";
import { useFaceTracking } from "./faceTracking";
import {
  defaultHandKeyboardSettings,
  type HandKeyboardSettings,
  type HandKeyboardState,
  useHandKeyboard,
} from "./handKeyboard";
import type { HandTrackingState } from "./handTracking";
import { useHandTracking } from "./handTracking";
import type { MediaState } from "./media";
import { useMediaSources } from "./media";
import type { PoseTrackingState } from "./poseTracking";
import { usePoseTracking } from "./poseTracking";
import {
  defaultThereminSettings,
  type ThereminSettings,
  type ThereminState,
} from "./theremin";
import { useTransparentTheremin } from "./theremin";

export interface InteractiveRuntime {
  media: MediaState;
  handTracking: HandTrackingState;
  handTrackingEnabled: boolean;
  setHandTrackingEnabled(enabled: boolean): void;
  handOverlayEnabled: boolean;
  setHandOverlayEnabled(enabled: boolean): void;
  faceTracking: FaceTrackingState;
  faceTrackingEnabled: boolean;
  setFaceTrackingEnabled(enabled: boolean): void;
  faceOverlayEnabled: boolean;
  setFaceOverlayEnabled(enabled: boolean): void;
  poseTracking: PoseTrackingState;
  poseTrackingEnabled: boolean;
  setPoseTrackingEnabled(enabled: boolean): void;
  poseOverlayEnabled: boolean;
  setPoseOverlayEnabled(enabled: boolean): void;
  theremin: ThereminState;
  thereminEnabled: boolean;
  setThereminEnabled(enabled: boolean): void;
  thereminSettings: ThereminSettings;
  setThereminSettings(settings: ThereminSettings): void;
  handKeyboard: HandKeyboardState;
  handKeyboardEnabled: boolean;
  setHandKeyboardEnabled(enabled: boolean): void;
  handKeyboardSettings: HandKeyboardSettings;
  setHandKeyboardSettings(settings: HandKeyboardSettings): void;
  startHandTracking(): void;
  stopHandTracking(): void;
  startFaceTracking(): void;
  stopFaceTracking(): void;
  startPoseTracking(): void;
  stopPoseTracking(): void;
  startTheremin(): void;
  stopTheremin(): void;
  startHandKeyboard(): void;
  stopHandKeyboard(): void;
  errors: string;
}

export function useInteractiveRuntime(
  calibration: ProjectCalibration = defaultProjectCalibration,
): InteractiveRuntime {
  const media = useMediaSources(calibration.camera);
  const [handTrackingEnabled, setHandTrackingEnabledState] = useState(false);
  const [handOverlayEnabled, setHandOverlayEnabled] = useState(true);
  const [faceTrackingEnabled, setFaceTrackingEnabledState] = useState(false);
  const [faceOverlayEnabled, setFaceOverlayEnabled] = useState(true);
  const [poseTrackingEnabled, setPoseTrackingEnabledState] = useState(false);
  const [poseOverlayEnabled, setPoseOverlayEnabled] = useState(true);
  const [thereminEnabled, setThereminEnabled] = useState(false);
  const [thereminSettings, setThereminSettings] = useState<ThereminSettings>(
    defaultThereminSettings,
  );
  const [handKeyboardEnabled, setHandKeyboardEnabled] = useState(false);
  const [handKeyboardSettings, setHandKeyboardSettings] =
    useState<HandKeyboardSettings>(defaultHandKeyboardSettings);
  const handTracking = useHandTracking(
    handTrackingEnabled,
    media.video,
    calibration.tracking,
  );
  const faceTracking = useFaceTracking(faceTrackingEnabled, media.video);
  const poseTracking = usePoseTracking(poseTrackingEnabled, media.video);
  const theremin = useTransparentTheremin(
    thereminEnabled,
    handTracking,
    thereminSettings,
  );
  const handKeyboard = useHandKeyboard(
    handKeyboardEnabled,
    handTracking,
    handKeyboardSettings,
  );
  const errors = [
    media.cameraError,
    media.micError,
    handTracking.error,
    faceTracking.error,
    poseTracking.error,
    theremin.error,
    handKeyboard.error,
  ]
    .filter(Boolean)
    .join("\n");

  useEffect(() => {
    if (!handTrackingEnabled) {
      setThereminEnabled(false);
      setHandKeyboardEnabled(false);
    }
  }, [handTrackingEnabled]);

  function setHandTrackingEnabled(enabled: boolean): void {
    setHandTrackingEnabledState(enabled);
    if (enabled) {
      media.setCameraEnabled(true);
    }
  }

  function setFaceTrackingEnabled(enabled: boolean): void {
    setFaceTrackingEnabledState(enabled);
    if (enabled) {
      media.setCameraEnabled(true);
    }
  }

  function setPoseTrackingEnabled(enabled: boolean): void {
    setPoseTrackingEnabledState(enabled);
    if (enabled) {
      media.setCameraEnabled(true);
    }
  }

  function startHandTracking(): void {
    setHandTrackingEnabled(true);
  }

  function stopHandTracking(): void {
    setHandTrackingEnabled(false);
  }

  function startFaceTracking(): void {
    setFaceTrackingEnabled(true);
  }

  function stopFaceTracking(): void {
    setFaceTrackingEnabled(false);
  }

  function startPoseTracking(): void {
    setPoseTrackingEnabled(true);
  }

  function stopPoseTracking(): void {
    setPoseTrackingEnabled(false);
  }

  function startTheremin(): void {
    theremin.prime();
    media.setCameraEnabled(true);
    setHandTrackingEnabledState(true);
    setThereminEnabled(true);
  }

  function stopTheremin(): void {
    setThereminEnabled(false);
  }

  function startHandKeyboard(): void {
    handKeyboard.prime();
    media.setCameraEnabled(true);
    setHandTrackingEnabledState(true);
    setHandKeyboardEnabled(true);
  }

  function stopHandKeyboard(): void {
    setHandKeyboardEnabled(false);
  }

  return {
    media,
    handTracking,
    handTrackingEnabled,
    setHandTrackingEnabled,
    handOverlayEnabled,
    setHandOverlayEnabled,
    faceTracking,
    faceTrackingEnabled,
    setFaceTrackingEnabled,
    faceOverlayEnabled,
    setFaceOverlayEnabled,
    poseTracking,
    poseTrackingEnabled,
    setPoseTrackingEnabled,
    poseOverlayEnabled,
    setPoseOverlayEnabled,
    theremin,
    thereminEnabled,
    setThereminEnabled,
    thereminSettings,
    setThereminSettings,
    handKeyboard,
    handKeyboardEnabled,
    setHandKeyboardEnabled,
    handKeyboardSettings,
    setHandKeyboardSettings,
    startHandTracking,
    stopHandTracking,
    startFaceTracking,
    stopFaceTracking,
    startPoseTracking,
    stopPoseTracking,
    startTheremin,
    stopTheremin,
    startHandKeyboard,
    stopHandKeyboard,
    errors,
  };
}
