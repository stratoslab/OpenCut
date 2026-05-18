import { Button } from "@/components/ui/button";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useReducer, useRef, useState, useEffect } from "react";
import { extractTimelineAudio } from "@/media/mediabunny";
import { useEditor } from "@/editor/use-editor";
import { TRANSCRIPTION_DIAGNOSTICS_SCOPE } from "@/transcription/diagnostics";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import { TRANSCRIPTION_LANGUAGES } from "@/transcription/supported-languages";
import { TRANSCRIPTION_MODELS } from "@/transcription/models";
import type {
	CaptionChunk,
	TranscriptionLanguage,
	TranscriptionProgress,
	TranscriptionModelId,
} from "@/transcription/types";
import { transcriptionService } from "@/services/transcription/service";
import { decodeAudioToFloat32 } from "@/media/audio";
import { mediaTimeToSeconds } from "@/wasm";
import { buildCaptionChunks } from "@/transcription/caption";
import { segmentsToWordSegments, buildWordTranscript } from "@/transcription/word-segments";
import { insertCaptionChunksAsTextTrack } from "@/subtitles/insert";
import { parseSubtitleFile } from "@/subtitles/parse";
import { cuesToWordTranscript } from "@/subtitles/to-word-transcript";
import { Spinner } from "@/components/ui/spinner";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
} from "@/components/section";
import { AlertCircleIcon, CloudUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DiagnosticSeverity } from "@/diagnostics/types";
import { useTranscriptionModelStore } from "@/transcription/transcription-model-store";
import { cn } from "@/utils/ui";

const DIAGNOSTIC_BUTTON_VARIANT: Record<
	DiagnosticSeverity,
	"caution" | "destructive-foreground"
> = {
	caution: "caution",
	error: "destructive-foreground",
};

type ProcessingState =
	| { status: "idle"; error: string | null; warnings: string[] }
	| { status: "processing"; step: string };

type ProcessingAction =
	| { type: "start"; step: string }
	| { type: "update_step"; step: string }
	| { type: "succeed"; warnings: string[] }
	| { type: "fail"; error: string };

const IDLE_STATE: ProcessingState = {
	status: "idle",
	error: null,
	warnings: [],
};

/* eslint-disable opencut/prefer-object-params -- React reducers must accept (state, action). */
function processingReducer(
	state: ProcessingState,
	action: ProcessingAction,
): ProcessingState {
	switch (action.type) {
		case "start":
			return { status: "processing", step: action.step };
		case "update_step":
			if (state.status !== "processing") return state;
			return { status: "processing", step: action.step };
		case "succeed":
			return { status: "idle", error: null, warnings: action.warnings };
		case "fail":
			return { status: "idle", error: action.error, warnings: [] };
	}
}
/* eslint-enable opencut/prefer-object-params */

export function Captions() {
	const [selectedLanguage, setSelectedLanguage] =
		useState<TranscriptionLanguage>("auto");
	const [processing, dispatch] = useReducer(processingReducer, IDLE_STATE);
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const editor = useEditor();

	const {
		stage: modelStage,
		progress: modelProgress,
		currentFile: modelCurrentFile,
		estimatedTimeRemaining: modelETA,
		error: modelError,
		selectedModel,
		isInitialized: modelReady,
		initWorker,
		terminateWorker,
		loadModel,
		selectModel,
		clearError: clearModelError,
	} = useTranscriptionModelStore();

	useEffect(() => {
		initWorker();
		return () => terminateWorker();
	}, []);

	const isProcessing = processing.status === "processing";
	const isModelLoading =
		modelStage === "downloading" || modelStage === "loading";

	const activeDiagnostics = useEditor((e) =>
		e.diagnostics.getActive({ scope: TRANSCRIPTION_DIAGNOSTICS_SCOPE }),
	);

	const handleProgress = (progress: TranscriptionProgress) => {
		if (progress.status === "loading-model") {
			dispatch({
				type: "update_step",
				step: `Loading model ${Math.round(progress.progress)}%`,
			});
		} else if (progress.status === "transcribing") {
			dispatch({ type: "update_step", step: "Transcribing..." });
		}
	};

	const insertCaptions = ({
		captions,
	}: {
		captions: CaptionChunk[];
	}): boolean => {
		const trackId = insertCaptionChunksAsTextTrack({ editor, captions });
		return trackId !== null;
	};

	const handleGenerateTranscript = async () => {
		if (!modelReady) {
			loadModel();
			return;
		}

		dispatch({ type: "start", step: "Extracting audio..." });
		try {
			const audioBlob = await extractTimelineAudio({
				tracks: editor.scenes.getActiveScene().tracks,
				mediaAssets: editor.media.getAssets(),
				totalDuration: editor.timeline.getTotalDuration(),
			});

			dispatch({ type: "update_step", step: "Preparing audio..." });
			const { samples } = await decodeAudioToFloat32({
				audioBlob,
				sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
			});

			// Single transcription call — use result for both captions and word transcript
			dispatch({ type: "update_step", step: "Transcribing..." });
			const result = await transcriptionService.transcribe({
				audioData: samples,
				language: selectedLanguage === "auto" ? undefined : selectedLanguage,
				onProgress: handleProgress,
			});

			dispatch({ type: "update_step", step: "Generating captions..." });
			const captionChunks = buildCaptionChunks({ segments: result.segments });

			if (!insertCaptions({ captions: captionChunks })) {
				dispatch({ type: "fail", error: "No captions were generated" });
				return;
			}

			dispatch({ type: "update_step", step: "Building word transcript..." });
			const wordSegments = segmentsToWordSegments(result.segments);
			const wordTranscript = buildWordTranscript(
				wordSegments,
				result.text,
				result.language,
				mediaTimeToSeconds({
					time: editor.timeline.getTotalDuration(),
				}),
			);

			const activeScene = editor.scenes.getActiveScene();
			editor.scenes.updateScene({
				sceneId: activeScene.id,
				updates: { transcript: wordTranscript },
			});

			dispatch({ type: "succeed", warnings: [] });
		} catch (error) {
			console.error("Transcription failed:", error);
			dispatch({
				type: "fail",
				error:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			});
		}
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportFile = async ({ file }: { file: File }) => {
		dispatch({ type: "start", step: "Reading subtitle file..." });
		try {
			const input = await file.text();
			const result = parseSubtitleFile({
				fileName: file.name,
				input,
			});

			if (result.captions.length === 0) {
				dispatch({
					type: "fail",
					error: "No valid subtitle cues were found in the subtitle file",
				});
				return;
			}

			dispatch({ type: "update_step", step: "Importing subtitles..." });

			if (!insertCaptions({ captions: result.captions })) {
				dispatch({ type: "fail", error: "No captions were generated" });
				return;
			}

			// Generate WordTranscript from imported cues to enable text-based editing
			const videoDuration = mediaTimeToSeconds({
				time: editor.timeline.getTotalDuration(),
			});
			const wordTranscript = cuesToWordTranscript({
				cues: result.captions,
				videoDuration,
				language: "unknown",
			});

			const activeScene = editor.scenes.getActiveScene();
			editor.scenes.updateScene({
				sceneId: activeScene.id,
				updates: { transcript: wordTranscript },
			});

			const nextWarnings = [...result.warnings];
			if (result.skippedCueCount > 0) {
				nextWarnings.unshift(
					`Imported ${result.captions.length} subtitle cue(s) and skipped ${result.skippedCueCount} malformed cue(s).`,
				);
			}

			dispatch({ type: "succeed", warnings: nextWarnings });
		} catch (error) {
			console.error("Subtitle import failed:", error);
			dispatch({
				type: "fail",
				error:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			});
		}
	};

	const handleFileChange = async ({
		event,
	}: {
		event: React.ChangeEvent<HTMLInputElement>;
	}) => {
		const file = event.target.files?.[0];
		if (event.target) {
			event.target.value = "";
		}
		if (!file) return;

		await handleImportFile({ file });
	};

	const handleLanguageChange = ({ value }: { value: string }) => {
		if (value === "auto") {
			setSelectedLanguage("auto");
			return;
		}

		const matchedLanguage = TRANSCRIPTION_LANGUAGES.find(
			(language) => language.code === value,
		);
		if (!matchedLanguage) return;
		setSelectedLanguage(matchedLanguage.code);
	};

	const error = processing.status === "idle" ? processing.error : null;
	const warnings = processing.status === "idle" ? processing.warnings : [];

	return (
		<PanelView
			title="Captions"
			contentClassName="px-0 flex flex-col h-full"
			actions={
				<TooltipProvider>
					<div className="flex items-center gap-1.5">
						{!isProcessing &&
							activeDiagnostics.map((diagnostic) => (
								<Tooltip key={diagnostic.id}>
									<TooltipTrigger asChild>
										<Button
											variant={DIAGNOSTIC_BUTTON_VARIANT[diagnostic.severity]}
											size="icon"
											aria-label={diagnostic.message}
										>
											<HugeiconsIcon icon={AlertCircleIcon} size={16} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>{diagnostic.message}</TooltipContent>
								</Tooltip>
							))}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleImportClick}
							disabled={isProcessing}
							className="items-center justify-center gap-1.5"
						>
							<HugeiconsIcon icon={CloudUploadIcon} />
							Import
						</Button>
					</div>
				</TooltipProvider>
			}
			ref={containerRef}
		>
			<input
				ref={fileInputRef}
				type="file"
				accept=".srt,.ass"
				className="hidden"
				onChange={(event) => void handleFileChange({ event })}
			/>
			<Section
				showTopBorder={false}
				showBottomBorder={false}
				className="flex-1"
			>
				<SectionContent className="flex flex-col gap-4 h-full pt-1">
					<SectionFields>
						<SectionField label="Model">
							<Select
								value={selectedModel}
								onValueChange={(value) =>
									selectModel(value as TranscriptionModelId)
								}
								disabled={isModelLoading || modelReady}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a model" />
								</SelectTrigger>
								<SelectContent>
									{TRANSCRIPTION_MODELS.map((model) => (
										<SelectItem key={model.id} value={model.id}>
											{model.name} — {model.description}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>

						<SectionField label="Language">
							<Select
								value={selectedLanguage}
								onValueChange={(value) => handleLanguageChange({ value })}
								disabled={!modelReady}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a language" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="auto">Auto detect</SelectItem>
									{TRANSCRIPTION_LANGUAGES.map((language) => (
										<SelectItem key={language.code} value={language.code}>
											{language.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>
					</SectionFields>

					{modelStage === "idle" && (
						<Button
							type="button"
							className="mt-auto w-full"
							onClick={loadModel}
						>
							Load{" "}
							{TRANSCRIPTION_MODELS.find((m) => m.id === selectedModel)?.name ??
								"Model"}
						</Button>
					)}

					{isModelLoading && (
						<div className="mt-auto space-y-3">
							<div className="space-y-1">
								<div className="flex justify-between text-[10px] text-muted-foreground">
									<span>{modelCurrentFile || "Loading..."}</span>
									<span>{Math.round(modelProgress)}%</span>
								</div>
								<div className="h-2 bg-muted rounded overflow-hidden">
									<div
										className="h-full bg-primary transition-all duration-300"
										style={{ width: `${modelProgress}%` }}
									/>
								</div>
								{modelETA && (
									<p className="text-[10px] text-muted-foreground text-center">
										~{modelETA} remaining
									</p>
								)}
							</div>
							<div className="flex items-center gap-2">
								<Spinner className="w-3 h-3" />
								<span className="text-xs text-muted-foreground">
									Downloading model...
								</span>
							</div>
						</div>
					)}

					{modelStage === "error" && (
						<div className="mt-auto space-y-2">
							<div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
								<p className="text-xs text-destructive">{modelError}</p>
							</div>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="destructive"
									className="flex-1"
									onClick={() => {
										clearModelError();
										loadModel();
									}}
								>
									Retry
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={clearModelError}
								>
									Dismiss
								</Button>
							</div>
						</div>
					)}

					{modelReady && (
						<Button
							type="button"
							className="mt-auto w-full"
							onClick={handleGenerateTranscript}
							disabled={isProcessing || activeDiagnostics.length > 0}
						>
							{isProcessing && <Spinner className="mr-1" />}
							{isProcessing ? processing.step : "Generate transcript"}
						</Button>
					)}

					{error && (
						<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
							<p className="text-destructive text-sm">{error}</p>
						</div>
					)}
					{warnings.length > 0 && (
						<div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
							<ul className="space-y-1 text-sm text-amber-700">
								{warnings.map((warning) => (
									<li key={warning}>{warning}</li>
								))}
							</ul>
						</div>
					)}
				</SectionContent>
			</Section>
		</PanelView>
	);
}
