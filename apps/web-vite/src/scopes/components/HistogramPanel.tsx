import { useEffect, useRef, useState } from "react";
import type { HistogramData } from "@/scopes/scope-manager";

interface HistogramPanelProps {
	data: HistogramData | null;
	width?: number;
	height?: number;
}

export function HistogramPanel({ data, width = 256, height = 128 }: HistogramPanelProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [hoverInfo, setHoverInfo] = useState<string | null>(null);

	useEffect(() => {
		if (!canvasRef.current || !data) return;

		const ctx = canvasRef.current.getContext("2d");
		if (!ctx) return;

		ctx.clearRect(0, 0, width, height);

		const maxVal = Math.max(
			...data.red, ...data.green, ...data.blue, ...data.luminance,
		);
		if (maxVal === 0) return;

		const barWidth = width / 256;

		// Draw luminance (white, behind)
		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		for (let i = 0; i < 256; i++) {
			const barHeight = (data.luminance[i] / maxVal) * height;
			ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
		}

		// Draw RGB channels
		const channels = [
			{ values: data.red, color: "rgba(255, 0, 0, 0.5)" },
			{ values: data.green, color: "rgba(0, 255, 0, 0.5)" },
			{ values: data.blue, color: "rgba(0, 0, 255, 0.5)" },
		];

		for (const { values, color } of channels) {
			ctx.fillStyle = color;
			for (let i = 0; i < 256; i++) {
				const barHeight = (values[i] / maxVal) * height;
				ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
			}
		}
	}, [data, width, height]);

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!data) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = Math.floor(((e.clientX - rect.left) / rect.width) * 256);
		if (x >= 0 && x < 256) {
			setHoverInfo(
				`Level: ${x} | R: ${data.red[x]} | G: ${data.green[x]} | B: ${data.blue[x]} | Y: ${data.luminance[x]}`,
			);
		}
	};

	return (
		<div className="relative">
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				className="w-full bg-black"
				onMouseMove={handleMouseMove}
				onMouseLeave={() => setHoverInfo(null)}
			/>
			{hoverInfo && (
				<div className="absolute bottom-0 left-0 right-0 bg-black/80 text-xs text-white p-1 font-mono">
					{hoverInfo}
				</div>
			)}
		</div>
	);
}
