"use client";

import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { audioEngine, type EQBand, type ReverbConfig, type CompressorConfig, type LimiterConfig, type NoiseGateConfig } from "@/audio/audio-engine";
import { useEditor } from "@/editor/use-editor";
import { cn } from "@/utils/ui";
import {
	SlidersHorizontalIcon,
	MusicNote01Icon,
	Pulse01Icon,
	ZapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

type AudioTab = "eq" | "effects" | "beats" | "varispeed";

const EQ_FREQ_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

export function AudioView() {
	const editor = useEditor();
	const trackId = "default";

	const [activeTab, setActiveTab] = useState<AudioTab>("eq");
	const [eqBands, setEqBands] = useState<EQBand[]>(audioEngine.createDefaultEQ());
	const [reverb, setReverb] = useState<ReverbConfig>({
		enabled: false,
		decay: 1.5,
		preDelay: 0.01,
		mix: 0.3,
		damping: 0.5,
	});
	const [compressor, setCompressor] = useState<CompressorConfig>({
		enabled: false,
		threshold: -24,
		ratio: 4,
		attack: 0.003,
		release: 0.25,
		knee: 6,
	});
	const [limiter, setLimiter] = useState<LimiterConfig>({
		enabled: false,
		threshold: -1,
		attack: 0.001,
		release: 0.05,
	});
	const [noiseGate, setNoiseGate] = useState<NoiseGateConfig>({
		enabled: false,
		threshold: -40,
		attack: 0.001,
		hold: 0.01,
		release: 0.01,
		range: -60,
	});
	const [varispeed, setVarispeed] = useState({ speed: 1, pitchPreservation: true });
	const [detectedBpm, setDetectedBpm] = useState<number | null>(null);

	const handleEqChange = (index: number, gain: number) => {
		const newBands = [...eqBands];
		newBands[index] = { ...newBands[index], gain };
		setEqBands(newBands);
	};

	const tabs: { id: AudioTab; label: string; icon: IconSvgElement }[] = [
		{ id: "eq", label: "EQ", icon: SlidersHorizontalIcon },
		{ id: "effects", label: "Effects", icon: MusicNote01Icon },
		{ id: "beats", label: "Beats", icon: Pulse01Icon },
		{ id: "varispeed", label: "Speed", icon: ZapIcon },
	];

	return (
		<PanelView title="Audio">
			<div className="flex h-full flex-col">
				<div className="flex border-b">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium hover:bg-accent",
								activeTab === tab.id
									? "border-b-2 border-primary text-foreground"
									: "text-muted-foreground"
							)}
						>
							<HugeiconsIcon icon={tab.icon} className="size-3.5" />
							{tab.label}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-y-auto p-3">
					{activeTab === "eq" && (
						<EqPanel bands={eqBands} onChange={handleEqChange} />
					)}
					{activeTab === "effects" && (
						<EffectsPanel
							reverb={reverb}
							setReverb={setReverb}
							compressor={compressor}
							setCompressor={setCompressor}
							limiter={limiter}
							setLimiter={setLimiter}
							noiseGate={noiseGate}
							setNoiseGate={setNoiseGate}
						/>
					)}
					{activeTab === "beats" && (
						<BeatsPanel bpm={detectedBpm} setBpm={setDetectedBpm} />
					)}
					{activeTab === "varispeed" && (
						<VarispeedPanel
							config={varispeed}
							onChange={setVarispeed}
						/>
					)}
				</div>
			</div>
		</PanelView>
	);
}

function EqPanel({
	bands,
	onChange,
}: {
	bands: EQBand[];
	onChange: (index: number, gain: number) => void;
}) {
	return (
		<div className="space-y-3">
			<h4 className="text-sm font-medium">10-Band Equalizer</h4>
			<div className="flex items-end justify-between gap-1 h-40">
				{bands.map((band, i) => (
					<div key={band.frequency} className="flex flex-col items-center gap-1 flex-1">
						<span className="text-muted-foreground text-[10px]">
							{band.gain > 0 ? "+" : ""}{band.gain.toFixed(0)}dB
						</span>
						<div className="h-24 w-full flex items-center justify-center">
							<input
								type="range"
								min={-12}
								max={12}
								step={0.1}
								value={band.gain}
								onChange={(e) => onChange(i, parseFloat(e.target.value))}
								className="h-24 w-1 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:w-0.5 [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:-ml-1"
								style={{ writingMode: "vertical-lr", direction: "ltr" } as React.CSSProperties}
							/>
						</div>
						<span className="text-muted-foreground text-[10px]">{EQ_FREQ_LABELS[i]}</span>
					</div>
				))}
			</div>
			<Button
				size="sm"
				variant="outline"
				className="w-full text-xs"
				onClick={() => bands.forEach((_, i) => onChange(i, 0))}
			>
				Reset EQ
			</Button>
		</div>
	);
}

function EffectsPanel({
	reverb,
	setReverb,
	compressor,
	setCompressor,
	limiter,
	setLimiter,
	noiseGate,
	setNoiseGate,
}: {
	reverb: ReverbConfig;
	setReverb: (c: ReverbConfig) => void;
	compressor: CompressorConfig;
	setCompressor: (c: CompressorConfig) => void;
	limiter: LimiterConfig;
	setLimiter: (c: LimiterConfig) => void;
	noiseGate: NoiseGateConfig;
	setNoiseGate: (c: NoiseGateConfig) => void;
}) {
	return (
		<div className="space-y-4">
			<EffectSection
				title="Reverb"
				enabled={reverb.enabled}
				onToggle={(v) => setReverb({ ...reverb, enabled: v })}
			>
				{reverb.enabled && (
					<div className="space-y-2">
						<SliderField
							label="Decay"
							value={reverb.decay}
							onChange={(v) => setReverb({ ...reverb, decay: v })}
							min={0.1}
							max={10}
							step={0.1}
							unit="s"
						/>
						<SliderField
							label="Mix"
							value={reverb.mix}
							onChange={(v) => setReverb({ ...reverb, mix: v })}
							min={0}
							max={1}
							step={0.01}
						/>
						<SliderField
							label="Damping"
							value={reverb.damping}
							onChange={(v) => setReverb({ ...reverb, damping: v })}
							min={0}
							max={1}
							step={0.01}
						/>
					</div>
				)}
			</EffectSection>

			<EffectSection
				title="Compressor"
				enabled={compressor.enabled}
				onToggle={(v) => setCompressor({ ...compressor, enabled: v })}
			>
				{compressor.enabled && (
					<div className="space-y-2">
						<SliderField
							label="Threshold"
							value={compressor.threshold}
							onChange={(v) => setCompressor({ ...compressor, threshold: v })}
							min={-60}
							max={0}
							step={1}
							unit="dB"
						/>
						<SliderField
							label="Ratio"
							value={compressor.ratio}
							onChange={(v) => setCompressor({ ...compressor, ratio: v })}
							min={1}
							max={20}
							step={0.5}
							unit=":1"
						/>
						<SliderField
							label="Attack"
							value={compressor.attack}
							onChange={(v) => setCompressor({ ...compressor, attack: v })}
							min={0.001}
							max={0.1}
							step={0.001}
							unit="s"
						/>
						<SliderField
							label="Release"
							value={compressor.release}
							onChange={(v) => setCompressor({ ...compressor, release: v })}
							min={0.01}
							max={1}
							step={0.01}
							unit="s"
						/>
					</div>
				)}
			</EffectSection>

			<EffectSection
				title="Limiter"
				enabled={limiter.enabled}
				onToggle={(v) => setLimiter({ ...limiter, enabled: v })}
			>
				{limiter.enabled && (
					<div className="space-y-2">
						<SliderField
							label="Threshold"
							value={limiter.threshold}
							onChange={(v) => setLimiter({ ...limiter, threshold: v })}
							min={-20}
							max={0}
							step={1}
							unit="dB"
						/>
						<SliderField
							label="Attack"
							value={limiter.attack}
							onChange={(v) => setLimiter({ ...limiter, attack: v })}
							min={0.001}
							max={0.01}
							step={0.001}
							unit="s"
						/>
					</div>
				)}
			</EffectSection>

			<EffectSection
				title="Noise Gate"
				enabled={noiseGate.enabled}
				onToggle={(v) => setNoiseGate({ ...noiseGate, enabled: v })}
			>
				{noiseGate.enabled && (
					<div className="space-y-2">
						<SliderField
							label="Threshold"
							value={noiseGate.threshold}
							onChange={(v) => setNoiseGate({ ...noiseGate, threshold: v })}
							min={-60}
							max={0}
							step={1}
							unit="dB"
						/>
						<SliderField
							label="Release"
							value={noiseGate.release}
							onChange={(v) => setNoiseGate({ ...noiseGate, release: v })}
							min={0.001}
							max={0.1}
							step={0.001}
							unit="s"
						/>
					</div>
				)}
			</EffectSection>
		</div>
	);
}

function EffectSection({
	title,
	enabled,
	onToggle,
	children,
}: {
	title: string;
	enabled: boolean;
	onToggle: (v: boolean) => void;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2 rounded border p-3">
			<div className="flex items-center justify-between">
				<h5 className="text-sm font-medium">{title}</h5>
				<Switch checked={enabled} onCheckedChange={onToggle} />
			</div>
			{children}
		</div>
	);
}

function SliderField({
	label,
	value,
	onChange,
	min,
	max,
	step,
	unit,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
	min: number;
	max: number;
	step: number;
	unit?: string;
}) {
	return (
		<div className="space-y-1">
			<div className="flex justify-between">
				<Label className="text-xs">{label}</Label>
				<span className="text-muted-foreground text-xs">
					{value.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}{unit ?? ""}
				</span>
			</div>
			<Slider
				value={[value]}
				onValueChange={([v]) => onChange(v)}
				min={min}
				max={max}
				step={step}
			/>
		</div>
	);
}

function BeatsPanel({
	bpm,
	setBpm,
}: {
	bpm: number | null;
	setBpm: (bpm: number | null) => void;
}) {
	const [detecting, setDetecting] = useState(false);

	const handleDetect = async () => {
		setDetecting(true);
		try {
			const response = await fetch("/api/audio/sample");
			const arrayBuffer = await response.arrayBuffer();
			const audioCtx = new AudioContext();
			const buffer = await audioCtx.decodeAudioData(arrayBuffer);
			const result = await audioEngine.detectBeats(buffer);
			setBpm(result.bpm);
		} catch {
			setBpm(null);
		} finally {
			setDetecting(false);
		}
	};

	return (
		<div className="space-y-4">
			<h4 className="text-sm font-medium">Beat Detection</h4>
			<Button
				size="sm"
				className="w-full"
				onClick={handleDetect}
				disabled={detecting}
			>
				{detecting ? "Detecting..." : "Detect BPM"}
			</Button>
			{bpm !== null && (
				<div className="rounded bg-accent p-4 text-center">
					<span className="text-3xl font-bold">{bpm}</span>
					<span className="text-muted-foreground ml-1">BPM</span>
				</div>
			)}
		</div>
	);
}

function VarispeedPanel({
	config,
	onChange,
}: {
	config: { speed: number; pitchPreservation: boolean };
	onChange: (c: { speed: number; pitchPreservation: boolean }) => void;
}) {
	return (
		<div className="space-y-4">
			<h4 className="text-sm font-medium">Varispeed</h4>
			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Speed</Label>
					<span className="text-muted-foreground text-xs">{config.speed.toFixed(2)}x</span>
				</div>
				<Slider
					value={[config.speed]}
					onValueChange={([v]) => onChange({ ...config, speed: v })}
					min={0.25}
					max={4}
					step={0.05}
				/>
			</div>
			<div className="flex items-center gap-2">
				<Switch
					checked={config.pitchPreservation}
					onCheckedChange={(v) =>
						onChange({ ...config, pitchPreservation: v })
					}
				/>
				<Label className="text-xs">Preserve Pitch</Label>
			</div>
		</div>
	);
}
