import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { WordSegment, WordTranscript } from "@/transcription/types";
import { WordSpan } from "./WordSpan";
import { EditPreviewPanel } from "./EditPreviewPanel";
import { GemmaChatPanel } from "./GemmaChatPanel";
import { cn } from "@/utils/ui";

interface TranscriptEditorProps {
	transcript: WordTranscript | null;
	isLoading: boolean;
	error: string | null;
	onWordHover: (word: WordSegment | null) => void;
	onWordClick: (word: WordSegment) => void;
	onTextEdit: (deletedRanges: { start: number; end: number; text: string }[]) => void;
	onRetry: () => void;
}

interface SelectionRange {
	startIndex: number;
	endIndex: number;
	deletedText: string;
	timeRange: { start: number; end: number };
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
	transcript,
	isLoading,
	error,
	onWordHover,
	onWordClick,
	onTextEdit,
	onRetry,
}) => {
	const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());
	const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
	const [showPreview, setShowPreview] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [showChat, setShowChat] = useState(false);
	const [deletedWordIndices, setDeletedWordIndices] = useState<Set<number>>(new Set());

	const selectionStartRef = useRef<number | null>(null);

	const handleSelectionStart = useCallback((word: WordSegment) => {
		selectionStartRef.current = word.wordIndex;
	}, []);

	const handleSelectionEnd = useCallback((word: WordSegment) => {
		if (selectionStartRef.current === null) return;

		const start = Math.min(selectionStartRef.current, word.wordIndex);
		const end = Math.max(selectionStartRef.current, word.wordIndex);

		if (start === end) {
			setSelectedWords(new Set());
			setSelectionRange(null);
			return;
		}

		const selected = new Set<number>();
		const words: string[] = [];
		let minTime = Infinity;
		let maxTime = -Infinity;

		if (transcript) {
			for (let i = start; i <= end; i++) {
				const w = transcript.words[i];
				if (w && !deletedWordIndices.has(i)) {
					selected.add(i);
					words.push(w.text);
					minTime = Math.min(minTime, w.start);
					maxTime = Math.max(maxTime, w.end);
				}
			}
		}

		setSelectedWords(selected);
		setSelectionRange({
			startIndex: start,
			endIndex: end,
			deletedText: words.join(" "),
			timeRange: {
				start: minTime === Infinity ? 0 : minTime,
				end: maxTime === -Infinity ? 0 : maxTime,
			},
		});
	}, [transcript, deletedWordIndices]);

	const handleConfirmDelete = useCallback(() => {
		if (!selectionRange) return;

		onTextEdit([
			{
				start: selectionRange.timeRange.start,
				end: selectionRange.timeRange.end,
				text: selectionRange.deletedText,
			},
		]);

		const newDeleted = new Set(deletedWordIndices);
		for (let i = selectionRange.startIndex; i <= selectionRange.endIndex; i++) {
			newDeleted.add(i);
		}
		setDeletedWordIndices(newDeleted);

		setSelectedWords(new Set());
		setSelectionRange(null);
		setShowPreview(false);
	}, [selectionRange, onTextEdit, deletedWordIndices]);

	const handleCancelDelete = useCallback(() => {
		setSelectedWords(new Set());
		setSelectionRange(null);
		setShowPreview(false);
	}, []);

	const handlePreviewOpen = useCallback(() => {
		if (selectionRange && selectionRange.deletedText.length > 0) {
			setShowPreview(true);
		}
	}, [selectionRange]);

	const highlightedWords = useMemo(() => {
		if (!searchQuery) return new Set<number>();
		const highlighted = new Set<number>();
		if (!transcript) return highlighted;

		const query = searchQuery.toLowerCase();
		transcript.words.forEach((word, index) => {
			if (word.text.toLowerCase().includes(query)) {
				highlighted.add(index);
			}
		});
		return highlighted;
	}, [searchQuery, transcript]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleCancelDelete();
			}
			if ((e.metaKey || e.ctrlKey) && e.key === "f") {
				e.preventDefault();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleCancelDelete]);

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center p-8 text-center">
				<p className="text-destructive mb-4">{error}</p>
				<button
					onClick={onRetry}
					className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
				>
					Retry Transcription
				</button>
			</div>
		);
	}

	if (isLoading || !transcript) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="animate-pulse text-muted-foreground">
					Transcribing audio...
				</div>
			</div>
		);
	}

	const visibleWords = transcript.words.filter(
		(_, i) => !deletedWordIndices.has(i),
	);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2 p-3 border-b">
				<div className="relative flex-1">
					<input
						type="text"
						placeholder="Search transcript..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
					/>
				</div>
				<button
					onClick={() => setShowChat(!showChat)}
					className={cn(
						"px-3 py-1.5 text-sm rounded-md border transition-colors",
						showChat
							? "bg-primary text-primary-foreground border-primary"
							: "bg-background border-input hover:bg-accent",
					)}
				>
					{showChat ? "Editor" : "AI Chat"}
				</button>
			</div>

			{showChat ? (
				<GemmaChatPanel
					transcript={transcript}
					videoDuration={transcript.videoDuration}
					onSuggestEdit={(suggestion) => {
						onTextEdit([
							{
								start: suggestion.timeRange.start,
								end: suggestion.timeRange.end,
								text: suggestion.description,
							},
						]);
					}}
				/>
			) : (
				<div className="flex-1 overflow-y-auto p-4">
					<div className="prose prose-sm max-w-none">
						<p className="leading-relaxed">
							{transcript.words.map((word, index) => {
								if (deletedWordIndices.has(index)) return null;
								return (
									<React.Fragment key={word.wordIndex}>
										<WordSpan
											word={word}
											isSelected={selectedWords.has(index)}
											isHovered={false}
											isHighlighted={highlightedWords.has(index)}
											isDeleted={false}
											onWordHover={onWordHover}
											onWordClick={onWordClick}
											onSelectionStart={handleSelectionStart}
											onSelectionEnd={handleSelectionEnd}
										/>
										{" "}
									</React.Fragment>
								);
							})}
						</p>
					</div>
				</div>
			)}

			{selectionRange && !showPreview && (
				<div className="p-3 border-t bg-accent/50">
					<div className="flex items-center justify-between">
						<div className="text-sm">
							<span className="font-medium">Selected:</span>{" "}
							<span className="text-muted-foreground">
								{selectionRange.deletedText}
							</span>
							<span className="text-xs text-muted-foreground ml-2">
								[{selectionRange.timeRange.start.toFixed(1)}s –{" "}
								{selectionRange.timeRange.end.toFixed(1)}s]
							</span>
						</div>
						<div className="flex gap-2">
							<button
								onClick={handleCancelDelete}
								className="px-3 py-1 text-sm border border-input rounded-md hover:bg-accent"
							>
								Clear
							</button>
							<button
								onClick={handlePreviewOpen}
								className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{showPreview && selectionRange && (
				<EditPreviewPanel
					editOperations={[
						{
							id: `edit-${selectionRange.startIndex}`,
							type: "delete",
							timeRange: selectionRange.timeRange,
							affectedWordIndices: Array.from(selectedWords),
							affectedClipIds: [],
							deletedText: selectionRange.deletedText,
							preview: {
								deletedText: selectionRange.deletedText,
								timeRange: selectionRange.timeRange,
								durationRemoved:
									selectionRange.timeRange.end - selectionRange.timeRange.start,
								affectedClips: [],
							},
						},
					]}
					onConfirm={handleConfirmDelete}
					onCancel={handleCancelDelete}
				/>
			)}
		</div>
	);
};
