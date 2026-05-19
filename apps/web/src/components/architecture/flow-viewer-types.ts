export interface ArchNode {
  id: string;
  label: string;
  type: string;
  icon: string;
  description: string;
  package?: string;
}

export interface FlowStep {
  from: string;
  to: string;
  action: string;
  data: string;
}

export interface Flow {
  id: string;
  label: string;
  category: string;
  description: string;
  steps: FlowStep[];
}

export interface ArchitectureData {
  version: string;
  description: string;
  nodes: Record<string, ArchNode>;
  flows: Flow[];
}

export interface PanOffset {
  x: number;
  y: number;
}

// Layout constants
export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 72;
export const H_GAP = 80;
export const V_GAP = 24;
export const DEFAULT_ZOOM = 1.0;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3.0;
export const ZOOM_STEP = 0.1;
export const ZOOM_WHEEL_SENSITIVITY = 0.001;

// Pure helper functions

/**
 * Returns a new PanOffset shifted by (dx, dy).
 */
export function applyPanDelta(
  pan: PanOffset,
  dx: number,
  dy: number
): PanOffset {
  return { x: pan.x + dx, y: pan.y + dy };
}

/**
 * Returns the default pan and zoom regardless of current values.
 */
export function applyResetView(
  _pan: PanOffset,
  _zoom: number
): { pan: PanOffset; zoom: number } {
  return { pan: { x: 0, y: 0 }, zoom: DEFAULT_ZOOM };
}
