import type { KeyboardEvent, PointerEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  createBuiltinWaveformSamples,
  customWaveformPointCount,
  normalizeCustomWaveform,
  type ThereminWaveform,
} from "./theremin";

const viewBoxWidth = 320;
const viewBoxHeight = 128;
const centerY = viewBoxHeight / 2;
const horizontalPadding = 16;
const amplitudeRadius = 48;
const keyboardStep = 0.05;

export function WaveEditor({
  customWaveform,
  onChange,
  waveform,
}: {
  customWaveform: number[];
  onChange(samples: number[]): void;
  waveform: ThereminWaveform;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastEditRef = useRef<{ index: number; value: number } | null>(null);
  const samples = useMemo(
    () =>
      waveform === "custom"
        ? normalizeCustomWaveform(customWaveform)
        : createBuiltinWaveformSamples(waveform),
    [customWaveform, waveform],
  );
  const path = createWavePath(samples);
  const status = waveform === "custom" ? "Custom" : `From ${waveform}`;

  function commitPoint(index: number, value: number): void {
    const nextSamples = [...samples];
    const previous = lastEditRef.current;
    if (previous && previous.index !== index) {
      const start = Math.min(previous.index, index);
      const end = Math.max(previous.index, index);
      const span = Math.max(1, end - start);
      for (let pointIndex = start; pointIndex <= end; pointIndex += 1) {
        const mix = (pointIndex - start) / span;
        const startValue = previous.index <= index ? previous.value : value;
        const endValue = previous.index <= index ? value : previous.value;
        nextSamples[pointIndex] = startValue + (endValue - startValue) * mix;
      }
    } else {
      nextSamples[index] = value;
    }
    lastEditRef.current = { index, value };
    setActiveIndex(index);
    onChange(nextSamples);
  }

  function commitFromPointer(event: PointerEvent<HTMLDivElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * viewBoxWidth;
    const y = ((event.clientY - bounds.top) / bounds.height) * viewBoxHeight;
    const phase = clamp(
      (x - horizontalPadding) / (viewBoxWidth - horizontalPadding * 2),
      0,
      1,
    );
    const index = Math.min(
      customWaveformPointCount - 1,
      Math.round(phase * (customWaveformPointCount - 1)),
    );
    const value = clamp((centerY - y) / amplitudeRadius, -1, 1);
    commitPoint(index, value);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    lastEditRef.current = null;
    commitFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (event.buttons !== 1) {
      return;
    }
    commitFromPointer(event);
  }

  function handlePointerEnd(): void {
    lastEditRef.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const nextIndex = activeIndex ?? 0;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveIndex(Math.min(customWaveformPointCount - 1, nextIndex + 1));
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveIndex(Math.max(0, nextIndex - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      commitPoint(nextIndex, clamp(samples[nextIndex] + keyboardStep, -1, 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      commitPoint(nextIndex, clamp(samples[nextIndex] - keyboardStep, -1, 1));
    }
  }

  return (
    <div className="wave-editor-field">
      <div className="wave-editor-header">
        <span>Wave Editor</span>
        <small>{status}</small>
      </div>
      <div
        aria-label="Custom wave editor"
        className="wave-editor"
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="wave-editor-canvas"
          preserveAspectRatio="none"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        >
          <line
            className="wave-editor-midline"
            x1={horizontalPadding}
            x2={viewBoxWidth - horizontalPadding}
            y1={centerY}
            y2={centerY}
          />
          <path className="wave-editor-fill" d={createWaveFillPath(path)} />
          <path className="wave-editor-line" d={path} />
          {samples.map((sample, index) => {
            const position = pointPosition(index, sample);
            return (
              <circle
                className={
                  index === activeIndex
                    ? "wave-editor-point wave-editor-point-active"
                    : "wave-editor-point"
                }
                cx={position.x}
                cy={position.y}
                key={index}
                r={index === activeIndex ? 4.6 : 3.2}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function createWavePath(samples: number[]): string {
  return samples
    .map((sample, index) => {
      const { x, y } = pointPosition(index, sample);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function createWaveFillPath(linePath: string): string {
  return `${linePath} L ${viewBoxWidth - horizontalPadding} ${centerY} L ${horizontalPadding} ${centerY} Z`;
}

function pointPosition(index: number, value: number): { x: number; y: number } {
  const drawableWidth = viewBoxWidth - horizontalPadding * 2;
  return {
    x: horizontalPadding + (index / (customWaveformPointCount - 1)) * drawableWidth,
    y: centerY - clamp(value, -1, 1) * amplitudeRadius,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
