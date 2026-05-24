# Clean-Room Design: Realtime Visual Arts Engine for macOS

## Goal

Build an independent realtime visual arts and interactive coding application for macOS without installing, embedding, reverse engineering, or copying TouchDesigner.

The product direction is a node-based creative coding environment for camera, audio, MIDI/OSC, generated visuals, shaders, and live performance output.

## Clean-Room Boundary

The project must use only public, general-domain concepts and platform APIs:

- Realtime media graph
- Node-based editing
- Audio analysis
- Camera/video input
- Shader-based rendering
- MIDI, OSC, keyboard, mouse, and controller input
- Presets, scenes, recording, and fullscreen output

The project must not use:

- TouchDesigner binaries, project files, sample networks, palettes, internal APIs, private formats, names, icons, UI layout, or screenshots as implementation material
- Reverse engineering of TouchDesigner behavior, file formats, operators, or network evaluation
- Proprietary terminology as product-facing API where a neutral term is possible

Acceptable references:

- Public platform documentation from Apple, Khronos/WebGPU, MIDI/OSC specs, W3C specs
- General graphics/audio literature
- Independently written requirements based on desired user outcomes

## Product Name

Working name: `Hello Cam`

One-line description: a macOS-native live visual instrument that turns camera, sound, and code into realtime generative visuals.

Music language name: `Gyeol`

Gyeol is the product's clean-room performance score language. It should describe
music, sound design, gesture mappings, visual triggers, and arrangement state
without embedding or cloning Strudel, TidalCycles, Sonic Pi, or any other live
coding runtime.

## Initial Product Shape

The first version should not try to clone a full professional media system. It should be a focused tool:

- Capture MacBook camera and microphone
- Analyze audio amplitude, frequency bands, and beat-like transients
- Generate realtime 2D/3D visuals
- Let users connect signals to visual parameters through a graph
- Support custom fragment shaders
- Provide performance mode with fullscreen output
- Save/load projects in a documented JSON format

## Architecture

```text
App Shell
  Project Manager
  Graph Editor
  Inspector
  Preview / Output Window

Runtime Engine
  Graph Scheduler
  Node Registry
  Signal Store
  Render Graph
  Audio Engine
  Input System
  Persistence
```

## Recommended Technology Stack

Primary stack for an open-source, JS/TS-first implementation:

- Desktop shell: Electron
- Web demo shell: Vite
- Language: TypeScript
- UI: React
- Node graph editor: React Flow
- Package manager: pnpm workspaces
- GPU: WebGPU
- Camera: `navigator.mediaDevices.getUserMedia`
- Audio input and analysis: Web Audio API
- Recording: canvas capture plus `MediaRecorder`
- Project format: versioned JSON
- Shader format: WGSL fragment body inside a constrained template

Reasoning:

- Electron provides a predictable Chromium runtime for WebGPU, Web Audio, camera, canvas capture, and file IPC.
- The core packages remain reusable by a browser demo app.
- TypeScript, React, Vite, and pnpm keep the project approachable for open-source contributors.

The Electron main process should stay thin. It owns windows, file dialogs, project file reads/writes, recovery snapshots, and IPC. Media capture, graph evaluation, rendering, and recording run in the renderer through Web APIs.

## Core Concepts

### Graph

A project is a directed graph of nodes. Nodes expose typed input and output ports.

Port types:

- `Number`: scalar control value
- `Signal`: time-varying numeric stream
- `AudioBuffer`: audio frames
- `Texture`: GPU image
- `Geometry`: mesh or point data
- `Event`: triggers and discrete actions
- `Table`: structured rows/columns

### Node

Each node has:

- Stable id
- Type id
- Display name
- Input ports
- Output ports
- Parameters
- Runtime state
- Optional GPU resources

### Scheduler

The scheduler evaluates the graph once per frame.

Rules:

- Input nodes update first.
- CPU signal nodes update next.
- GPU render nodes encode Metal commands after dependencies are ready.
- Output nodes present, record, or stream final textures.
- Nodes cache outputs and recompute only when inputs, parameters, or time dependencies change.

For v1, a single-threaded deterministic scheduler is acceptable. Move audio capture and GPU encoding to specialized queues as performance demands.

## MVP Node Set

Input nodes:

- Camera Input
- Microphone Input
- Audio File Player
- Keyboard Input
- Mouse Input
- MIDI Input
- OSC Input
- Time

Signal nodes:

- Constant
- Normalize
- Smooth
- Range Map
- Low Frequency Oscillator
- Noise
- Envelope Follower
- Audio Spectrum
- Band Splitter
- Peak Detector

Visual nodes:

- Solid Color
- Image/Video File
- Blur
- Threshold
- Feedback
- Composite
- Displace
- Shader
- Particle Field
- Text

3D nodes:

- Camera
- Light
- Mesh Primitive
- Material
- Instance Points
- Render Scene

Output nodes:

- Preview
- Fullscreen Output
- Movie Recorder
- Still Image Export

## First User Workflow

1. User opens the app and sees an empty graph plus preview.
2. User adds Camera Input.
3. User adds Microphone Input and Audio Spectrum.
4. User adds Particle Field.
5. User connects audio low band to particle size.
6. User connects camera luminance/motion to particle attraction.
7. User adds Feedback and Composite.
8. User enters fullscreen performance mode.
9. User saves the project as JSON.

## Project File Format

Use a readable, versioned JSON format.

```json
{
  "format": "hello-cam-project",
  "version": 1,
  "nodes": [
    {
      "id": "node_1",
      "type": "camera.input",
      "position": { "x": 120, "y": 80 },
      "parameters": {
        "device": "default",
        "resolution": "1280x720"
      }
    }
  ],
  "connections": [
    {
      "from": { "node": "node_1", "port": "texture" },
      "to": { "node": "node_2", "port": "source" }
    }
  ]
}
```

## Rendering Pipeline

V1 should focus on a simple, robust WebGPU pipeline:

- The render target is fixed at `1280x720@60` by default.
- Each visual node outputs a `Texture` conceptually, even if v1 only renders the selected shader output.
- The Shader node compiles a user-provided WGSL fragment body within a constrained template.
- The template exposes `uv`, `params`, and a `camera(uv)` helper.
- Preview, fullscreen output, and recording use the final canvas output.

Avoid advanced features in v1:

- Multi-machine sync
- Projection mapping
- Plugin ABI
- Arbitrary native code loading
- Complex timeline editing
- Commercial media-server features

## Audio Pipeline

Audio capture should remain independent from frame rendering.

- Capture mic input with `navigator.mediaDevices.getUserMedia`.
- Analyze samples through Web Audio `AnalyserNode`.
- Each frame, read the latest time-domain and frequency-domain data.
- Compute RMS, peak, and low/mid/high band energy.
- Publish results as graph values.

Initial analysis outputs:

- `volume`
- `bass`
- `mid`
- `treble`
- `peak`
- `transient`

## Research Intake: Interactive Media And Music Scope

The 2026-05-24 subagent research pass expands the product plan beyond a
camera-reactive visual sketcher into a live visual and musical instrument. The
research was organized into four independent tracks:

- Input and tracking systems: MediaPipe hand, gesture, face, pose, segmentation,
  MIDI, gamepad, mobile sensor control, OSC bridge, and calibration.
- Interactive music systems: Web Audio synthesis, custom waveforms, envelopes,
  LFOs, effects, loopers, sequencers, MIDI, OSC, Ableton Link bridge, recording,
  replay, and latency diagnostics.
- Visual media runtime: node graph types, WebGPU/WebGL rendering, frame graph,
  video input, recording, projection mapping, assets, particles, typography, and
  diagnostics.
- Performance workflow: Compose/Patch/Perform mode separation, scene/cue
  handling, snapshots, macro mappings, safety controls, project portability, and
  logging.

Primary public references used by the research pass:

- MediaPipe Tasks for Web: hand, gesture, face, pose, segmentation, and audio
  classification tasks.
- Web Audio API: `AudioContext`, `OscillatorNode`, `PeriodicWave`,
  `AudioWorklet`, `AnalyserNode`, `MediaStreamAudioDestinationNode`.
- Web media APIs: `getUserMedia`, canvas capture, `MediaRecorder`, WebGPU,
  Web MIDI, Gamepad, device orientation, and Web Workers.
- OSC 1.0 specification for external multimedia control messages.
- Tone.js and Tonal public documentation for browser audio scheduling,
  synthesis/effects, note names, scales, and frequency conversion.
- Public pattern-based music coding tools were used only as workflow references.
  Their source code, package APIs, grammars, examples, and runtime designs should
  not be copied into Hello Cam.
- Public documentation from established performance tools was used only to
  identify common workflow categories, not to copy names, UI, internals, or file
  formats.

### Product Pillars From Research

1. **Input as first-class control data.** Camera landmarks, gestures, face
   expressions, pose, MIDI, OSC, gamepad, keyboard, mouse, and mobile sensors
   should all enter the system through a common mapping layer.
2. **Audio as an instrument, not only analysis.** The app needs Web Audio
   synthesis, effects, quantization, looping, sample editing, replay, and
   scheduling, not just microphone meters.
3. **Visuals as a texture graph.** The graph should move textures, video frames,
   control values, events, and audio events through independent typed ports.
4. **Performance safety.** Live use needs a clear Perform mode, preflight
   diagnostics, panic/blackout controls, presets, cue state, and portable
   projects.
5. **Extensibility with legal boundaries.** Gyeol, OSC, MIDI, Ableton Link,
   native device bridges, and plugin-like blocks should have explicit licensing
   and runtime boundaries. Code-based music should be a Gyeol feature first,
   with external live-coding tools treated as optional bridges rather than core
   dependencies.

### Gyeol Music Benchmarking Intake

The 2026-05-24 music-language research pass looked at public documentation,
comparison articles, and community discussions around Strudel, TidalCycles,
Sonic Pi, SuperCollider, ChucK, Tone.js, Sardine, Orca, Gibber, and Ableton
Link. These references are requirements input only. Do not copy source code,
grammars, examples, runtime APIs, UI layouts, or proprietary sound libraries.

Public signals from the research:

- Strudel is strong because it brings Tidal-style cyclic pattern power to the
  browser with low setup friction and shareable code. Its public docs emphasize
  mini-notation, samples, synths, effects, visual feedback, MIDI/OSC, and
  browser-based learning.
- TidalCycles is still a reference point for deep algorithmic pattern
  manipulation, polyrhythm, and sample mangling, but setup and synthesis depth
  are common friction points.
- Sonic Pi is valued for readability, education, built-in synthesis, well-timed
  MIDI/OSC, multi-channel audio, and Ableton Link.
- SuperCollider and ChucK show the value of deeper synthesis, precise timing,
  concurrent musical processes, and low-level sound design.
- Tone.js is a practical browser-audio reference for transport, scheduling,
  instruments, effects, and complex control signals, but it should be hidden
  behind Gyeol's own project model if used.
- Sardine, Orca, and Gibber show useful directions for hardware/software
  interoperability, audiovisual coding, multiple pattern languages, and
  procedural sequencing.
- Community discussions repeatedly mention needs around reliable MIDI, offline
  use, audio cutout diagnostics, seamless song-section transitions, visual
  feedback, local/custom samples, arrangement workflows, and deeper synthesis
  controls such as portamento, non-retriggered modulation, envelopes, and LFOs.

Gyeol's music-specific differentiation should be:

1. **Score plus sound design.** Gyeol should not stop at triggering samples.
   It should define playable instruments with oscillators, envelopes, filters,
   waveshaping, FM/AM, noise, unison, glide, legato, retrigger policy, and
   polyphony rules.
2. **Gesture-native modulation.** Camera, hands, face, pose, MIDI, OSC,
   keyboard, mouse, gamepad, audio analysis, and code-generated LFOs should all
   route through one modulation model.
3. **DAW-aware arrangement.** Gyeol should support clips, sections, scenes,
   quantized transitions, mutes, solos, masks, cue launch, and renderable song
   form rather than only endless pattern loops.
4. **Sample intelligence.** Imported audio should support waveform display,
   trim, split, slice by grid/transient, reverse, normalize, pitch detect,
   pitch correction, time stretch, granular playback, and local/offline caching.
5. **Performance reliability.** The audio engine should expose preloading,
   audio-worklet scheduling where needed, underrun/click detection, CPU/voice
   meters, panic mute, limiter, and browser/device diagnostics.
6. **Hardware and DAW bridge.** MIDI in/out, CC, program change, OSC, Ableton
   Link via bridge, multichannel/stem routing, MIDI export, and audio stem
   export should be first-class concepts.
7. **Music theory as a tool.** Gyeol should include note names, scales, modes,
   microtonal tunings, chord symbols, inversions, voicings, anchor notes, chord
   progressions, and quantization.
8. **Human feel.** Swing, groove templates, per-track microtiming, velocity,
   accents, probability, ratchets, tuplets, Euclidean rhythm, polymeter, and
   polyrhythm should be available without making the syntax obscure.
9. **Visual and debugging feedback.** Pianoroll, punchcard, active-token
   highlight, waveform, spectrum, scope, chord display, event timeline, and
   scheduler diagnostics should be available from the same parsed score.

Example Gyeol direction:

```gyeol
bpm 128
meter 4/4
tuning 12edo A4 440

sample break = file "amen.wav" {
  cache local
  slice transient
  pitch auto
}

synth bass {
  osc saw
  sub sine -12
  filter lpf cutoff 900 q .8
  env amp attack .005 decay .12 sustain .42 release .18
  glide 60ms
  legato true
}

track drums {
  play break.slice "0 3 5 7 3 5 1 7"
  fx { crush .18 room .12 }
}

track bassline {
  note "D1 ~ F1 A1"
  scale D minor
  play bass
  groove swing .56
}

map hands.distance.xy -> bass.filter.cutoff {
  range 20cm..100cm to 240..4200
  smooth 80ms
}

scene drop after 16 bars {
  launch quantized 4 bars
  unmute drums bassline
  visual pulse audio.low
}

view pianoroll { fold 1 }
export stems wav midi
```

## Updated Implementation Plan

### P0: Current Product Foundation

These items define the next practical implementation target.

#### Input And Tracking

- Extend the hand tracker from distance-only outputs to a fuller hand-control
  model:
  - 21 landmarks per hand
  - handedness
  - palm center
  - pinch distance
  - grab/open state
  - pointing direction
  - velocity
  - two-hand span
  - two-hand angle
- Add gesture outputs as events and continuous values.
- Add camera source controls:
  - device selection
  - resolution/FPS presets
  - mirror mode
  - permission and reconnect status
- Introduce a common mapping layer:
  - normalize
  - clamp
  - smooth
  - deadzone
  - invert
  - range map
  - curve
  - hold
  - trigger threshold
- Store calibration profiles for camera orientation, tracking thresholds, and
  coordinate transforms.

#### Hand Theremin And Web Audio Instrument

- Add 12-tone equal temperament quantization to Hand Theremin:
  - continuous pitch mode
  - chromatic 12-note mode
  - configurable concert A reference, default `A4 = 440 Hz`
  - displayed note name alongside frequency
- Keep min/max Hz controls, but quantize the final target frequency when the
  option is enabled.
- Keep custom waveform editing with Web Audio `PeriodicWave`.
- Compress the Hand Theremin UI:
  - restore conventional volume control
  - use compact knobs for Volume, Tone, Glide, Echo, Delay, Feedback, and Reverb
  - keep Wave Editor larger because it is an editing surface, not a scalar
    parameter
- Add a global audio safety layer:
  - master gain
  - panic mute
  - simple limiter/compressor
  - active voice count
  - latency/status display

#### Loop Station MVP

- Add a Loop Station tool for multiple simultaneous sample loops.
- First version track model:

```json
{
  "id": "clip_1",
  "name": "voice loop",
  "bufferId": "asset_1",
  "startSec": 0,
  "endSec": 4.0,
  "loop": true,
  "gain": 0.8,
  "muted": false,
  "solo": false,
  "quantizeLaunch": false
}
```

- Required editing actions:
  - import audio file
  - play/stop one clip
  - play/stop all clips
  - trim start/end
  - duplicate clip
  - copy clip
  - paste clip
  - delete clip
  - per-clip volume
  - master volume
- Required dashboard:
  - clip slots
  - current play state
  - clip length
  - start/end values
  - muted/solo state
  - selected clip inspector
- Recording and replay should treat loop-trigger events separately from rendered
  audio export. This keeps performance replay editable.

#### Gyeol Score Block MVP

- Rename the `Clip Code` tool direction to `Gyeol`.
- Rename the Patch node type direction from `Clip Code Block` to
  `Gyeol Score`.
- The feature should provide code-based music, sound design, sample composition,
  arrangement, and gesture modulation without depending on Strudel,
  Scribbletune, TidalCycles, Sonic Pi, or SuperCollider as runtime
  dependencies.
- User-facing Gyeol code should describe Hello Cam concepts:
  - score settings: BPM, meter, swing, tuning, transport, quantization
  - project audio assets: sample files, recorded clips, cached offline assets
  - instruments: synths, samplers, drum voices, gesture instruments
  - tracks: notes, chords, drums, samples, clips, automation, mutes, solos
  - scenes: cue state, section length, quantized transitions, snapshot recall
  - effects: gain, pan, filters, delay, room, echo, distortion, crush,
    compressor, tremolo, chorus, phaser, limiter
  - modulation: LFOs, envelopes, random, gesture mappings, audio analysis,
    MIDI/OSC/controller values
  - visual hooks: event triggers, color, pianoroll/punchcard, audio-reactive
    parameters
  - export: replay, baked clips, MIDI events, audio stems
- The Gyeol Score stores:
  - source code
  - parsed score AST
  - normalized event timeline
  - enabled state
  - master gain
  - tempo/BPM
  - meter
  - quantization grid
  - sample/instrument asset references
  - optional description
- First runtime approach:
  - parse Gyeol into Hello Cam's internal score/event model
  - use Web Audio directly for the minimal MVP voices
  - optionally use MIT/BSD-compatible libraries behind adapters for transport,
    scheduling, note names, scales, and effects
  - do not store third-party runtime objects or library-specific structures in
    project JSON
  - expose Play, Stop, Panic, Preload, and Bake controls
  - allow generated clips to be baked into the Loop Station for visual editing
- The intended live-coding feel is pattern-first and editable, but the grammar,
  runtime model, examples, and project format must be original to Gyeol.

#### Visual Runtime Foundation

- Treat render output as a graph of textures rather than a single shader.
- Add a frame graph abstraction for:
  - feedback textures
  - composite passes
  - blur and displacement
  - persistent render targets
  - resolution scale
- Keep WebGPU as primary and Canvas/WebGL-compatible fallback paths for basic
  preview.
- Add dropped-frame, shader compile, and GPU resource diagnostics.
- First implemented slice:
  - WebGPU shader uniforms now include `handCount`, `handMidX`, `handMidY`,
    `handSpan`, `handCloseness`, `handAngle`, `handPinch`, and `handGesture`
    alongside time, frame, size, and audio bands.
  - `handMidX` is mirrored to match the camera preview orientation.
  - `packages/ui/src/visualEffects.ts` defines original camera-reactive shader
    presets, including a two-hand warp/stretch effect and an audio/hand-driven
    pulse glitch effect.
  - Shader nodes can reference a preset by making the first line
    `// hello-cam:effect hand-warp-stretch` or
    `// hello-cam:effect pulse-glitch`.
  - Existing shader bodies remain valid because the new values are additive
    uniforms.

#### Performance Workflow

- Preserve the current Compose / Patch / Perform split.
- Add a performance dashboard:
  - active scene
  - audio engine state
  - camera/tracker state
  - loop station state
  - graph validity
  - panic button
- Add project portability checks:
  - missing media assets
  - missing model assets
  - missing external integration
  - incompatible project version

### P1: Usable Artist Workflow

- Face tracker:
  - face landmarks
  - head pose
  - mouth open
  - blink
  - expression/blendshape values
- Pose tracker:
  - body center
  - limb angles
  - shoulder/hip orientation
  - motion energy
- Person/background segmentation:
  - mask texture
  - foreground area
  - silhouette contour
- DAW-like sample editing:
  - waveform display
  - split clip
  - fade in/out
  - reverse
  - normalize gain
  - snap-to-grid trim
  - basic timeline lanes
- Pattern and sequencer features:
  - BPM
  - bar/beat grid
  - quantized clip launch
  - swing
  - probability
  - Euclidean rhythm
- External controls:
  - MIDI learn
  - Gamepad learn
  - keyboard shortcut mapping
  - OSC WebSocket-to-UDP bridge
  - mobile browser controller
- Projection mapping v1:
  - output slices
  - corner pin
  - crop
  - mask
  - test pattern
  - output presets
- Asset system:
  - audio buffers
  - image/video files
  - fonts
  - LUTs
  - glTF assets
  - relink/collect media
- Snapshots and presets:
  - save current parameter state
  - recall immediately
  - recall with fade
  - partial recall by parameter group

### P2: Advanced Performance And Ecosystem

- Ableton Link via a native/Electron companion bridge. Browser-only support is
  not a safe assumption.
- Gyeol advanced music engine:
  - audio-worklet scheduler
  - sample preload and cache manager
  - underrun/click detector
  - microtonal tuning tables
  - automatic sample slicing and pitch detection
  - time stretch and granular playback
  - stem routing and MIDI export
  - arrangement timeline export
- Advanced AudioWorklet DSP:
  - granular synthesis
  - phase vocoder/time stretch
  - custom loop engine
  - WASM DSP modules
- Advanced recording/export:
  - WebCodecs export path
  - image sequence export
  - alpha-capable render export
  - audio/video muxing strategy
- Multi-machine and installation support:
  - watchdog restart
  - network health
  - backup machine state mirror
  - schedule/idle scene
- Advanced projection:
  - camera-assisted calibration
  - multi-projector blend
  - model-based mapping
  - LED pixel mapping
  - DMX/Art-Net/sACN bridge
- Plugin/block SDK:
  - custom node package format
  - shader package
  - audio block
  - external bridge block
  - project-level capability manifest

### Immediate Backlog

The next implementation slice should be:

1. Hand Theremin 12-tone quantization and compact knob controls.
2. Loop Station MVP with multi-sample playback, trim, duplicate, copy, paste,
   delete, per-clip gain, and master gain.
3. Gyeol Score MVP with project-stored source, pattern parsing, basic synth and
   sampler playback, and a normalized event timeline.
4. Basic DAW dashboard layout for clips and selected-clip editing.
5. Project JSON additions for audio assets, clips, Gyeol score blocks, and baked
   pattern events.

## UI Layout

V1 app layout:

- Left: node library
- Center: graph canvas
- Right: parameter inspector
- Bottom: timeline/status/performance monitor
- Separate preview/output window

Important: the UI should be original. Do not copy another product's visual layout, color coding, node shapes, naming, palette organization, keyboard shortcuts, or icons.

## Milestones

### Milestone 1: Engine Skeleton

- Electron desktop shell
- Vite web shell
- Project model
- Node registry
- JSON save/load
- Simple graph evaluation
- Constant, Time, Range Map nodes

### Milestone 2: First Visual Output

- WebGPU preview
- Solid Color node
- Shader node
- Composite node
- Fullscreen output window

### Milestone 3: Camera And Audio

- Camera Input node
- Microphone Input node
- Audio analysis nodes
- Signal-to-parameter binding

### Milestone 4: Live Instrument And Loops

- Feedback visual node
- Particle Field node
- Hand Theremin quantization
- Compact instrument controls
- Loop Station MVP
- Sample trim, duplicate, copy, paste, and delete
- Keyboard/MIDI/OSC input
- Presets
- Movie recording

### Milestone 5: Gyeol Score And Performance Workflow

- Gyeol Score Block MVP
- Basic Gyeol parser behind Hello Cam's internal score/event model
- Built-in minimal synth, sampler, drum, chord, scale, and effects support
- Bake Gyeol patterns into Loop Station clips
- Scene/cue state model
- Macro/dashboard controls
- Snapshot recall
- Panic/blackout controls
- Project portability checks

### Milestone 6: Hardening

- Performance monitor
- Graph validation
- Missing device handling
- Crash-safe project autosave
- Example projects authored from scratch

## Testing Strategy

Unit tests:

- Graph topological sort
- Cycle detection
- Project save/load compatibility
- Parameter validation
- Signal math nodes

Integration tests:

- Camera unavailable fallback
- Audio unavailable fallback
- Shader compile failure reporting
- Fullscreen window creation

Performance tests:

- 60 FPS at 1280x720 on Apple Silicon baseline
- Audio analysis latency below one video frame where possible
- No unbounded texture allocation during graph evaluation

## Legal/IP Hygiene

Maintain an `IP_LOG.md` once implementation begins:

- Record sources used for each feature
- Prefer official platform specs
- Avoid screenshots or UI captures from proprietary tools
- Keep example projects original
- Use original node names and icons
- Document project file format publicly from day one

## Current Implementation Step

The repository now starts as a pnpm TypeScript monorepo:

1. `packages/core` owns project models, node definitions, graph validation, and evaluation.
2. `packages/audio` owns Web Audio microphone analysis.
3. `packages/render-webgpu` owns WebGPU shader rendering and render node definitions.
4. `packages/ui` owns the React/React Flow editor, inspector, preview, fullscreen, recording, and project actions.
5. `apps/desktop` owns Electron window/file IPC.
6. `apps/web` owns the browser demo entrypoint.
