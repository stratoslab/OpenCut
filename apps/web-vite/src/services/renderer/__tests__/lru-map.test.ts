import { describe, it, expect } from "bun:test";
import { LRUMap } from "../lru-map";

describe("LRUMap", () => {
	it("stores and retrieves values", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);
		map.set("c", 3);

		expect(map.get("a")).toBe(1);
		expect(map.get("b")).toBe(2);
		expect(map.get("c")).toBe(3);
	});

	it("evicts least recently used when full", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);
		map.set("c", 3);
		map.set("d", 4);

		expect(map.get("a")).toBeUndefined();
		expect(map.get("b")).toBe(2);
		expect(map.get("c")).toBe(3);
		expect(map.get("d")).toBe(4);
	});

	it("updates access order on get", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);
		map.set("c", 3);

		// Access 'a' to make it most recently used
		map.get("a");

		// Add 'd', should evict 'b' (now LRU)
		map.set("d", 4);

		expect(map.get("a")).toBe(1);
		expect(map.get("b")).toBeUndefined();
		expect(map.get("c")).toBe(3);
		expect(map.get("d")).toBe(4);
	});

	it("never exceeds max size", () => {
		const map = new LRUMap<string, number>(5);
		for (let i = 0; i < 100; i++) {
			map.set(`key-${i}`, i);
		}

		expect(map.size).toBe(5);
	});

	it("handles update of existing key", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("a", 2);

		expect(map.get("a")).toBe(2);
		expect(map.size).toBe(1);
	});

	it("deletes keys correctly", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);

		expect(map.delete("a")).toBe(true);
		expect(map.get("a")).toBeUndefined();
		expect(map.size).toBe(1);
	});

	it("returns false when deleting non-existent key", () => {
		const map = new LRUMap<string, number>(3);
		expect(map.delete("nonexistent")).toBe(false);
	});

	it("clears all entries", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);
		map.clear();

		expect(map.size).toBe(0);
		expect(map.get("a")).toBeUndefined();
	});

	it("has() works correctly", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);

		expect(map.has("a")).toBe(true);
		expect(map.has("b")).toBe(false);
	});

	it("returns keys in access order", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);
		map.set("c", 3);
		map.get("a");

		expect(map.keys()).toEqual(["b", "c", "a"]);
	});
});
