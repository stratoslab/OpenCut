"use client";

import { useState, useEffect, useCallback } from "react";
import type { ArchitectureData, Flow, PanOffset } from "./flow-viewer-types";
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  applyPanDelta,
  applyResetView,
} from "./flow-viewer-types";
import { FlowSidebar } from "./flow-sidebar";
import { FlowDiagram } from "./flow-diagram";
import { FlowDetail } from "./flow-detail";

interface FlowViewerProps {
  data: ArchitectureData;
}

export default function FlowViewer({ data }: FlowViewerProps) {
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [announcement, setAnnouncement] = useState<string>("");
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  // Inline useIsDesktop — 900px breakpoint (distinct from useIsMobile at 768px)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // aria-live announcement whenever selected flow changes
  useEffect(() => {
    setAnnouncement(selectedFlow ? `Selected flow: ${selectedFlow.label}` : "");
  }, [selectedFlow]);

  const handleSelectFlow = useCallback((flow: Flow) => {
    setSelectedFlow(flow);
  }, []);

  const handleToggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const handleResetView = useCallback(() => {
    const result = applyResetView(pan, zoom);
    setPan(result.pan);
    setZoom(result.zoom);
  }, [pan, zoom]);

  const handlePanChange = useCallback((newPan: PanOffset) => {
    setPan(newPan);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-neutral-950 text-neutral-100">
      {/* Visually hidden aria-live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isDesktop && (
          <div className="w-[280px] flex-shrink-0">
            <FlowSidebar
              flows={data.flows}
              selectedFlowId={selectedFlow?.id ?? null}
              collapsedCategories={collapsedCategories}
              onSelectFlow={handleSelectFlow}
              onToggleCategory={handleToggleCategory}
            />
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <FlowDiagram
            flow={selectedFlow}
            nodes={data.nodes}
            zoom={zoom}
            pan={pan}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetView={handleResetView}
            onPanChange={handlePanChange}
            onZoomChange={handleZoomChange}
          />
        </div>

        {isDesktop && (
          <div className="w-[320px] flex-shrink-0 border-l border-neutral-800">
            <FlowDetail flow={selectedFlow} version={data.version} />
          </div>
        )}
      </div>
    </div>
  );
}
