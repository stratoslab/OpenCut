import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { commandRegistry } from "@/command-palette/registry";
import { fuzzyMatch } from "@/command-palette/fuzzy-matcher";
import { cn } from "@/utils/ui";

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const [search, setSearch] = useState("");

	const handleSelect = useCallback(
		(commandId: string) => {
			const cmd = commandRegistry.get(commandId);
			if (cmd) {
				cmd.action();
				onOpenChange(false);
				setSearch("");
			}
		},
		[onOpenChange],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
				e.preventDefault();
				onOpenChange(!open);
			}
			if (e.key === "Escape") {
				onOpenChange(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onOpenChange]);

	const commands = commandRegistry.getAll();
	const filtered = search
		? commands
				.map((cmd) => {
					const match = fuzzyMatch(search, cmd.label);
					return match ? { cmd, score: match.score } : null;
				})
				.filter(Boolean)
				.sort((a, b) => b!.score - a!.score)
				.map((r) => r!.cmd)
		: commands;

	const grouped = new Map<string, typeof commands>();
	for (const cmd of filtered) {
		const list = grouped.get(cmd.category) || [];
		list.push(cmd);
		grouped.set(cmd.category, list);
	}

	return (
		<Command.Dialog
			open={open}
			onOpenChange={onOpenChange}
			label="Command Palette"
			className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
		>
			<div
				className="fixed inset-0 bg-black/50"
				onClick={() => onOpenChange(false)}
			/>
			<div className="relative w-full max-w-lg bg-popover border rounded-lg shadow-lg overflow-hidden">
				<Command.Input
					value={search}
					onValueChange={setSearch}
					placeholder="Type a command..."
					className="w-full px-4 py-3 text-sm bg-transparent border-b outline-none placeholder:text-muted-foreground"
				/>
				<Command.List className="max-h-80 overflow-y-auto p-2">
					{Array.from(grouped.entries()).map(([category, cmds]) => (
						<Command.Group
							key={category}
							heading={
								<div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
									{category}
								</div>
							}
						>
							{cmds.map((cmd) => (
								<Command.Item
									key={cmd.id}
									value={cmd.id}
									onSelect={() => handleSelect(cmd.id)}
									className={cn(
										"flex items-center gap-3 px-3 py-2 rounded cursor-pointer select-none",
										"data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
									)}
								>
									{cmd.icon && (
										<span className="material-symbols-outlined text-sm">{cmd.icon}</span>
									)}
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium">{cmd.label}</div>
										{cmd.description && (
											<div className="text-[10px] text-muted-foreground truncate">
												{cmd.description}
											</div>
										)}
									</div>
									{cmd.keybinding && (
										<kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono">
											{cmd.keybinding}
										</kbd>
									)}
								</Command.Item>
							))}
						</Command.Group>
					))}
					{filtered.length === 0 && (
						<div className="px-4 py-8 text-center text-sm text-muted-foreground">
							No commands found
						</div>
					)}
				</Command.List>
			</div>
		</Command.Dialog>
	);
}
