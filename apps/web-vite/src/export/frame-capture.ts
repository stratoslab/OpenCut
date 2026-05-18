export async function captureFrame(
	canvas: HTMLCanvasElement | OffscreenCanvas,
	timestampUs: number,
): Promise<VideoFrame> {
	let bitmap: ImageBitmap;

	if (canvas instanceof OffscreenCanvas) {
		bitmap = canvas.transferToImageBitmap();
	} else {
		// For regular canvas, use createImageBitmap
		bitmap = await createImageBitmap(canvas);
	}

	const frame = new VideoFrame(bitmap, {
		timestamp: timestampUs,
	});

	bitmap.close();
	return frame;
}

export function calculateTimestamp(frameIndex: number, fps: number): number {
	return Math.round((frameIndex / fps) * 1_000_000);
}
