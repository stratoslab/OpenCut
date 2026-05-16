import React, { useCallback, useRef } from "react";
import type { WordSegment } from "@/transcription/types";
import { cn } from "@/utils/ui";

interface WordSpanProps {
	word: WordSegment;
	isSelected: boolean;
	isHovered: boolean;
	isHighlighted: boolean;
	isDeleted: boolean;
	onWordHover: (word: WordSegment | null) => void;
	onWordClick: (word: WordSegment) => void;
	onSelectionStart: (word: WordSegment) => void;
	onSelectionEnd: (word: WordSegment) => void;
}

export const WordSpan: React.FC<WordSpanProps> = React.memo(
	({
		word,
		isSelected,
		isHovered,
		isHighlighted,
		isDeleted,
		onWordHover,
		onWordClick,
		onSelectionStart,
		onSelectionEnd,
	}) => {
		const elementRef = useRef<HTMLSpanElement>(null);

		const handleMouseDown = useCallback(
			(e: React.MouseEvent) => {
				if (e.detail === 1) {
					onSelectionStart(word);
				}
			},
			[word, onSelectionStart],
		);

		const handleMouseUp = useCallback(
			(e: React.MouseEvent) => {
				onSelectionEnd(word);
			},
			[word, onSelectionEnd],
		);

		const handleClick = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				onWordClick(word);
			},
			[word, onWordClick],
		);

		const handleMouseEnter = useCallback(() => {
			onWordHover(word);
		}, [word, onWordHover]);

		const handleMouseLeave = useCallback(() => {
			onWordHover(null);
		}, [onWordHover]);

		return (
			<span
				ref={elementRef}
				className={cn(
					"inline cursor-pointer rounded-sm px-0.5 transition-colors duration-100",
					isDeleted && "line-through text-muted-foreground opacity-50",
					isSelected && "bg-primary/20 text-primary",
					!isSelected && isHighlighted && "bg-accent",
					!isSelected && !isHighlighted && isHovered && "bg-accent/50",
					!isSelected && !isHighlighted && !isHovered && "hover:bg-accent/30",
				)}
				data-word-index={word.wordIndex}
				data-start={word.start}
				data-end={word.end}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				{word.text}
			</span>
		);
	},
);

WordSpan.displayName = "WordSpan";
