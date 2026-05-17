import { BasePage } from "@/app/base-page";
import { Separator } from "@/components/ui/separator";
import {
	type Release as ReleaseType,
	getSortedReleases,
} from "@/changelog/utils";
import {
	ReleaseArticle,
	ReleaseMeta,
	ReleaseTitle,
	ReleaseDescription,
	ReleaseChanges,
} from "@/changelog/components/release";

export default function ChangelogPage() {
	const releases = getSortedReleases();

	return (
		<BasePage>
			<div className="mx-auto w-full max-w-3xl flex flex-col gap-12">
				<header className="flex flex-col gap-4">
					<h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
					<p className="text-muted-foreground">
						Every update, improvement, and fix to OpenCut — documented.
					</p>
				</header>
				<Separator />
				<div className="flex flex-col gap-8">
					{releases.map((release, index) => (
						<ReleaseEntry key={release.version} release={release} isLatest={index === 0} />
					))}
				</div>
			</div>
		</BasePage>
	);
}

function ReleaseEntry({ release, isLatest }: { release: ReleaseType; isLatest: boolean }) {
	return (
		<ReleaseArticle variant="list" isLatest={isLatest}>
			<ReleaseMeta release={release} />
			<div className="flex flex-col gap-4">
				<ReleaseTitle as="h2" href={`/changelog/${release.version}`}>
					{release.title}
				</ReleaseTitle>
				{release.description && (
					<ReleaseDescription>{release.description}</ReleaseDescription>
				)}
			</div>
			<ReleaseChanges release={release} />
		</ReleaseArticle>
	);
}
