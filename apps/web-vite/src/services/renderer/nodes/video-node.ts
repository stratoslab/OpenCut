import type { Transition } from "@/timeline";
import {
	VisualNode,
	type ResolvedVisualSourceNodeState,
	type VisualNodeParams,
} from "./visual-node";

export interface NextClipInfo {
	url: string;
	file: File;
	mediaId: string;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
}

export interface VideoNodeParams extends VisualNodeParams {
	url: string;
	file: File;
	mediaId: string;
	exitTransition?: Transition;
	nextClip?: NextClipInfo;
}

export interface ResolvedVideoNodeState extends ResolvedVisualSourceNodeState {
	transitionFrame?: CanvasImageSource;
	transitionProgress?: number;
	transitionWidth?: number;
	transitionHeight?: number;
}

export class VideoNode extends VisualNode<
	VideoNodeParams,
	ResolvedVideoNodeState
> {}
