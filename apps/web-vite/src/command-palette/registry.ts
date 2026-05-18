export interface Command {
	id: string;
	label: string;
	description?: string;
	category: string;
	keybinding?: string;
	icon?: string;
	action: () => void;
}

class CommandRegistry {
	private commands = new Map<string, Command>();

	register(command: Command): void {
		this.commands.set(command.id, command);
	}

	unregister(id: string): void {
		this.commands.delete(id);
	}

	get(id: string): Command | undefined {
		return this.commands.get(id);
	}

	getAll(): Command[] {
		return Array.from(this.commands.values());
	}

	search(query: string): Command[] {
		if (!query.trim()) return this.getAll();
		const lower = query.toLowerCase();
		return this.getAll().filter(
			(cmd) =>
				cmd.label.toLowerCase().includes(lower) ||
				cmd.description?.toLowerCase().includes(lower) ||
				cmd.category.toLowerCase().includes(lower),
		);
	}

	getByCategory(): Map<string, Command[]> {
		const categories = new Map<string, Command[]>();
		for (const cmd of this.commands.values()) {
			const list = categories.get(cmd.category) || [];
			list.push(cmd);
			categories.set(cmd.category, list);
		}
		return categories;
	}
}

export const commandRegistry = new CommandRegistry();
