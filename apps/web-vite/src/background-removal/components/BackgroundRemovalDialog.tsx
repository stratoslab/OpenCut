import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useBackgroundRemovalStore } from "../store";
import { backgroundRemovalService } from "../service";

interface BackgroundRemovalDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	imageFile?: File;
	onComplete: (result: { original: string; removed: string }) => void;
}

export function BackgroundRemovalDialog({
	open,
	onOpenChange,
	imageFile,
	onComplete,
}: BackgroundRemovalDialogProps) {
	const { stage, progress, error, device } = useBackgroundRemovalStore();
	const initWorker = useBackgroundRemovalStore((s) => s.initWorker);
	const loadModel = useBackgroundRemovalStore((s) => s.loadModel);

	const [isProcessing, setIsProcessing] = useState(false);
	const [result, setResult] = useState<{ original: string; removed: string } | null>(null);
	const [sliderPosition, setSliderPosition] = useState(50);

	// Initialise the worker on mount if the model hasn't been loaded yet
	useEffect(() => {
		if (stage === "idle") {
			initWorker();
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const handleRemove = useCallback(async () => {
		if (!imageFile) return;
		setIsProcessing(true);

		try {
			const blob = await backgroundRemovalService.removeBackground(imageFile);
			const originalUrl = URL.createObjectURL(imageFile);
			const removedUrl = URL.createObjectURL(blob);
			const resultData = { original: originalUrl, removed: removedUrl };
			setResult(resultData);
		} catch (err) {
			console.error("Background removal failed:", err);
		} finally {
			setIsProcessing(false);
		}
	}, [imageFile]);

	const handleApply = useCallback(() => {
		if (result) {
			onComplete(result);
			onOpenChange(false);
		}
	}, [result, onComplete, onOpenChange]);

	if (!open) return null;

	const isModelLoading = stage === "downloading" || stage === "loading";
	const isModelReady = stage === "ready";
	const isModelError = stage === "error";

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="bg-popover border rounded-lg shadow-lg max-w-2xl w-full p-6 space-y-4">
				<h2 className="text-sm font-semibold">Background Removal</h2>

				{/* Model loading progress */}
				{isModelLoading && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>
								{device ? `Loading model (${device})…` : "Initialising…"}
							</span>
							<span>{progress}%</span>
						</div>
						<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
							<div
								className="h-full bg-primary transition-all duration-300"
								style={{ width: `${progress}%` }}
							/>
						</div>
					</div>
				)}

				{/* Model error panel */}
				{isModelError && (
					<div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
						<p className="text-xs text-destructive">
							{error ?? "Failed to load the background removal model."}
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => loadModel()}
						>
							Retry
						</Button>
					</div>
				)}

				{/* Ready state — show image + remove button */}
				{isModelReady && !result && !isProcessing && (
					<div className="space-y-3">
						{imageFile && (
							<img
								src={URL.createObjectURL(imageFile)}
								alt="Original"
								className="max-h-64 mx-auto rounded"
							/>
						)}
						<Button
							className="w-full"
							onClick={handleRemove}
							disabled={!imageFile}
						>
							Remove Background
						</Button>
					</div>
				)}

				{/* Processing spinner */}
				{isProcessing && (
					<div className="flex items-center justify-center py-8">
						<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
						<span className="ml-3 text-sm">Processing…</span>
					</div>
				)}

				{/* Before/after slider */}
				{result && (
					<div className="space-y-3">
						<div className="relative h-64 overflow-hidden rounded">
							<img
								src={result.original}
								alt="Original"
								className="absolute inset-0 w-full h-full object-cover"
							/>
							<img
								src={result.removed}
								alt="Removed"
								className="absolute inset-0 w-full h-full object-cover"
								style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
							/>
							<input
								type="range"
								min={0}
								max={100}
								value={sliderPosition}
								onChange={(e) => setSliderPosition(Number(e.target.value))}
								className="absolute bottom-2 left-4 right-4"
							/>
						</div>
						<div className="flex gap-2">
							<Button className="flex-1" onClick={handleApply}>
								Apply
							</Button>
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => setResult(null)}
							>
								Reset
							</Button>
						</div>
					</div>
				)}

				<div className="flex justify-end">
					<Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</div>
		</div>
	);
}
