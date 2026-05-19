"use client";

import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { TabBar } from "./tabbar";
import { Captions } from "@/subtitles/components/assets-view";
import { MediaView } from "./views/assets";
import { SettingsView } from "./views/settings";
import { SoundsView } from "@/sounds/components/assets-view";
import { StickersView } from "@/stickers/components/assets-view";
import { TextView } from "@/text/components/assets-view";
import { EffectsView } from "@/effects/components/assets-view";
import { TransitionsView } from "@/transitions/components/assets-view";
import { SceneDetectPanel } from "@/scene-detection/components/SceneDetectPanel";
import { AiAgentPanel } from "@/ai/components/AiAgentPanel";
import { Layers3DView } from "./views/layers-3d";
import { KeyframesView } from "./views/keyframes";
import { AudioView } from "./views/audio";
import { TextAnimationsView } from "./views/text-animations";
import { ProxyView } from "./views/proxy";
import { ProjectBundleView } from "./views/project-bundle";
import { HistoryView } from "./views/history";
import { MultiOutputView } from "./views/multi-output";

export function AssetsPanel() {
	const { activeTab } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		media: <MediaView />,
		sounds: <SoundsView />,
		text: <TextView />,
		stickers: <StickersView />,
		effects: <EffectsView />,
		transitions: <TransitionsView />,
		captions: <Captions />,
		"scene-detection": <SceneDetectPanel />,
		"ai-copilot": <AiAgentPanel />,
		adjustment: (
			<div className="text-muted-foreground p-4">
				Adjustment view coming soon...
			</div>
		),
		"3d": <Layers3DView />,
		keyframes: <KeyframesView />,
		audio: <AudioView />,
		"text-animations": <TextAnimationsView />,
		proxy: <ProxyView />,
		"project-bundle": <ProjectBundleView />,
		history: <HistoryView />,
		"multi-output": <MultiOutputView />,
		settings: <SettingsView />,
	};

	return (
		<div className="panel bg-background flex h-full rounded-sm border overflow-hidden">
			<TabBar />
			<Separator orientation="vertical" />
			<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
		</div>
	);
}
