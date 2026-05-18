import React, { useMemo, useState } from "react";
import { ApplyTranscriptEditCommand } from "@/commands";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { useTimelineStore } from "@/timeline/timeline-store";
import { WordSpan } from "./WordSpan";
import { EditPreviewPanel } from "./EditPreviewPanel";
import { GemmaChatPanel } from "./GemmaChatPanel";
import {
	planSelectionEdit,
	validateTranscript,
	type TranscriptEditPlan,
} from "./planner";
import { cn } from "@/utils/ui";

export function TranscriptPanel() {
	const editor = useEditor();
	const activeScene = useEditor((instance) =>
		instance.scenes.getActiveSceneOrNull(),
	);
	const rippleEditingEnabled = useTimelineStore(
		(state) => state.rippleEditingEnabled,
	);
	const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
	const [selectedWordIndices, setSelectedWordIndices] = useState<number[]>([]);
	const [hoveredWordIndex, setHoveredWordIndex] = useState<number | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [previewPlan, setPreviewPlan] = useState<TranscriptEditPlan | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [showChat, setShowChat] = useState(false);

	const transcript = activeScene?.transcript ?? null;
	const validation = useMemo(
		() => validateTranscript(transcript),
		[transcript],
	);

	const searchMatches = useMemo(() => {
		const matches = new Set<number>();
		if (!transcript || !searchQuery.trim()) return matches;
		const query = searchQuery.trim().toLowerCase();
		transcript.words.forEach((word) => {
			if (word.text.toLowerCase().includes(query)) {
				matches.add(word.wordIndex);
			}
		});
		return matches;
	}, [searchQuery, transcript]);

	if (!activeScene) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
				No active scene.
			</div>
		);
	}

	if (!transcript) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
				<p className="text-sm font-medium">No transcript available</p>
				<p className="max-w-64 text-xs text-muted-foreground">
					Generate a transcript from the Captions panel to enable text-based
					editing.
				</p>
			</div>
		);
	}

	if (!validation.valid) {
		return (
			<div className="flex h-full flex-col gap-3 p-4">
				<p className="text-sm font-medium text-destructive">
					Transcript cannot be edited
				</p>
				<div className="space-y-1 text-xs text-muted-foreground">
					{validation.errors.slice(0, 6).map((message) => (
						<p key={message}>{message}</p>
					))}
				</div>
			</div>
		);
	}

	const selected = new Set(selectedWordIndices);
	const editOperations = previewPlan
		? previewPlan.ranges.map((range, index) => ({
				id: `range-${index}`,
				type: "delete" as const,
				timeRange: range.timeRange,
				affectedWordIndices: range.wordIndices,
				affectedClipIds: previewPlan.cutPlan.affectedClipIds,
				deletedText: range.deletedText,
				preview: {
					deletedText: range.deletedText,
					timeRange: range.timeRange,
					durationRemoved: range.timeRange.end - range.timeRange.start,
					affectedClips: previewPlan.cutPlan.operations
						.filter((operation) =>
							rangesOverlap(operation.sourceTimeRange, range.timeRange),
						)
						.map((operation) => ({
							clipId: operation.clipId,
							clipName: operation.clipName,
							action: operation.operationType,
						})),
				},
			}))
		: [];

	return (
		<div className="flex h-full flex-col bg-background">
			<div className="border-b p-3">
				<div className="flex items-center gap-2">
					<input
						type="search"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder="Search transcript"
						className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
					/>
					<Button
						variant="secondary"
						size="sm"
						disabled={selectedWordIndices.length === 0}
						onClick={() => {
							try {
								setError(null);
								setPreviewPlan(
									planSelectionEdit({
										transcript,
										selectedWordIndices,
										tracks: activeScene.tracks,
										ripple: rippleEditingEnabled,
									}),
								);
							} catch (caught) {
								setError(
									caught instanceof Error
										? caught.message
										: "Could not plan transcript edit",
								);
							}
						}}
					>
						Delete
					</Button>
					<Button
						variant={showChat ? "default" : "outline"}
						size="sm"
						onClick={() => setShowChat(!showChat)}
					>
						{showChat ? "Editor" : "AI Chat"}
					</Button>
				</div>
				{error && <p className="mt-2 text-xs text-destructive">{error}</p>}
			</div>

			{showChat && transcript ? (
				<GemmaChatPanel
					transcript={transcript}
					videoDuration={transcript.videoDuration}
					onSuggestEdit={(suggestion) => {
						try {
							setError(null);
							const plan = planSelectionEdit({
								transcript,
								selectedWordIndices: transcript.words
									.map((w, i) => ({ word: w, index: i }))
									.filter(({ word }) => word.start >= suggestion.timeRange.start && word.end <= suggestion.timeRange.end)
									.map(({ index }) => index),
								tracks: activeScene.tracks,
								ripple: rippleEditingEnabled,
							});
							setPreviewPlan(plan);
						} catch (caught) {
							setError(
								caught instanceof Error
									? caught.message
									: "Could not plan AI suggestion",
							);
						}
					}}
				/>
			) : (
				<div className="flex-1 overflow-y-auto p-4 text-sm leading-7">
					{transcript.words.map((word) => (
						<React.Fragment key={word.wordIndex}>
							<WordSpan
								word={word}
								isSelected={selected.has(word.wordIndex)}
								isHovered={hoveredWordIndex === word.wordIndex}
								isHighlighted={searchMatches.has(word.wordIndex)}
								isDeleted={false}
								onWordHover={(nextWord) =>
									setHoveredWordIndex(nextWord?.wordIndex ?? null)
								}
								onWordClick={(clickedWord) => {
									setSelectedWordIndices([clickedWord.wordIndex]);
									setPreviewPlan(null);
								}}
								onSelectionStart={(startWord) => {
									setSelectionAnchor(startWord.wordIndex);
									setSelectedWordIndices([startWord.wordIndex]);
									setPreviewPlan(null);
								}}
								onSelectionEnd={(endWord) => {
									const start = selectionAnchor ?? endWord.wordIndex;
									const min = Math.min(start, endWord.wordIndex);
									const max = Math.max(start, endWord.wordIndex);
									setSelectedWordIndices(
										Array.from(
											{ length: max - min + 1 },
											(_, index) => min + index,
										),
									);
								}}
							/>{" "}
						</React.Fragment>
					))}
				</div>
			)}

			{previewPlan && (
				<EditPreviewPanel
					editOperations={editOperations}
					onCancel={() => setPreviewPlan(null)}
					onConfirm={() => {
						editor.command.execute({
							command: new ApplyTranscriptEditCommand({
								plan: previewPlan,
								ripple: rippleEditingEnabled,
							}),
						});
						setPreviewPlan(null);
						setSelectedWordIndices([]);
					}}
				/>
			)}
		</div>
	);
}

function rangesOverlap(
	a: { start: number; end: number },
	b: { start: number; end: number },
): boolean {
	return a.start < b.end && a.end > b.start;
}
