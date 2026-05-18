import { useEffect, useRef } from "react";

interface VectorscopePanelProps {
	canvas: OffscreenCanvas | null;
	width?: number;
	height?: number;
}

export function VectorscopePanel({ canvas, width = 256, height = 256 }: VectorscopePanelProps) {
	const displayCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!displayCanvasRef.current) return;

		const ctx = displayCanvasRef.current.getContext("2d");
		if (!ctx) return;

		// Clear
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, width, height);

		// Draw reference circles
		const centerX = width / 2;
		const centerY = height / 2;
		const radius = width / 2 - 4;

		ctx.strokeStyle = "#333";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(centerX, centerY, radius * 0.75, 0, Math.PI * 2);
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
		ctx.stroke();

		// Draw color labels
		ctx.font = "10px monospace";
		ctx.fillStyle = "#888";
		const labels = [
			{ label: "R", angle: 0 },
			{ label: "G", angle: (2 * Math.PI) / 3 },
			{ label: "B", angle: (4 * Math.PI) / 3 },
		];

		for (const { label, angle } of labels) {
			const x = centerX + Math.cos(angle) * (radius - 12);
			const y = centerY + Math.sin(angle) * (radius - 12);
			ctx.fillText(label, x - 3, y + 3);
		}

		// Draw vectorscope data if available
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
