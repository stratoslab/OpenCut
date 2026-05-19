import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

const ONBOARDING_STORAGE_KEY = "opencut-onboarding-complete";

interface OnboardingDialogProps {
	onComplete: () => void;
}

export function OnboardingDialog({ onComplete }: OnboardingDialogProps) {
	const [step, setStep] = useState(0);
	const [isOpen, setIsOpen] = useState(!localStorage.getItem(ONBOARDING_STORAGE_KEY));

	const handleNext = useCallback(() => {
		if (step < 2) {
			setStep(step + 1);
		} else {
			localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
			setIsOpen(false);
			onComplete();
		}
	}, [step, onComplete]);

	if (!isOpen) return null;

	const steps = [
		{
			title: "Welcome to StratosCut",
			description: "A fully client-side video editor powered by AI. Everything runs in your browser — no uploads, no servers.",
			icon: "🎬",
		},
		{
			title: "AI Features",
			description: "Scene detection, smart cut, AI co-pilot, and more — all running locally on your device via WebGPU.",
			icon: "🤖",
		},
		{
			title: "Ready to Edit",
			description: "Import your media and start editing. Use Cmd+Shift+P for the command palette to access all features.",
			icon: "✨",
		},
	];

	const current = steps[step];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="bg-popover border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
				<div className="text-center">
					<div className="text-4xl mb-2">{current.icon}</div>
					<h2 className="text-lg font-semibold">{current.title}</h2>
					<p className="text-sm text-muted-foreground mt-1">{current.description}</p>
				</div>

				<div className="flex justify-center gap-2">
					{steps.map((_, i) => (
						<div
							key={i}
							className={cn(
								"w-2 h-2 rounded-full transition-colors",
								i === step ? "bg-primary" : "bg-muted",
							)}
						/>
					))}
				</div>

				<div className="flex gap-2">
					{step > 0 && (
						<Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
							Back
						</Button>
					)}
					<Button className="flex-1" onClick={handleNext}>
						{step === 2 ? "Get Started" : "Next"}
					</Button>
				</div>
			</div>
		</div>
	);
}

export function hasCompletedOnboarding(): boolean {
	return !!localStorage.getItem(ONBOARDING_STORAGE_KEY);
}
