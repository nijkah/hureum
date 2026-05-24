# Gyeol Package Plan

Date: 2026-05-24

Owner: Hello Cam

Target package: `@hello-cam/gyeol`

## Purpose

Gyeol is Hello Cam's clean-room live music and performance score package. It
replaces the current `Clip Code` implementation with a standalone TypeScript
package for:

- live-coded music patterns
- sample and synth playback
- chord, scale, voicing, and tuning utilities
- DAW-like clips, scenes, and arrangement state
- gesture/audio/MIDI/OSC modulation data
- visual event hooks for Hello Cam's renderer

Gyeol is intended to cover the practical role Strudel would otherwise play in
Hello Cam, but it must not embed Strudel, copy its runtime, copy its source, or
depend on AGPL code. Public live-coding systems are requirements input only.

## Clean-Room Boundary

Do not copy:

- Strudel, TidalCycles, Sonic Pi, SuperCollider, ChucK, Gibber, Sardine, Orca,
  or Max/MSP source code
- proprietary samples, examples, UI layouts, color systems, icons, docs, API
  names, or internal runtime structures
- Strudel's implementation details, parser source, runtime chain model, or
  grammar source

Allowed:

- independently designed TypeScript parser/compiler
- public music theory concepts: note names, scales, chords, MIDI note numbers,
  tuning systems, rhythm notation, Euclidean rhythm, swing, polymeter
- platform APIs: Web Audio, Web MIDI, Web Workers, IndexedDB, Fetch, WebCodecs
- permissive dependencies only if isolated behind adapters
- compatibility importers that translate user-provided Strudel-like snippets
  into Gyeol AST/events without executing Strudel code

Dependency policy:

- Core parser/compiler must have no runtime dependency on Strudel or AGPL code.
- Prefer zero dependencies for `@hello-cam/gyeol/core`.
- MIT/BSD/Apache utilities are acceptable only behind adapters.
- Do not store third-party object instances in Hello Cam project JSON.

## Product Position

Strudel is excellent for browser-first pattern coding. Gyeol should compete by
being broader in the dimensions Hello Cam needs:

- camera/gesture modulation is first-class
- sound design is part of the score, not only a sample trigger
- clip/timeline/scene concepts can be edited visually
- music and visual events share one transport
- browser reliability diagnostics are built in
- scores can be baked into clips, stems, MIDI events, and visual cues

Short positioning:

> Strudel is code-first cyclic music. Gyeol is a performance score for code,
> sound, gestures, clips, and visuals.

## Current State To Replace

Existing files:

- `packages/ui/src/clipCode.ts`
- `packages/ui/src/clipCodePlayer.ts`
- `packages/ui/src/musicNodes.ts`
- `packages/ui/src/App.tsx` Clip Code panel

Current capabilities:

- simple `tempo`, `sample`, `track` declarations
- pattern strings using `x` and `-`
- note/frequency options
- basic drums, synth, pluck, and generated fallback voices
- URL sample playback
- two hardcoded Strudel-like import paths:
  - Giant Steps example
  - URL sample stack example

New target:

- move parser/compiler/audio logic out of `packages/ui`
- create `packages/gyeol`
- rename UI/tool/node concepts from `Clip Code` to `Gyeol`
- use the new package from UI
- replace current ad-hoc parser with a real language pipeline

Existing Clip Code compatibility is intentionally out of scope. Existing
projects, if any, will be migrated manually and no Clip Code importer should be
added.

## Package Shape

Create:

```text
packages/gyeol/
  package.json
  tsconfig.json
  src/
    index.ts
    core/
      ast.ts
      diagnostics.ts
      lexer.ts
      parser.ts
      sourceMap.ts
      symbols.ts
    pattern/
      patternAst.ts
      patternParser.ts
      patternCompiler.ts
      transforms.ts
      euclid.ts
      humanize.ts
    theory/
      notes.ts
      scales.ts
      chords.ts
      voicing.ts
      tuning.ts
    compiler/
      compileScore.ts
      compileTrack.ts
      compileAutomation.ts
      eventModel.ts
      normalize.ts
    runtime/
      transport.ts
      scheduler.ts
      engine.ts
      sampleCache.ts
      diagnostics.ts
    audio/
      audioGraph.ts
      synths.ts
      sampler.ts
      drums.ts
      effects.ts
      limiter.ts
      workletScheduler.ts
    importers/
      strudelLikeImporter.ts
    fixtures/
      giantSteps.gyeol
      sampleStack.gyeol
    test/
      parser.test.ts
      pattern.test.ts
      theory.test.ts
      compiler.test.ts
      importer.test.ts
      scheduler.test.ts
```

Package exports:

```json
{
  "name": "@hello-cam/gyeol",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./core": {
      "types": "./src/core/index.ts",
      "import": "./src/core/index.ts"
    },
    "./runtime": {
      "types": "./src/runtime/index.ts",
      "import": "./src/runtime/index.ts"
    }
  }
}
```

Public API:

```ts
parseGyeol(source: string, options?: ParseOptions): GyeolParseResult;
compileGyeol(source: string, options?: CompileOptions): GyeolCompileResult;
compileGyeolAst(ast: GyeolScoreAst, options?: CompileOptions): GyeolCompileResult;
importStrudelLike(source: string): GyeolImportResult;
createGyeolEngine(options: GyeolEngineOptions): GyeolEngine;
renderGyeolTimeline(score: GyeolCompiledScore): GyeolTimeline;
```

Core package must be usable without React.

## Naming

User-facing:

- Tool: `Gyeol`
- Patch node: `Gyeol Score`
- Package: `@hello-cam/gyeol`
- Source extension: `.gyeol`
- Parsed model: `GyeolScore`
- Runtime engine: `GyeolEngine`

Avoid user-facing `Clip Code` after migration.

## Language Goals

Gyeol source should be:

- readable by non-programmers
- concise enough for live coding
- explicit enough for UI editing
- deterministic when given a seed
- safe to parse without `eval`
- compilable into timeline events
- compatible with visual editors such as pianoroll, clip lanes, automation
  lanes, waveform views, and event lists

Gyeol must not execute arbitrary JavaScript.

## Language Overview

Top-level concepts:

- `bpm`
- `meter`
- `swing`
- `tuning`
- `scale`
- `sample`
- `bank`
- `synth`
- `effect`
- `bus`
- `input`
- `map`
- `track`
- `scene`
- `view`
- `export`

Example:

```gyeol
bpm 128
meter 4/4
tuning 12edo A4 440

sample bass = url "https://cdn.example/bass.mp3" {
  cache local
  loop 8 bars
  clip 1
}

synth lead {
  osc saw
  filter lpf cutoff 1200 q .7
  env amp attack .005 decay .12 sustain 0 release .08
}

track melody color #F8E71C {
  note "0 1 2 3"
  scale Ab4 minor_pentatonic
  play lead
  cutoff sine 400..2000 slow 16
  gain .8
  decay perlin .05..0.2
  delay sine 0..0.5 slow 32
  degrade .4
  room 1
}

scene drop after 16 bars {
  launch quantized 4 bars
  unmute melody
  visual pulse audio.low
}

view pianoroll { fold 1 }
```

## Required Syntax

### Settings

```gyeol
bpm 120
meter 4/4
swing .56
tuning 12edo A4 440
seed 1234
scale D hirajoshi
```

Rules:

- `bpm` must be positive, default `120`.
- `meter` defaults to `4/4`.
- `swing` range is `0..1`, default `.5`.
- `tuning 12edo A4 440` is the default.
- `seed` controls random/probability/perlin decisions.

### Samples

```gyeol
sample kick = asset "kick"
sample bass = url "https://cdn.freesound.org/previews/614/614637_2434927-hq.mp3"
sample vocal = file "./media/vocal.wav" {
  cache local
  trim 0.2..3.8
  normalize true
  pitch auto
  slice transient
}
```

Requirements:

- Support `asset`, `url`, `file`, and future `recording`.
- URL samples must preload asynchronously.
- CORS/network failure must not crash the engine.
- Failed sample playback should emit a diagnostic and optionally use a generated
  fallback voice.
- Sample metadata should include duration, channels, sample rate, detected pitch,
  slice markers, waveform peaks, and cache status.

### Synths

```gyeol
synth bass {
  osc saw
  sub sine -12
  noise .05
  unison 3 detune .08
  filter lpf cutoff 900 q .8
  env amp attack .005 decay .12 sustain .42 release .18
  env filter attack .01 decay .18 sustain .2 release .1 amount 1200
  glide 60ms
  legato true
  retrigger false
  voices 8
}
```

Required synth modules:

- oscillators: `sine`, `triangle`, `saw`, `square`, `pulse`, `noise`, `custom`
- oscillator parameters: detune, phase, width for pulse, gain
- envelopes: amp, filter, pitch
- filters: lpf, hpf, bpf, notch
- distortion/waveshaper
- FM/AM minimal support
- glide/portamento
- mono/poly mode
- legato and retrigger policy

### Tracks

```gyeol
track drums {
  drum "bd*2, ~ sd, hh*4"
  gain .8
}

track chords color #7ED321 {
  chord "Abm7"
  struct "x(3,8,1)" slow 2
  voice lefthand
  mode below G4
  play poly
}

track lead {
  note "0 1 2 3"
  scale Ab4 minor_pentatonic
  superimpose transpose .1
  sometimes .5 transpose 12
  play sawtooth
}
```

Track-level controls:

- `mute true|false`
- `solo true|false`
- `gain`
- `pan`
- `color`
- `group`
- `bus`
- `quantize`
- `humanize`
- `microtime`
- `prob`
- `degrade`
- `swing`
- `fx`

### Scenes And Arrangement

```gyeol
scene intro length 8 bars {
  mute bass
  launch drums
}

scene drop after intro length 16 bars {
  unmute bass lead
  snapshot bright
}

cue next quantized 4 bars
```

Requirements:

- Scenes compile to transport ranges and cue actions.
- Scene transitions can be quantized.
- Scene state is visible to UI.
- Events should include scene id and bar/beat position.

### Modulation

```gyeol
lfo slowFilter = sine 400..2000 slow 16
rand decayRange = perlin .05..0.2

map hands.distance.xy -> lead.cutoff {
  range 20cm..100cm to 240..4200
  smooth 80ms
  curve exp
}

map face.mouthOpen -> delay.feedback {
  range 0..1 to 0..0.7
  deadzone .05
}
```

Modulation sources:

- `sine`, `tri`, `saw`, `square`, `random`, `perlin`, `sample_hold`
- `audio.rms`, `audio.low`, `audio.mid`, `audio.high`, `audio.transient`
- `hands.*`, `face.*`, `pose.*`
- `midi.cc`, `midi.note`, `osc`, `keyboard`, `mouse`, `gamepad`

Modulation destinations:

- instrument params
- track params
- effect params
- scene/cue params
- visual params

### Effects

```gyeol
fx {
  lpf 800 q .8
  delay .25 feedback .35 mix .4
  room .5 size .8
  crush .18
  compressor threshold -18 ratio 3
  limiter ceiling -.8
}
```

Required V1 effects:

- gain
- pan
- lpf/hpf/bpf
- delay/echo
- room/reverb
- distortion
- crush
- compressor
- limiter

P2 effects:

- chorus
- phaser
- flanger
- tremolo
- granular
- pitch shift
- time stretch

## Pattern Language

Gyeol needs its own mini pattern parser. It may resemble common musical text
notation, but its implementation and exact AST must be original.

Required pattern tokens:

```text
C4 D4 E4 F4           sequential events
~                     rest
-                     rest alias
[C4 E4 G4]            simultaneous note group in note context
[bd sd]               subdivided group in drum context unless marked as chord
<C4 E4 G4>            cycle choices
{C4 E4, D4 F4 A4}     polymeter lanes
C4*4                  repeat
C4@2                  duration extension
x(3,8,1)              Euclidean rhythm
```

Required transformations:

```gyeol
slow 2
fast 2
reverse
rotate 1
every 4 reverse
sometimes .5 transpose 12
degrade .4
prob .7
off .25 transpose 2
superimpose transpose .1
struct "x(3,8,1)"
```

Timing output:

- compile every pattern into events with:
  - `beat`
  - `durationBeats`
  - `cycle`
  - `bar`
  - `trackId`
  - `sourceRange`
  - `value`
  - `velocity`
  - `probability`
  - `humanizeOffset`
  - `microtime`

## Music Theory

Implement independent utilities:

```ts
noteNameToMidi("Ab4"): number
midiToFrequency(68, tuning): number
parseScale("Ab4 minor_pentatonic"): ScaleDefinition
parseChord("Abm7"): ChordDefinition
voiceChord(chord, { mode: "below", anchor: "G4", range: ["C3", "A4"] }): NoteName[]
quantizeNote(midi, scale): number
```

Required scales:

- chromatic
- major
- natural minor
- minor pentatonic
- major pentatonic
- dorian
- phrygian
- lydian
- mixolydian
- locrian
- hirajoshi

Required chord qualities:

- major
- minor
- dim
- aug
- sus2
- sus4
- 6
- m6
- 7
- maj7
- m7
- mMaj7
- dim7
- half-diminished
- 9
- m9
- maj9

Voicing modes:

- close
- open
- lefthand
- drop2
- below note
- above note
- nearest to anchor
- range constrained

## Event Model

Compiled score output should be stable JSON-compatible data.

```ts
export interface GyeolEvent {
  id: string;
  type: "note" | "chord" | "drum" | "sample" | "automation" | "visual" | "scene";
  trackId: string;
  sceneId: string | null;
  beat: number;
  durationBeats: number;
  cycle: number;
  value: GyeolEventValue;
  instrumentId: string | null;
  sampleId: string | null;
  gain: number;
  pan: number;
  velocity: number;
  probability: number;
  params: Record<string, GyeolParamValue>;
  sourceRange: GyeolSourceRange;
}
```

Compiled score:

```ts
export interface GyeolCompiledScore {
  version: 1;
  sourceHash: string;
  settings: GyeolSettings;
  samples: GyeolSampleDefinition[];
  instruments: GyeolInstrumentDefinition[];
  tracks: GyeolTrackDefinition[];
  scenes: GyeolSceneDefinition[];
  buses: GyeolBusDefinition[];
  events: GyeolEvent[];
  diagnostics: GyeolDiagnostic[];
}
```

Diagnostics:

- line
- column
- severity: `error | warning | info`
- code
- message
- source excerpt
- suggested fix when possible

## Runtime Engine

Runtime responsibilities:

- preload samples
- create Web Audio graph
- schedule events with lookahead
- expose transport state
- expose active event state for UI
- report underruns/clicks/voice counts
- panic mute immediately
- stop and dispose safely

Public runtime API:

```ts
interface GyeolEngine {
  load(score: GyeolCompiledScore): Promise<GyeolLoadResult>;
  play(options?: PlayOptions): Promise<void>;
  pause(): void;
  stop(): void;
  panic(): void;
  setBpm(bpm: number): void;
  setMasterGain(gain: number): void;
  trigger(event: GyeolEvent): void;
  getState(): GyeolEngineState;
  subscribe(listener: GyeolEngineListener): () => void;
  dispose(): Promise<void>;
}
```

Scheduler:

- use Web Audio `currentTime` as audio clock
- default lookahead interval: `25ms`
- default schedule-ahead time: `150ms`
- never block scheduling on UI rendering
- support deterministic event ordering
- support loop boundaries
- support tempo changes at bar boundaries
- P1: AudioWorklet scheduler option for tighter timing

Audio graph:

- master gain
- safety limiter
- per-track gain/pan
- bus routing
- send effects
- synth voices
- sampler voices
- drum voices
- reverb/delay shared sends
- click/underrun diagnostic probe

Sample cache:

- in-memory `AudioBuffer` cache
- optional IndexedDB cache for URL samples
- decode status
- waveform peak generation
- failure diagnostics

## Required Strudel-Like Import Support

This is not a Strudel runtime. It is a migration/import feature.

Implement:

```ts
importStrudelLike(source: string): GyeolImportResult
```

Behavior:

- no `eval`
- no execution of user JavaScript
- recognize a limited expression subset with a purpose-built parser
- translate recognized forms into Gyeol source and/or AST
- return diagnostics for unsupported forms
- preserve user-facing intent where possible

Minimum supported forms:

```text
samples({ ... })
setVoicingRange(name, [low, high])
stack(...)
s("...")
s('sample')
note("...")
chord("...")
seq(...)
.note()
.chord()
.s(name)
.gain(n)
.delay(n or modulation)
.room(n)
.cutoff(modulation)
.decay(modulation)
.sustain(n)
.clip(n)
.loopAt(beats)
.slow(n)
.fast(n)
.scale(name)
.dict(name)
.voicing()
.mode("below:G4")
.struct(pattern)
.sometimes(...)
.superimpose(...)
.degradeBy(n)
.color(hex)
.pianoroll(...)
```

The importer must support these exact user examples:

1. Giant Steps sketch:

```js
// John Coltrane - Giant Steps

let melody = seq(
  "[F#5 D5] [B4 G4] Bb4 [B4 A4]",
  "[D5 Bb4] [G4 Eb4] F#4 [G4 F4]",
  "Bb4 [B4 A4] D5 [D#5 C#5]",
  "F#5 [G5 F5] Bb5 [F#5 F#5]",
).note()

stack(
  melody.color('#F8E71C'),
  seq(
    "[B^7 D7] [G^7 Bb7] Eb^7 [Am7 D7]",
    "[G^7 Bb7] [Eb^7 F#7] B^7 [Fm7 Bb7]",
    "Eb^7 [Am7 D7] G^7 [C#m7 F#7]",
    "B^7 [Fm7 Bb7] Eb^7 [C#m7 F#7]"
  ).chord().dict('lefthand')
  .anchor(melody).mode('duck')
  .voicing().color('#7ED321'),
  seq(
    "[B2 D2] [G2 Bb2] [Eb2 Bb3] [A2 D2]",
    "[G2 Bb2] [Eb2 F#2] [B2 F#2] [F2 Bb2]",
    "[Eb2 Bb2] [A2 D2] [G2 D2] [C#2 F#2]",
    "[B2 F#2] [F2 Bb2] [Eb2 Bb3] [C#2 F#2]"
  ).note().color('#00B8D4')
).slow(20)
.pianoroll({fold:1})
```

2. URL sample stack sketch:

```js
samples({bass:'https://cdn.freesound.org/previews/614/614637_2434927-hq.mp3',
dino:{b4:'https://cdn.freesound.org/previews/316/316403_5123851-hq.mp3'}})
setVoicingRange('lefthand', ['c3','a4'])

stack(
s('bass').loopAt(8).clip(1),
s("bd*2, ~ sd,hh*4"),
chord("Abm7")
  .mode("below:G4")
  .dict('lefthand')
  .voicing()
  .struct("x(3,8,1)".slow(2)),
"0 1 2 3".scale('ab4 minor pentatonic')
.superimpose(x=>x.add(.1))
.sometimes(x=>x.add(12))
.note().s('sawtooth')
.cutoff(sine.range(400,2000).slow(16)).gain(.8)
.decay(perlin.range(.05,.2)).sustain(0)
.delay(sine.range(0,.5).slow(32))
.degradeBy(.4).room(1),
note("<b4 eb4>").s('dino').delay(.8).slow(8).room(.5)
)
```

Importer acceptance:

- both examples compile with zero `error` diagnostics
- resulting scores are playable without external Strudel runtime
- unsupported syntax returns warnings, not silent miscompilation
- importer output can be displayed as Gyeol source for user editing

## Gyeol Equivalents For Required Examples

### Giant Steps

```gyeol
bpm 92

synth lead { osc saw filter lpf cutoff 1400 env amp attack .01 decay .28 sustain .05 release .08 }
synth chord { osc saw filter lpf cutoff 1200 env amp attack .01 decay .34 sustain .1 release .1 voices 8 }
synth bass { osc triangle env amp attack .005 decay .22 sustain .2 release .08 }

track melody color #F8E71C {
  note "[F#5 D5] [B4 G4] Bb4 [B4 A4]"
  note "[D5 Bb4] [G4 Eb4] F#4 [G4 F4]"
  note "Bb4 [B4 A4] D5 [D#5 C#5]"
  note "F#5 [G5 F5] Bb5 [F#5 F#5]"
  play lead
}

track chords color #7ED321 {
  chord "[Bmaj7 D7] [Gmaj7 Bb7] Ebmaj7 [Am7 D7]"
  chord "[Gmaj7 Bb7] [Ebmaj7 F#7] Bmaj7 [Fm7 Bb7]"
  chord "Ebmaj7 [Am7 D7] Gmaj7 [C#m7 F#7]"
  chord "Bmaj7 [Fm7 Bb7] Ebmaj7 [C#m7 F#7]"
  voice lefthand
  anchor melody
  mode duck
  play chord
}

track bass color #00B8D4 {
  note "[B2 D2] [G2 Bb2] [Eb2 Bb3] [A2 D2]"
  note "[G2 Bb2] [Eb2 F#2] [B2 F#2] [F2 Bb2]"
  note "[Eb2 Bb2] [A2 D2] [G2 D2] [C#2 F#2]"
  note "[B2 F#2] [F2 Bb2] [Eb2 Bb3] [C#2 F#2]"
  play bass
}

slow 20
view pianoroll { fold 1 }
```

### URL Sample Stack

```gyeol
bpm 128

sample bass = url "https://cdn.freesound.org/previews/614/614637_2434927-hq.mp3" {
  loop 8 bars
  clip 1
}

sample dino.b4 = url "https://cdn.freesound.org/previews/316/316403_5123851-hq.mp3" {
  root B4
}

synth sawtooth {
  osc saw
  filter lpf cutoff 1200
  env amp attack .005 decay .12 sustain 0 release .06
}

voicing lefthand range C3..A4

track bassLoop {
  play bass
}

track drums {
  drum "bd*2, ~ sd, hh*4"
}

track harmony {
  chord "Abm7"
  mode below G4
  voice lefthand
  struct "x(3,8,1)" slow 2
  play sawtooth
}

track lead {
  note "0 1 2 3"
  scale Ab4 minor_pentatonic
  superimpose transpose .1
  sometimes .5 transpose 12
  play sawtooth
  cutoff sine 400..2000 slow 16
  gain .8
  decay perlin .05..0.2
  sustain 0
  delay sine 0..0.5 slow 32
  degrade .4
  room 1
}

track dino {
  note "<B4 Eb4>"
  play dino.b4
  delay .8
  slow 8
  room .5
}
```

## UI Integration Requirements

Replace:

- `Clip Code` tool label -> `Gyeol`
- `Clip Code Block` node -> `Gyeol Score`
- `music.clipCode` node type -> `music.gyeolScore`
- `clipCode.ts` parser -> `@hello-cam/gyeol`
- `clipCodePlayer.ts` player -> `createGyeolEngine`

Panel requirements:

- Play / Stop / Panic
- Preload
- Bake to Loop Station
- Load sample: Giant Steps
- Load sample: URL Sample Stack
- diagnostics list with line/column
- event preview
- active event highlight
- pianoroll preview placeholder
- master gain
- tempo display
- track count/event count

Patch node outputs:

- `tempo: number`
- `eventCount: number`
- `diagnosticCount: number`
- `events: event`
- `transport: signal`
- `audioEnergy: signal`
- `visualEvents: event`

Project JSON:

```json
{
  "id": "gyeol_1",
  "type": "music.gyeolScore",
  "parameters": {
    "source": "...",
    "enabled": true,
    "masterGain": 0.82,
    "preload": true
  }
}
```

## Implementation Phases

### Phase 1: Package Scaffold

- Add `packages/gyeol`.
- Add package scripts: `build`, `typecheck`, `test`, `lint`.
- Export public API stubs.
- Add tests with no implementation skipped only where necessary.
- Add fixtures for required examples.

Acceptance:

- `pnpm --filter @hello-cam/gyeol typecheck`
- `pnpm --filter @hello-cam/gyeol test`
- `pnpm -r build`

### Phase 2: Parser And AST

- Implement lexer with source ranges.
- Implement top-level parser.
- Implement diagnostics.
- Implement AST types.
- Parse settings, sample, synth, track, scene, map, view.
- No Web Audio dependency in parser.

Acceptance:

- parses valid fixtures
- returns helpful diagnostics for invalid input
- no `eval`, `Function`, or dynamic code execution

### Phase 3: Pattern Compiler

- Implement pattern parser.
- Implement pattern transforms.
- Implement Euclidean rhythm.
- Implement cycle choices and polymeter.
- Compile patterns into beat events.

Acceptance:

- `bd*2, ~ sd, hh*4` produces expected drum events
- `x(3,8,1)` produces three pulses over eight steps with rotation
- `<B4 Eb4>` alternates across cycles
- `[F#5 D5]` produces simultaneous note group

### Phase 4: Theory Engine

- Implement notes, scales, chords, voicing, tuning.
- Support required scales and chord qualities.
- Support `mode below G4` and `voicing lefthand range C3..A4`.

Acceptance:

- `Abm7` voices below `G4` inside `C3..A4`
- Giant Steps chords compile without errors
- `Ab4 minor_pentatonic` maps degrees `0 1 2 3`

### Phase 5: Compiler

- Compile AST to `GyeolCompiledScore`.
- Normalize samples, instruments, tracks, effects, maps, scenes.
- Emit stable event ids.
- Include source ranges on events.

Acceptance:

- required fixtures compile with zero error diagnostics
- compiled output is JSON-serializable
- no third-party runtime objects in compiled score

### Phase 6: Runtime Engine

- Implement Web Audio engine.
- Implement sampler, synths, drums, shared delay/reverb, limiter.
- Implement transport and scheduler.
- Implement sample preload and fallback diagnostics.
- Implement `panic`.

Acceptance:

- both required examples can play
- sample URL failure does not crash playback
- stop disposes scheduled UI timers and audio nodes safely
- panic mutes immediately

### Phase 7: Importers

- Implement limited `importStrudelLike`.
- Importer should produce Gyeol source and diagnostics.

Acceptance:

- Giant Steps example imports
- URL sample stack example imports
- unsupported syntax is reported clearly

### Phase 8: UI Migration

- Replace UI imports with `@hello-cam/gyeol`.
- Rename tool and node labels.
- Add `music.gyeolScore`.
- Update GraphEditor icon mapping if needed.
- Remove old parser/player from UI once unused.

Acceptance:

- UI still opens
- Gyeol panel plays examples
- Patch node reports event/diagnostic counts
- old `Clip Code` strings are gone from user-facing UI unless in migration docs

### Phase 9: Hardening

- Add scheduler diagnostics.
- Add voice count meter.
- Add preload status.
- Add parser source map tests.
- Add performance tests for large patterns.

Acceptance:

- 1,000 events compile under 50ms on baseline dev machine
- playback scheduler does not duplicate events across loop boundaries
- no unbounded growth in sample cache or scheduled timers

## Testing Matrix

Unit tests:

- lexer
- parser
- diagnostics
- pattern parsing
- pattern transforms
- Euclidean rhythm
- note conversion
- scale degree conversion
- chord parsing
- voicing
- compiler normalization
- importer recognition

Integration tests:

- Giant Steps fixture parse/compile
- URL sample stack fixture parse/compile
- engine play/stop with fake or mocked AudioContext
- sample load failure fallback
- panic mute

Snapshot tests:

- AST snapshots for fixtures
- compiled event timeline snapshots
- diagnostics snapshots for invalid examples

Manual browser tests:

- Play Giant Steps sample
- Play URL sample stack sample
- Disconnect network and verify fallback
- Start/stop repeatedly
- Change source while playing
- Panic during delay/reverb tail

## Definition Of Done

The Gyeol package is ready when:

- `packages/gyeol` exists and is consumed by UI.
- `Clip Code` parser/player logic no longer lives in UI.
- User-facing UI says `Gyeol`.
- Required examples compile with zero error diagnostics.
- Required examples are playable without Strudel.
- URL samples preload or fail gracefully.
- Parsed events include source ranges for UI highlighting.
- Pattern, theory, compiler, and runtime have tests.
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, and `pnpm -r build`
  pass.

## Out Of Scope For First Implementation

- full Strudel source compatibility
- arbitrary JavaScript execution
- full DAW timeline editor
- full sample time stretching
- full granular engine
- Ableton Link native bridge
- OSC UDP bridge
- audio stem rendering
- MIDI file export
- multi-output audio routing

These should be designed into the data model but can be P1/P2.

## Notes For Implementing Agent

- Keep edits small and package-oriented.
- Build `@hello-cam/gyeol` first, then migrate UI.
- Do not rewrite unrelated visual/camera systems.
- Prefer pure functions for parser/compiler/theory.
- Keep Web Audio code isolated under `runtime` and `audio`.
- Do not make React a dependency of `@hello-cam/gyeol`.
- Do not use network during tests.
- Fixtures must be original or user-provided.
- Update `CLEAN_ROOM_DESIGN.md` only after the implementation proves out.
