import type { Flow } from "./flow-viewer-types";

interface FlowSidebarProps {
  flows: Flow[];
  selectedFlowId: string | null;
  collapsedCategories: Set<string>;
  onSelectFlow: (flow: Flow) => void;
  onToggleCategory: (category: string) => void;
}

export function FlowSidebar({
  flows,
  selectedFlowId,
  collapsedCategories,
  onSelectFlow,
  onToggleCategory,
}: FlowSidebarProps) {
  // Group flows by category, preserving insertion order
  const categories = flows.reduce<Record<string, Flow[]>>((acc, flow) => {
    if (!acc[flow.category]) acc[flow.category] = [];
    acc[flow.category].push(flow);
    return acc;
  }, {});

  return (
    <aside className="h-full bg-neutral-950 border-r border-neutral-800 overflow-y-auto flex flex-col">
      <div className="px-3 py-4 border-b border-neutral-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Flows
        </h2>
      </div>

      <nav className="flex-1 py-2">
        {Object.entries(categories).map(([category, categoryFlows]) => {
          const isCollapsed = collapsedCategories.has(category);

          return (
            <div key={category} className="mb-1">
              {/* Category header button */}
              <button
                aria-expanded={!isCollapsed}
                aria-label={
                  isCollapsed
                    ? `Expand ${category} category`
                    : `Collapse ${category} category`
                }
                onClick={() => onToggleCategory(category)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none"
              >
                <span className="text-[10px] leading-none" aria-hidden="true">
                  {isCollapsed ? "▶" : "▼"}
                </span>
                <span>{category}</span>
              </button>

              {/* Flow items */}
              {!isCollapsed && (
                <ul className="mt-0.5">
                  {categoryFlows.map((flow) => {
                    const isSelected = flow.id === selectedFlowId;
                    return (
                      <li key={flow.id}>
                        <button
                          aria-label={`Select ${flow.label} flow`}
                          aria-pressed={isSelected}
                          data-testid={`flow-item-${flow.category}`}
                          onClick={() => onSelectFlow(flow)}
                          className={[
                            "w-full text-left px-4 py-2 text-sm transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none",
                            isSelected
                              ? "bg-blue-900/30 border-l-2 border-blue-500 text-blue-200"
                              : "border-l-2 border-transparent text-neutral-300 hover:bg-neutral-800/50 hover:text-neutral-100",
                          ].join(" ")}
                        >
                          {flow.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {flows.length === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500">No flows available</p>
        )}
      </nav>
    </aside>
  );
}
