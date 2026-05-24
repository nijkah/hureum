export type PortType = "number" | "signal" | "texture" | "event";

export type ParameterValue =
  | string
  | number
  | boolean
  | null
  | ParameterValue[]
  | { [key: string]: ParameterValue };

export type ParameterRecord = Record<string, ParameterValue>;

export interface Point {
  x: number;
  y: number;
}

export interface ProjectNode {
  id: string;
  type: string;
  position: Point;
  parameters: ParameterRecord;
}

export interface ProjectPortRef {
  nodeId: string;
  portId: string;
}

export interface ProjectConnection {
  id: string;
  from: ProjectPortRef;
  to: ProjectPortRef;
}

export interface ProjectViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ProjectCameraCalibration {
  mirror: boolean;
  resolution: "640x360" | "1280x720" | "1920x1080";
  fps: 24 | 30 | 60;
}

export interface ProjectTrackingCalibration {
  handNear: number;
  handFar: number;
  handFar3d: number;
  smoothingMs: number;
  deadzone: number;
  triggerThreshold: number;
}

export interface ProjectCalibration {
  camera: ProjectCameraCalibration;
  tracking: ProjectTrackingCalibration;
}

export interface Project {
  format: "hello-cam-project";
  version: 1;
  nodes: ProjectNode[];
  connections: ProjectConnection[];
  viewport?: ProjectViewport;
  calibration?: ProjectCalibration;
  visualEffects?: string[];
}

export interface PortDefinition {
  id: string;
  label: string;
  type: PortType;
}

export interface ParameterDefinition {
  id: string;
  label: string;
  type: "number" | "text" | "textarea" | "boolean" | "select";
  defaultValue: ParameterValue;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface EvaluationContext {
  time: number;
  deltaTime: number;
  frame: number;
  external?: Record<string, unknown>;
}

export interface NodeEvaluationArgs {
  node: ProjectNode;
  inputs: Record<string, unknown>;
  context: EvaluationContext;
}

export interface NodeDefinition {
  type: string;
  label: string;
  category: "input" | "signal" | "visual" | "output";
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  parameters: ParameterDefinition[];
  evaluate?: (args: NodeEvaluationArgs) => Record<string, unknown>;
}

export interface ValidationIssue {
  code:
    | "duplicate-node-id"
    | "missing-node"
    | "missing-node-definition"
    | "missing-port"
    | "port-type-mismatch"
    | "cycle";
  message: string;
  nodeId?: string;
  connectionId?: string;
}

export interface EvaluationResult {
  order: string[];
  values: Record<string, Record<string, unknown>>;
  issues: ValidationIssue[];
}
