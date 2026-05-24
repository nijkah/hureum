/// <reference types="@webgpu/types" />

import {
  createShaderSource,
  defaultUniforms,
  shaderUniformBufferSize,
  type ShaderUniforms,
} from "./shaderTemplate";

export interface WebGpuRendererOptions {
  width?: number;
  height?: number;
}

export interface RenderInput {
  fragmentBody: string;
  uniforms: Partial<ShaderUniforms>;
  cameraVideo?: HTMLVideoElement | null;
}

export interface WebGpuRenderer {
  initialize(): Promise<void>;
  render(input: RenderInput): Promise<void>;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

export function createWebGpuRenderer(
  canvas: HTMLCanvasElement,
  options: WebGpuRendererOptions = {},
): WebGpuRenderer {
  return new BrowserWebGpuRenderer(canvas, options);
}

class BrowserWebGpuRenderer implements WebGpuRenderer {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private cameraTexture: GPUTexture | null = null;
  private feedbackTexture: GPUTexture | null = null;
  private currentShader = "";
  private size = { width: 1280, height: 720 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: WebGpuRendererOptions,
  ) {
    this.size = {
      width: options.width ?? 1280,
      height: options.height ?? 720,
    };
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not available in this runtime.");
    }

    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error("No compatible WebGPU adapter was found.");
    }

    this.device = await this.adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu");
    if (!this.context) {
      throw new Error("Could not create a WebGPU canvas context.");
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.configureCanvas();
    this.uniformBuffer = this.device.createBuffer({
      label: "Hello Cam shader uniforms",
      size: shaderUniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    this.cameraTexture = this.createFallbackCameraTexture();
  }

  async render(input: RenderInput): Promise<void> {
    if (!this.device || !this.context || !this.format) {
      await this.initialize();
    }
    const device = this.requireDevice();
    const context = this.requireContext();
    const format = this.requireFormat();

    if (!this.pipeline || this.currentShader !== input.fragmentBody) {
      await this.rebuildPipeline(input.fragmentBody, format);
    }

    this.updateCameraTexture(input.cameraVideo ?? null);
    const feedbackWasCreated = this.ensureFeedbackTexture();
    this.writeUniforms(input.uniforms);

    const currentTexture = context.getCurrentTexture();
    const encoder = device.createCommandEncoder({ label: "Hello Cam frame" });
    if (feedbackWasCreated) {
      const feedbackClearPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.requireFeedbackTexture().createView(),
            clearValue: { r: 0.02, g: 0.025, b: 0.03, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      feedbackClearPass.end();
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: { r: 0.02, g: 0.025, b: 0.03, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.requirePipeline());
    pass.setBindGroup(0, this.createBindGroup());
    pass.draw(3);
    pass.end();
    encoder.copyTextureToTexture(
      { texture: currentTexture },
      { texture: this.requireFeedbackTexture() },
      { width: this.canvas.width, height: this.canvas.height },
    );
    device.queue.submit([encoder.finish()]);
  }

  resize(width: number, height: number): void {
    this.size = {
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
    };
    this.configureCanvas();
  }

  dispose(): void {
    this.cameraTexture?.destroy();
    this.feedbackTexture?.destroy();
    this.uniformBuffer?.destroy();
    this.pipeline = null;
    this.cameraTexture = null;
    this.feedbackTexture = null;
    this.uniformBuffer = null;
  }

  private configureCanvas(): void {
    if (!this.context || !this.device || !this.format) {
      return;
    }
    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.size.width * pixelRatio);
    this.canvas.height = Math.floor(this.size.height * pixelRatio);
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
  }

  private async rebuildPipeline(
    fragmentBody: string,
    format: GPUTextureFormat,
  ): Promise<void> {
    const device = this.requireDevice();
    const shaderModule = device.createShaderModule({
      label: "Hello Cam WGSL shader",
      code: createShaderSource(fragmentBody),
    });
    const compilationInfo = await shaderModule.getCompilationInfo();
    const error = compilationInfo.messages.find(
      (message) => message.type === "error",
    );
    if (error) {
      throw new Error(`WGSL error: ${error.message}`);
    }

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });
    this.pipeline = device.createRenderPipeline({
      label: "Hello Cam shader pipeline",
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vs_main" },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
    this.currentShader = fragmentBody;
  }

  private updateCameraTexture(video: HTMLVideoElement | null): void {
    const device = this.requireDevice();
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    const width = Math.max(1, video.videoWidth);
    const height = Math.max(1, video.videoHeight);
    if (!this.cameraTexture || this.cameraTexture.width !== width || this.cameraTexture.height !== height) {
      this.cameraTexture?.destroy();
      this.cameraTexture = device.createTexture({
        label: "Hello Cam camera texture",
        size: { width, height },
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    device.queue.copyExternalImageToTexture(
      { source: video },
      { texture: this.requireCameraTexture() },
      { width, height },
    );
  }

  private writeUniforms(uniforms: Partial<ShaderUniforms>): void {
    const device = this.requireDevice();
    const values = { ...defaultUniforms, ...uniforms };
    values.width = this.canvas.width;
    values.height = this.canvas.height;
    device.queue.writeBuffer(
      this.requireUniformBuffer(),
      0,
      new Float32Array([
        values.time,
        values.level,
        values.bass,
        values.mid,
        values.treble,
        values.width,
        values.height,
        values.frame,
        values.handCount,
        values.handMidX,
        values.handMidY,
        values.handSpan,
        values.handCloseness,
        values.handAngle,
        values.handPinch,
        values.handGesture,
        values.cameraMirror,
      ]),
    );
  }

  private createBindGroup(): GPUBindGroup {
    const device = this.requireDevice();
    return device.createBindGroup({
      layout: this.requireBindGroupLayout(),
      entries: [
        { binding: 0, resource: { buffer: this.requireUniformBuffer() } },
        { binding: 1, resource: this.requireSampler() },
        { binding: 2, resource: this.requireCameraTexture().createView() },
        { binding: 3, resource: this.requireFeedbackTexture().createView() },
      ],
    });
  }

  private ensureFeedbackTexture(): boolean {
    const device = this.requireDevice();
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);
    if (
      this.feedbackTexture &&
      this.feedbackTexture.width === width &&
      this.feedbackTexture.height === height
    ) {
      return false;
    }

    this.feedbackTexture?.destroy();
    this.feedbackTexture = device.createTexture({
      label: "Hello Cam feedback texture",
      size: { width, height },
      format: this.requireFormat(),
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return true;
  }

  private createFallbackCameraTexture(): GPUTexture {
    const device = this.requireDevice();
    const texture = device.createTexture({
      label: "Hello Cam fallback camera texture",
      size: { width: 1, height: 1 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture },
      new Uint8Array([18, 24, 32, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 },
    );
    return texture;
  }

  private requireDevice(): GPUDevice {
    if (!this.device) {
      throw new Error("WebGPU device has not been initialized.");
    }
    return this.device;
  }

  private requireContext(): GPUCanvasContext {
    if (!this.context) {
      throw new Error("WebGPU context has not been initialized.");
    }
    return this.context;
  }

  private requireFormat(): GPUTextureFormat {
    if (!this.format) {
      throw new Error("WebGPU format has not been initialized.");
    }
    return this.format;
  }

  private requirePipeline(): GPURenderPipeline {
    if (!this.pipeline) {
      throw new Error("WebGPU pipeline has not been initialized.");
    }
    return this.pipeline;
  }

  private requireBindGroupLayout(): GPUBindGroupLayout {
    if (!this.bindGroupLayout) {
      throw new Error("WebGPU bind group layout has not been initialized.");
    }
    return this.bindGroupLayout;
  }

  private requireUniformBuffer(): GPUBuffer {
    if (!this.uniformBuffer) {
      throw new Error("WebGPU uniform buffer has not been initialized.");
    }
    return this.uniformBuffer;
  }

  private requireSampler(): GPUSampler {
    if (!this.sampler) {
      throw new Error("WebGPU sampler has not been initialized.");
    }
    return this.sampler;
  }

  private requireCameraTexture(): GPUTexture {
    if (!this.cameraTexture) {
      throw new Error("WebGPU camera texture has not been initialized.");
    }
    return this.cameraTexture;
  }

  private requireFeedbackTexture(): GPUTexture {
    if (!this.feedbackTexture) {
      throw new Error("WebGPU feedback texture has not been initialized.");
    }
    return this.feedbackTexture;
  }
}
