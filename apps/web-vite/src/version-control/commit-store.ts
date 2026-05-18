import type { TScene } from "@/timeline/types";

export interface Commit {
	id: string;
	message: string;
	timestamp: Date;
	sceneSnapshot: TScene;
	branch: string;
	parentId?: string;
}

export class CommitStore {
	private commits: Commit[] = [];
	private currentBranch = "main";
	private headCommitId: string | null = null;

	async createCommit(message: string, scene: TScene): Promise<Commit> {
		const commit: Commit = {
			id: crypto.randomUUID(),
			message,
			timestamp: new Date(),
			sceneSnapshot: structuredClone(scene),
			branch: this.currentBranch,
			parentId: this.headCommitId,
		};
		this.commits.push(commit);
		this.headCommitId = commit.id;
		return commit;
	}

	getCommits(branch?: string): Commit[] {
		const filtered = branch
			? this.commits.filter((c) => c.branch === branch)
			: this.commits;
		return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	getCommit(id: string): Commit | undefined {
		return this.commits.find((c) => c.id === id);
	}

	getBranches(): string[] {
		return [...new Set(this.commits.map((c) => c.branch))];
	}

	switchBranch(branch: string): void {
		const branchCommits = this.commits.filter((c) => c.branch === branch);
		this.currentBranch = branch;
		this.headCommitId = branchCommits.length > 0 ? branchCommits[0].id : null;
	}

	async createBranch(name: string): Promise<void> {
		this.currentBranch = name;
	}

	diff(commitId1: string, commitId2: string): { changes: string[] } {
		const c1 = this.getCommit(commitId1);
		const c2 = this.getCommit(commitId2);
		if (!c1 || !c2) return { changes: [] };

		const changes: string[] = [];
		if (c1.sceneSnapshot.name !== c2.sceneSnapshot.name) {
			changes.push(`Scene name: "${c1.sceneSnapshot.name}" → "${c2.sceneSnapshot.name}"`);
		}
		if (c1.sceneSnapshot.bookmarks.length !== c2.sceneSnapshot.bookmarks.length) {
			changes.push(`Bookmarks: ${c1.sceneSnapshot.bookmarks.length} → ${c2.sceneSnapshot.bookmarks.length}`);
		}
		return { changes };
	}
}

export const commitStore = new CommitStore();
