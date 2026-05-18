"use client";

import { useState, useEffect } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { commandHistoryManager, type CommandHistoryEntry } from "@/core/command-history";
import { UndoIcon, RedoIcon, Delete01Icon, FilterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

export function HistoryView() {
	const [entries, setEntries] = useState<CommandHistoryEntry[]>(commandHistoryManager.getHistory());
	const [currentIndex, setCurrentIndex] = useState(commandHistoryManager.getCurrentIndex());
	const [filter, setFilter] = useState<"all" | "undoable" | "redone">("all");

	useEffect(() => {
		const interval = setInterval(() => {
			setEntries(commandHistoryManager.getHistory());
			setCurrentIndex(commandHistoryManager.getCurrentIndex());
		}, 500);
		return () => clearInterval(interval);
	}, []);

	const handleUndo = () => {
		commandHistoryManager.undo();
		setEntries(commandHistoryManager.getHistory());
		setCurrentIndex(commandHistoryManager.getCurrentIndex());
	};

	const handleRedo = () => {
		commandHistoryManager.redo();
		setEntries(commandHistoryManager.getHistory());
		setCurrentIndex(commandHistoryManager.getCurrentIndex());
	};

	const handleClear = () => {
		commandHistoryManager.clear();
		setEntries([]);
		setCurrentIndex(-1);
	};

	const handleJumpTo = (index: number) => {
		commandHistoryManager.jumpToIndex(index);
		setCurrentIndex(commandHistoryManager.getCurrentIndex());
	};

	const filteredEntries = entries.filter((entry) => {
		if (filter === "undoable") return entry.undoable;
		if (filter === "redone") return entry.redone;
		return true;
	});

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
	};

	return (
		<PanelView
			title="History"
			actions={
				<div className="flex gap-1">
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handleUndo}
						disabled={!commandHistoryManager.canUndo()}
					>
						<HugeiconsIcon icon={UndoIcon} className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handleRedo}
						disabled={!commandHistoryManager.canRedo()}
					>
						<HugeiconsIcon icon={RedoIcon} className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handleClear}
					>
						<HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
					</Button>
				</div>
			}
		>
			<div className="flex h-full flex-col">
				<div className="flex gap-1 border-b p-2">
					{(["all", "undoable", "redone"] as const).map((f) => (
						<button
							key={f}
							onClick={() => setFilter(f)}
							className={cn(
								"flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-accent",
								filter === f ? "bg-accent text-foreground" : "text-muted-foreground"
							)}
						>
							<HugeiconsIcon icon={FilterIcon} className="size-3" />
							{f.charAt(0).toUpperCase() + f.slice(1)}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-y-auto">
					{filteredEntries.length === 0 && (
						<p className="text-muted-foreground p-4 text-center text-xs">
							No history entries
						</p>
					)}
					<div className="flex flex-col">
						{filteredEntries.map((entry, index) => {
							const originalIndex = entries.indexOf(entry);
							const isCurrent = originalIndex === currentIndex;
							const isPast = originalIndex <= currentIndex;

							return (
								<button
									key={entry.id}
									onClick={() => handleJumpTo(originalIndex)}
									className={cn(
										"flex items-center gap-2 border-b px-3 py-2 text-left text-xs hover:bg-accent",
										isCurrent && "bg-accent/50",
										!isPast && "opacity-50"
									)}
								>
									<div
										className={cn(
											"size-2 shrink-0 rounded-full",
											isPast ? "bg-primary" : "bg-muted"
										)}
									/>
									<div className="flex-1 min-w-0">
										<p className="truncate font-medium">{entry.commandName}</p>
										<p className="text-muted-foreground text-[10px]">
											{formatTime(entry.timestamp)}
										</p>
									</div>
									<div className="flex gap-1">
										{entry.undoable && (
											<span className="rounded bg-green-100 px-1 text-[10px] text-green-700 dark:bg-green-900 dark:text-green-300">
												undoable
											</span>
										)}
										{entry.redone && (
											<span className="rounded bg-blue-100 px-1 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-300">
												redone
											</span>
										)}
									</div>
								</button>
							);
						})}
					</div>
				</div>

				<div className="border-t p-2 text-center text-[10px] text-muted-foreground">
					{entries.length} entries · {currentIndex + 1} current
				</div>
			</div>
		</PanelView>
	);
}
