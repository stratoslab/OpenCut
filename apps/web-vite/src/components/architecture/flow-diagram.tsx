import { useRef, useEffect } from "react";
import type { Flow, ArchNode, PanOffset } from "./flow-viewer-types";
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  H_GAP,
  V_GAP,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_WHEEL_SENSITIVITY,
} from "./flow-viewer-types";

interface FlowDiagramProps {
  flow: Flow | null;
  nodes: Record<string, ArchNode>;
  zoom: number;
  pan: PanOffset;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onPanChange: (pan: PanOffset) => void;
  onZoomChange: (zoom: number) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

function computeNodePositions(flow: Flow): Record<string, NodePosition> {
  // 1. Extract unique node IDs in order of first appearance from flow.steps
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const step of flow.steps) {
    for (const id of [step.from, step.to]) {
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }

  // 2. Build depthMap: each node's depth = its index in the unique sequence
  const depthMap = new Map<string, number>();
  orderedIds.forEach((id, index) => depthMap.set(id, index));

  // 3. Track how many nodes share each depth to assign rows
  const rowMap = new Map<number, number>();

  const positions: Record<string, NodePosition> = {};
  for (const id of orderedIds) {
    const depth = depthMap.get(id)!;
    const row = rowMap.get(depth) ?? 0;
    rowMap.set(depth, row + 1);
    positions[id] = {
      x: depth * (NODE_WIDTH + H_GAP),
      y: row * (NODE_HEIGHT + V_GAP),
    };
  }

  return positions;
}

export function FlowDiagram({
  flow,
  nodes,
  zoom,
  pan,
  onZoomIn,
  onZoomOut,
  onResetView,
  onPanChange,
  onZoomChange,
}: FlowDiagramProps) {
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mirror zoom and pan into refs so the wheel handler always has fresh values
  // without needing to re-register the listener on every state change.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const onZoomChangeRef = useRef(onZoomChange);
  const onPanChangeRef = useRef(onPanChange);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  useEffect(() => {
    onPanChangeRef.current = onPanChange;
  }, [onPanChange]);

  // Attach wheel listener with { passive: false } so we can call preventDefault.
  // Registered once; reads fresh values via refs to avoid stale closures.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom + e.deltaY * -ZOOM_WHEEL_SENSITIVITY)
      );

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const newPanX =
        cursorX - (cursorX - currentPan.x) * (newZoom / currentZoom);
      const newPanY =
        cursorY - (cursorY - currentPan.y) * (newZoom / currentZoom);

      onZoomChangeRef.current(newZoom);
      onPanChangeRef.current({ x: newPanX, y: newPanY });
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []); // empty deps — handler reads fresh values via refs

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    onPanChange({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const stopDragging = () => {
    isDragging.current = false;
  };

  // Empty state
  if (flow === null) {
    return (
      <div
        ref={containerRef}
        data-testid="diagram-canvas"
        className="relative w-full h-full overflow-hidden"
        style={{ cursor: "grab" }}
      >
        <div className="flex items-center justify-center w-full h-full">
          <p className="text-neutral-400 text-sm">
            Select a workflow from the sidebar
          </p>
        </div>
        <ControlsOverlay
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetView={onResetView}
        />
      </div>
    );
  }

  const nodePositions = computeNodePositions(flow);
  const activeNodeIds = new Set(flow.steps.flatMap((s) => [s.from, s.to]));

  // Compute canvas size to size the SVG overlay (+100 padding on each axis)
  const allPositions = Object.values(nodePositions);
  const maxX =
    allPositions.length > 0 ? Math.max(...allPositions.map((p) => p.x)) : 0;
  const maxY =
    allPositions.length > 0 ? Math.max(...allPositions.map((p) => p.y)) : 0;
  const svgWidth = maxX + NODE_WIDTH + 100;
  const svgHeight = maxY + NODE_HEIGHT + 100;

  return (
    <div
      ref={containerRef}
      data-testid="diagram-canvas"
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDragging}
      onMouseLeave={stopDragging}
    >
      {/* Inner canvas with pan/zoom transform */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG edges overlay */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: svgWidth,
            height: svgHeight,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
            </marker>
          </defs>
          {flow.steps.map((step, i) => {
            const fromPos = nodePositions[step.from];
            const toPos = nodePositions[step.to];
            if (!fromPos || !toPos) return null;

            // Cubic bezier from center-right of `from` to center-left of `to`
            const fromX = fromPos.x + NODE_WIDTH;
            const fromY = fromPos.y + NODE_HEIGHT / 2;
            const toX = toPos.x;
            const toY = toPos.y + NODE_HEIGHT / 2;
            const d = `M ${fromX} ${fromY} C ${fromX + 60} ${fromY}, ${toX - 60} ${toY}, ${toX} ${toY}`;

            return (
              <path
                key={i}
                d={d}
                stroke="#4b5563"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </svg>

        {/* Node cards */}
        {Object.entries(nodePositions).map(([nodeId, { x, y }]) => {
          const node = nodes[nodeId];
          const isActive = activeNodeIds.has(nodeId);

          return (
            <div
              key={nodeId}
              data-testid={`node-${nodeId}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
              }}
              className={[
                "rounded-lg border text-center p-2 text-xs flex flex-col items-center justify-center gap-1 select-none",
                isActive
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-neutral-700 bg-neutral-900",
              ].join(" ")}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {node ? node.icon : "❓"}
              </span>
              <span className="leading-tight text-neutral-200 truncate w-full">
                {node ? node.label : `${nodeId}?`}
              </span>
            </div>
          );
        })}
      </div>

      <ControlsOverlay
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetView={onResetView}
      />
    </div>
  );
}

interface ControlsOverlayProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

function ControlsOverlay({
  onZoomIn,
  onZoomOut,
  onResetView,
}: ControlsOverlayProps) {
  return (
    <div className="absolute bottom-4 right-4 flex gap-1 z-10">
      <button
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="w-8 h-8 rounded border bg-neutral-900 border-neutral-700 text-white flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none hover:bg-neutral-800"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="w-8 h-8 rounded border bg-neutral-900 border-neutral-700 text-white flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none hover:bg-neutral-800"
      >
        −
      </button>
      <button
        onClick={onResetView}
        aria-label="Reset view"
        className="px-2 h-8 rounded border bg-neutral-900 border-neutral-700 text-white text-xs flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none hover:bg-neutral-800"
      >
        Reset
      </button>
    </div>
  );
}
