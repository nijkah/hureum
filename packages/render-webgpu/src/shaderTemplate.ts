export interface ShaderUniforms {
  time: number;
  level: number;
  bass: number;
  mid: number;
  treble: number;
  width: number;
  height: number;
  frame: number;
  handCount: number;
  handMidX: number;
  handMidY: number;
  handSpan: number;
  handCloseness: number;
  handAngle: number;
  handPinch: number;
  handGesture: number;
  cameraMirror: number;
}

export const shaderUniformFloatCount = 17;
export const shaderUniformBufferSize =
  shaderUniformFloatCount * Float32Array.BYTES_PER_ELEMENT;

export const defaultUniforms: ShaderUniforms = {
  time: 0,
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  width: 1280,
  height: 720,
  frame: 0,
  handCount: 0,
  handMidX: 0.5,
  handMidY: 0.5,
  handSpan: 0,
  handCloseness: 0,
  handAngle: 0,
  handPinch: 0,
  handGesture: 0,
  cameraMirror: 1,
};

export function createShaderSource(fragmentBody: string): string {
  return `
struct Params {
  time: f32,
  level: f32,
  bass: f32,
  mid: f32,
  treble: f32,
  width: f32,
  height: f32,
  frame: f32,
  handCount: f32,
  handMidX: f32,
  handMidY: f32,
  handSpan: f32,
  handCloseness: f32,
  handAngle: f32,
  handPinch: f32,
  handGesture: f32,
  cameraMirror: f32,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var cameraSampler: sampler;
@group(0) @binding(2) var cameraTexture: texture_2d<f32>;
@group(0) @binding(3) var feedbackTexture: texture_2d<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var output: VertexOut;
  output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  return output;
}

fn camera(uv: vec2<f32>) -> vec4<f32> {
  let safeUv = clamp(uv, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
  let x = select(safeUv.x, 1.0 - safeUv.x, params.cameraMirror > 0.5);
  return textureSample(cameraTexture, cameraSampler, vec2<f32>(x, safeUv.y));
}

fn previous(uv: vec2<f32>) -> vec4<f32> {
  let safeUv = clamp(uv, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0));
  return textureSample(feedbackTexture, cameraSampler, safeUv);
}

@fragment
fn fs_main(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = position.xy / vec2<f32>(max(params.width, 1.0), max(params.height, 1.0));
  ${fragmentBody}
}
`;
}
