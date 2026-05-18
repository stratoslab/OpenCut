import { useEffect, useRef, useCallback } from "react";
import * as React from "react";

export interface KeyboardShortcut {
	id: string;
	key: string;
	modifiers: Array<"ctrl" | "meta" | "shift" | "alt">;
	action: () => void;
	description: string;
	category: "editing" | "playback" | "navigation" | "tools" | "ai";
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
	{ id: "play-pause", key: " ", modifiers: [], action: () => {}, description: "Play/Pause", category: "playback" },
	{ id: "undo", key: "z", modifiers: ["ctrl", "meta"], action: () => {}, description: "Undo", category: "editing" },
	{ id: "redo", key: "y", modifiers: ["ctrl", "meta"], action: () => {}, description: "Redo", category: "editing" },
	{ id: "save", key: "s", modifiers: ["ctrl", "meta"], action: () => {}, description: "Save", category: "editing" },
	{ id: "cut", key: "x", modifiers: ["ctrl", "meta"], action: () => {}, description: "Cut", category: "editing" },
	{ id: "copy", key: "c", modifiers: ["ctrl", "meta"], action: () => {}, description: "Copy", category: "editing" },
	{ id: "paste", key: "v", modifiers: ["ctrl", "meta"], action: () => {}, description: "Paste", category: "editing" },
	{ id: "split", key: "b", modifiers: [], action: () => {}, description: "Split clip at playhead", category: "editing" },
	{ id: "delete", key: "Backspace", modifiers: [], action: () => {}, description: "Delete selected", category: "editing" },
	{ id: "select-all", key: "a", modifiers: ["ctrl", "meta"], action: () => {}, description: "Select all", category: "editing" },
	{ id: "zoom-in", key: "=", modifiers: ["ctrl", "meta"], action: () => {}, description: "Zoom in timeline", category: "navigation" },
	{ id: "zoom-out", key: "-", modifiers: ["ctrl", "meta"], action: () => {}, description: "Zoom out timeline", category: "navigation" },
	{ id: "fit-to-screen", key: "0", modifiers: ["ctrl", "meta"], action: () => {}, description: "Fit timeline to screen", category: "navigation" },
	{ id: "command-palette", key: "p", modifiers: ["ctrl", "meta", "shift"], action: () => {}, description: "Command palette", category: "tools" },
	{ id: "ai-copilot", key: "k", modifiers: ["ctrl", "meta"], action: () => {}, description: "AI Co-Pilot", category: "ai" },
	{ id: "export", key: "e", modifiers: ["ctrl", "meta", "shift"], action: () => {}, description: "Export video", category: "editing" },
	{ id: "frame-prev", key: "ArrowLeft", modifiers: [], action: () => {}, description: "Previous frame", category: "playback" },
	{ id: "frame-next", key: "ArrowRight", modifiers: [], action: () => {}, description: "Next frame", category: "playback" },
	{ id: "jump-start", key: "Home", modifiers: [], action: () => {}, description: "Jump to start", category: "navigation" },
	{ id: "jump-end", key: "End", modifiers: [], action: () => {}, description: "Jump to end", category: "navigation" },
];

export function useKeyboardShortcuts(
	shortcuts: KeyboardShortcut[],
	enabled = true,
): void {
	const shortcutsRef = useRef(shortcuts);
	shortcutsRef.current = shortcuts;

	const handleKeyDown = useCallback((event: KeyboardEvent) => {
		if (!enabled) return;

		const target = event.target as HTMLElement;
		if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
			return;
		}

		for (const shortcut of shortcutsRef.current) {
			if (matchesShortcut(event, shortcut)) {
				event.preventDefault();
				shortcut.action();
				break;
			}
		}
	}, [enabled]);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
	if (event.key !== shortcut.key && event.code !== shortcut.key) {
		return false;
	}

	const hasCtrl = shortcut.modifiers.includes("ctrl") || shortcut.modifiers.includes("meta");
	const hasShift = shortcut.modifiers.includes("shift");
	const hasAlt = shortcut.modifiers.includes("alt");

	if (hasCtrl !== (event.ctrlKey || event.metaKey)) return false;
	if (hasShift !== event.shiftKey) return false;
	if (hasAlt !== event.altKey) return false;

	return true;
}

export interface AccessibilityConfig {
	reducedMotion: boolean;
	highContrast: boolean;
	largeText: boolean;
	screenReaderOptimized: boolean;
	keyboardNavigation: boolean;
}

export const DEFAULT_A11Y_CONFIG: AccessibilityConfig = {
	reducedMotion: false,
	highContrast: false,
	largeText: false,
	screenReaderOptimized: false,
	keyboardNavigation: true,
};

export function useAccessibility(): AccessibilityConfig {
	const [config, setConfig] = React.useState<AccessibilityConfig>(DEFAULT_A11Y_CONFIG);

	React.useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const updateReducedMotion = () => {
			setConfig(prev => ({ ...prev, reducedMotion: mediaQuery.matches }));
		};
		updateReducedMotion();
		mediaQuery.addEventListener("change", updateReducedMotion);
		return () => mediaQuery.removeEventListener("change", updateReducedMotion);
	}, []);

	React.useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-contrast: high)");
		const updateHighContrast = () => {
			setConfig(prev => ({ ...prev, highContrast: mediaQuery.matches }));
		};
		updateHighContrast();
		mediaQuery.addEventListener("change", updateHighContrast);
		return () => mediaQuery.removeEventListener("change", updateHighContrast);
	}, []);

	return config;
}

export function useScreenReaderAnnouncement(): (message: string, priority?: "polite" | "assertive") => void {
	const containerRef = useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		const container = document.createElement("div");
		container.setAttribute("aria-live", "polite");
		container.setAttribute("aria-atomic", "true");
		container.style.position = "absolute";
		container.style.width = "1px";
		container.style.height = "1px";
		container.style.padding = "0";
		container.style.margin = "-1px";
		container.style.overflow = "hidden";
		container.style.clip = "rect(0, 0, 0, 0)";
		container.style.whiteSpace = "nowrap";
		container.style.border = "0";
		document.body.appendChild(container);
		containerRef.current = container;

		return () => {
			document.body.removeChild(container);
		};
	}, []);

	return useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
		if (containerRef.current) {
			containerRef.current.setAttribute("aria-live", priority);
			containerRef.current.textContent = message;
		}
	}, []);
}
