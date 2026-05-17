// Simple YAML frontmatter parser (browser-compatible, no gray-matter/Buffer dependency)
function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { data: {}, content };

	const rawYaml = match[1];
	const data: Record<string, unknown> = {};

	for (const line of rawYaml.split("\n")) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;
		const key = line.slice(0, colonIndex).trim();
		let value = line.slice(colonIndex + 1).trim();

		// remove quotes
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		// parse arrays like [new, fixed, improved]
		if (value.startsWith("[") && value.endsWith("]")) {
			const inner = value.slice(1, -1);
			value = inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")) as unknown as string;
		}

		// parse booleans
		if (value === "true") value = true as unknown as string;
		if (value === "false") value = false as unknown as string;

		data[key] = value;
	}

	return { data, content: match[2] };
}

const entries = import.meta.glob<true, string, string>("./entries/*.md", {
	query: "?raw",
	import: "default",
	eager: true,
});

export interface ChangelogEntry {
	version: string;
	date: string;
	published: boolean;
	title: string;
	description: string;
	summary: string;
	changes: { type: string; text: string }[];
	slug: string;
}

export type Change = { type: string; text: string };
export type Release = ChangelogEntry;

export const allChangelogs: ChangelogEntry[] = Object.entries(entries)
	.map(([path, content]) => {
		const { data } = parseFrontmatter(content as string);
		const slug = path.replace("./entries/", "").replace(".md", "");
		return {
			...(data as Omit<ChangelogEntry, "slug">),
			slug,
		};
	})
	.filter((entry): entry is ChangelogEntry => entry.published !== false && entry.version != null)
	.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

type ChangeSectionConfig = {
	title: string;
	order: number;
	collapsible?: boolean;
};

const knownSectionConfigs: Record<string, ChangeSectionConfig> = {
	new: { title: "Features", order: 0 },
	improved: { title: "Improvements", order: 1 },
	fixed: { title: "Fixes", order: 2 },
	breaking: { title: "Breaking Changes", order: 3 },
	technical: {
		title: "Technical details",
		order: 4,
		collapsible: true,
	},
};

function getSectionConfig({ type }: { type: string }): ChangeSectionConfig {
	return (
		knownSectionConfigs[type] ?? {
			title: type.charAt(0).toUpperCase() + type.slice(1),
			order: Number.MAX_SAFE_INTEGER,
		}
	);
}

export function getSectionTitle({ type }: { type: string }): string {
	return getSectionConfig({ type }).title;
}

export function isSectionCollapsible({ type }: { type: string }): boolean {
	return getSectionConfig({ type }).collapsible ?? false;
}

export function groupAndOrderChanges({ changes }: { changes: Change[] }) {
	const typeEncounterOrder = new Map<string, number>();
	const grouped = changes.reduce<Record<string, Change[]>>((acc, change) => {
		if (!typeEncounterOrder.has(change.type)) {
			typeEncounterOrder.set(change.type, typeEncounterOrder.size);
		}
		if (!acc[change.type]) acc[change.type] = [];
		acc[change.type].push(change);
		return acc;
	}, {});

	const orderedTypes = Object.keys(grouped).sort((left, right) => {
		const orderDifference =
			getSectionConfig({ type: left }).order -
			getSectionConfig({ type: right }).order;
		if (orderDifference !== 0) {
			return orderDifference;
		}
		return (
			(typeEncounterOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
			(typeEncounterOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
		);
	});

	return { grouped, orderedTypes };
}

function isPublishedRelease({ published }: Release) {
	return published !== false;
}

export function getSortedReleases() {
	return allChangelogs
		.filter(isPublishedRelease)
		.sort((a, b) =>
			b.version.localeCompare(a.version, undefined, { numeric: true }),
		);
}

export function getReleaseByVersion({ version }: { version: string }) {
	return getSortedReleases().find((release) => release.version === version);
}
