"use client";

import type { Flow } from "./flow-viewer-types";

interface FlowDetailProps {
  flow: Flow | null;
  version: string;
}

export function FlowDetail({ flow, version }: FlowDetailProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-4">
        <span
          data-testid="version-badge"
          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white"
        >
          v{version}
        </span>
      </div>

      {flow === null ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground text-sm text-center">
            Select a workflow from the sidebar
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{flow.label}</h2>
          <p className="text-muted-foreground text-sm">{flow.description}</p>
          <ol className="flex flex-col gap-3">
            {flow.steps.map((step, index) => (
              <li
                key={index}
                data-testid="flow-step"
                className="rounded border p-3 flex flex-col gap-1"
              >
                <div className="text-xs text-muted-foreground">
                  {step.from} → {step.to}
                </div>
                <div className="text-sm font-medium">{step.action}</div>
                <div className="text-xs text-muted-foreground font-mono break-all">
                  {step.data}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
