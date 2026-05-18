import { useEffect, useRef } from "react";

interface WaveformPanelProps {
	canvas: OffscreenCanvas | null;
	width?: number;
	height?: number;
}

export function WaveformPanel({ canvas, width = 256, height = 128 }: WaveformPanelProps) {
	const displayCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!displayCanvasRef.current) return;

		const ctx = displayCanvasRef.current.getContext("2d");
		if (!ctx) return;

		// Clear
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, width, height);

		// Draw reference lines (0%, 50%, 100%)
		ctx.strokeStyle = "#333";
		ctx.lineWidth = 1;
		for (const pct of [0, 0.5, 1]) {
			const y = height - pct * height;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}

		// Labels
		ctx.font = "8px monospace";
		ctx.fillStyle = "#666";
		ctx.fillText("100%", 2, 10);
		ctx.fillText("50%", 2, height / 2);
		ctx.fillText("0%", 2, height - 2);

		// Draw waveform data
		if (canvas) {
			const sourceCtx = canvas.getContext("2d");
			if (sourceCtx) {
				ctx.drawImage(canvas, 0, 0, width, height);
			}
		}
	}, [canvas, width, height]);

	return (
		<canvas
			ref={displayCanvasRef}
			width={width}
			height={height}
			className="w-full bg-black"
		/>
	);
}
