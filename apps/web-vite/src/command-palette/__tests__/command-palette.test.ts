import { describe, it, expect } from "bun:test";
import { commandRegistry, type Command } from "@/command-palette/registry";
import { fuzzyMatch, fuzzySort } from "@/command-palette/fuzzy-matcher";

describe("CommandRegistry (command-palette Task 1)", () => {
	it("Registers and retrieves commands", () => {
		const registry = new (commandRegistry.constructor as new () => typeof commandRegistry)();
		const cmd: Command = {
			id: "test-cmd",
			label: "Test Command",
			category: "test",
			action: () => {},
		};
		registry.register(cmd);
		expect(registry.get("test-cmd")).toBe(cmd);
	});

	it("Property: Search returns matching commands", () => {
		const registry = new (commandRegistry.constructor as new () => typeof commandRegistry)();
		const commands: Command[] = [
			{ id: "split", label: "Split Clip", category: "edit", action: () => {} },
			{ id: "delete", label: "Delete Clip", category: "edit", action: () => {} },
			{ id: "export", label: "Export Video", category: "file", action: () => {} },
		];
		for (const cmd of commands) registry.register(cmd);

		const results = registry.search("split");
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("split");
	});

	it("Returns all commands for empty search", () => {
		const registry = new (commandRegistry.constructor as new () => typeof commandRegistry)();
		registry.register({ id: "a", label: "A", category: "test", action: () => {} });
		registry.register({ id: "b", label: "B", category: "test", action: () => {} });
		expect(registry.search("")).toHaveLength(2);
	});

	it("Groups commands by category", () => {
		const registry = new (commandRegistry.constructor as new () => typeof commandRegistry)();
		registry.register({ id: "a", label: "A", category: "edit", action: () => {} });
		registry.register({ id: "b", label: "B", category: "file", action: () => {} });
		const grouped = registry.getByCategory();
		expect(grouped.get("edit")).toHaveLength(1);
		expect(grouped.get("file")).toHaveLength(1);
	});
});

describe("FuzzyMatcher (command-palette Task 2)", () => {
	it("Matches exact string", () => {
		const match = fuzzyMatch("hello", "hello");
		expect(match).not.toBeNull();
		expect(match!.score).toBeGreaterThan(0);
	});

	it("Matches substring", () => {
		const match = fuzzyMatch("ell", "hello");
		expect(match).not.toBeNull();
	});

	it("Matches non-consecutive characters", () => {
		const match = fuzzyMatch("hlo", "hello");
		expect(match).not.toBeNull();
	});

	it("Returns null for non-matching query", () => {
		const match = fuzzyMatch("xyz", "hello");
		expect(match).toBeNull();
	});

	it("Property: Case-insensitive matching", () => {
		for (let run = 0; run < 200; run++) {
			const words = ["Hello", "WORLD", "Test", "FooBar", "bazQUX"];
			const word = words[Math.floor(Math.random() * words.length)];
			const query = word.toLowerCase().slice(0, 3);
			const match = fuzzyMatch(query, word);
			expect(match).not.toBeNull();
		}
	});

	it("Property: Higher score for start-of-word matches", () => {
		const match1 = fuzzyMatch("sp", "split clip");
		const match2 = fuzzyMatch("sp", "clip split");
		expect(match1!.score).toBeGreaterThan(match2!.score);
	});

	it("Property: Higher score for consecutive matches", () => {
		const match1 = fuzzyMatch("spl", "split clip");
		const match2 = fuzzyMatch("sli", "split clip");
		expect(match1!.score).toBeGreaterThanOrEqual(match2!.score);
	});

	it("fuzzySort returns sorted results", () => {
		const items = ["split clip", "delete clip", "export video", "split audio"];
		const results = fuzzySort("split", items);
		expect(results.length).toBe(2);
		expect(results[0].item).toContain("split");
	});
});
