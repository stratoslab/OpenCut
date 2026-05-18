import { useState, useCallback } from "react";
import type { SubtitleStyle } from "@/subtitles/style-types";
import { DEFAULT_SUBTITLE_STYLE } from "@/subtitles/style-types";
import { SUBTITLE_PRESETS, getSubtitlePreset } from "@/subtitles/style-presets";
import { cn } from "@/utils/ui";

interface StyleEditorPanelProps {
	style: SubtitleStyle;
	onChange: (style: SubtitleStyle) => void;
}

export function StyleEditorPanel({ style, onChange }: StyleEditorPanelProps) {
	const [activeTab, setActiveTab] = useState<"presets" | "custom" | "animation">("presets");

	const handlePresetSelect = useCallback((presetId: string) => {
		const presetStyle = getSubtitlePreset(presetId);
		if (presetStyle) {
			onChange(presetStyle);
		}
	}, [onChange]);

	const handleStyleChange = useCallback(
		<K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
			onChange({ ...style, [key]: value });
		},
		[style, onChange],
	);

	return (
		<div className="p-3 space-y-3">
			<div className="flex gap-1 border-b">
				{(["presets", "custom", "animation"] as const).map((tab) => (
					<button
						key={tab}
						type="button"
						className={cn(
							"px-3 py-1.5 text-xs font-medium capitalize transition-colors",
							activeTab === tab
								? "text-primary border-b-2 border-primary"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => setActiveTab(tab)}
					>
						{tab}
					</button>
				))}
			</div>

			{activeTab === "presets" && (
				<div className="grid grid-cols-2 gap-2">
					{SUBTITLE_PRESETS.map((preset) => (
						<button
							key={preset.id}
							type="button"
							className={cn(
								"p-3 border rounded text-left transition-colors",
								style.presetId === preset.id
									? "border-primary bg-primary/10"
									: "hover:bg-muted",
							)}
							onClick={() => handlePresetSelect(preset.id)}
						>
							<div className="text-xs font-medium">{preset.name}</div>
							<div className="text-[10px] text-muted-foreground mt-0.5">
								{preset.description}
							</div>
							<div
								className="mt-2 text-xs font-bold px-2 py-1 rounded"
								style={{
									color: preset.style.color,
									backgroundColor: preset.style.backgroundColor,
									outline: `${preset.style.outlineWidth}px solid ${preset.style.outlineColor}`,
								}}
							>
								Aa
							</div>
						</button>
					))}
				</div>
			)}

			{activeTab === "custom" && (
				<div className="space-y-3">
					<div className="space-y-1">
						<label className="text-[10px] text-muted-foreground">Font</label>
						<select
							value={style.fontFamily}
							onChange={(e) => handleStyleChange("fontFamily", e.target.value)}
							className="w-full text-xs bg-background border rounded px-2 py-1"
						>
							<option value="Inter">Inter</option>
							<option value="Arial">Arial</option>
							<option value="Georgia">Georgia</option>
							<option value="Courier New">Courier New</option>
							<option value="Verdana">Verdana</option>
						</select>
					</div>

					<div className="space-y-1">
						<label className="text-[10px] text-muted-foreground">
							Size: {style.fontSize}px
						</label>
						<input
							type="range"
							min={16}
							max={64}
							value={style.fontSize}
							onChange={(e) => handleStyleChange("fontSize", Number(e.target.value))}
							className="w-full"
						/>
					</div>

					<div className="grid grid-cols-2 gap-2">
						<div className="space-y-1">
							<label className="text-[10px] text-muted-foreground">Text Color</label>
							<input
								type="color"
								value={style.color}
								onChange={(e) => handleStyleChange("color", e.target.value)}
								className="w-full h-8 rounded cursor-pointer"
							/>
						</div>
						<div className="space-y-1">
							<label className="text-[10px] text-muted-foreground">Background</label>
							<input
								type="color"
								value={style.backgroundColor}
								onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
								className="w-full h-8 rounded cursor-pointer"
							/>
						</div>
					</div>

					<div className="space-y-1">
						<label className="text-[10px] text-muted-foreground">
							Background Opacity: {Math.round(style.backgroundOpacity * 100)}%
						</label>
						<input
							type="range"
							min={0}
							max={100}
							value={style.backgroundOpacity * 100}
							onChange={(e) =>
								handleStyleChange("backgroundOpacity", Number(e.target.value) / 100)
							}
							className="w-full"
						/>
					</div>

					<div className="space-y-1">
						<label className="text-[10px] text-muted-foreground">
							Outline Width: {style.outlineWidth}px
						</label>
						<input
							type="range"
							min={0}
							max={8}
							value={style.outlineWidth}
							onChange={(e) => handleStyleChange("outlineWidth", Number(e.target.value))}
							className="w-full"
						/>
					</div>

					<div className="space-y-1">
						<label className="text-[10px] text-muted-foreground">Position</label>
						<div className="flex gap-1">
							{(["top", "center", "bottom"] as const).map((pos) => (
								<button
									key={pos}
									type="button"
									className={cn(
										"flex-1 py-1 text-xs border rounded capitalize",
										style.position === pos
											? "bg-primary text-primary-foreground"
											: "hover:bg-muted",
									)}
									onClick={() => handleStyleChange("position", pos)}
								>
									{pos}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{activeTab === "animation" && (
				<div className="space-y-3">
					<div className="grid grid-cols-3 gap-1">
						{(["none", "fade", "slide", "typewriter", "bounce", "karaoke"] as const).map(
							(anim) => (
								<button
									key={anim}
									type="button"
									className={cn(
										"py-1.5 text-xs border rounded capitalize",
										style.animation === anim
											? "bg-primary text-primary-foreground"
											: "hover:bg-muted",
									)}
									onClick={() => handleStyleChange("animation", anim)}
								>
									{anim}
								</button>
							),
						)}
					</div>

					{style.animation !== "none" && (
						<div className="space-y-1">
							<label className="text-[10px] text-muted-foreground">
								Animation Duration: {style.animationDuration}s
							</label>
							<input
								type="range"
								min={1}
								max={20}
								value={style.animationDuration * 10}
								onChange={(e) =>
									handleStyleChange("animationDuration", Number(e.target.value) / 10)
								}
								className="w-full"
							/>
						</div>
					)}
				</div>
			)}

			<div className="pt-2 border-t">
				<div
					className="text-center px-4 py-3 rounded"
					style={{
						fontFamily: style.fontFamily,
						fontSize: style.fontSize,
						fontWeight: style.fontWeight,
						color: style.color,
						backgroundColor: style.backgroundOpacity > 0 ? style.backgroundColor : "transparent",
						outline:
							style.outlineWidth > 0
								? `${style.outlineWidth}px solid ${style.outlineColor}`
								: "none",
						textShadow:
							style.shadowBlur > 0
								? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
								: "none",
					}}
				>
					Preview text
				</div>
			</div>

			<button
				type="button"
				className="w-full py-1.5 text-xs border rounded hover:bg-muted"
				onClick={() => onChange(DEFAULT_SUBTITLE_STYLE)}
			>
				Reset to Default
			</button>
		</div>
	);
}
