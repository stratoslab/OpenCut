import { describe, it, expect } from "bun:test";
import { commitStore, type Commit } from "@/version-control/commit-store";
import type { TScene } from "@/timeline/types";

function makeScene(id: string, name: string): TScene {
	return {
		id,
		name,
		isMain: true,
		tracks: { overlay: [], main: { id: "main", name: "Main", type: "video", elements: [], muted: false, hidden: false }, audio: [] },
		bookmarks: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe("CommitStore (version-control Task 1)", () => {
	it("Creates and retrieves commits", async () => {
		const store = new (commitStore.constructor as new () => typeof commitStore)();
		const scene = makeScene("1", "Test Scene");
		const commit = await store.createCommit("Initial commit", scene);

		expect(commit.message).toBe("Initial commit");
		expect(commit.sceneSnapshot).toBeDefined();

		const retrieved = store.getCommit(commit.id);
		expect(retrieved).toBeDefined();
		expect(retrieved?.message).toBe("Initial commit");
	});

	it("Property: Commits are sorted by timestamp descending", async () => {
		const store = new (commitStore.constructor as new () => typeof commitStore)();
		for (let i = 0; i < 10; i++) {
			await store.createCommit(`Commit ${i}`, makeScene(String(i), `Scene ${i}`));
		}

		const commits = store.getCommits();
		for (let i = 1; i < commits.length; i++) {
			expect(commits[i].timestamp.getTime()).toBeLessThanOrEqual(commits[i - 1].timestamp.getTime());
		}
	});

	it("Supports branching", async () => {
		const store = new (commitStore.constructor as new () => typeof commitStore)();
		await store.createCommit("Main commit", makeScene("1", "Main"));
		await store.createBranch("feature");
		await store.createCommit("Feature commit", makeScene("2", "Feature"));

		const mainCommits = store.getCommits("main");
		const featureCommits = store.getCommits("feature");
		expect(mainCommits).toHaveLength(1);
		expect(featureCommits).toHaveLength(1);
	});

	it("Computes diff between commits", async () => {
		const store = new (commitStore.constructor as new () => typeof commitStore)();
		const c1 = await store.createCommit("v1", makeScene("1", "Scene A"));
		const c2 = await store.createCommit("v2", makeScene("1", "Scene B"));

		const diff = store.diff(c1.id, c2.id);
		expect(diff.changes.length).toBeGreaterThan(0);
	});
});
