import type { Transition, TransitionType } from "@/timeline";
import { BaseNode } from "./base-node";
import type { AnyBaseNode } from "./base-node";

export interface TransitionNodeParams {
	transition: Transition;
	transitionStart: number;
	transitionEnd: number;
	outgoingNode: AnyBaseNode;
	incomingNode: AnyBaseNode;
}

export interface ResolvedTransitionNodeState {
	progress: number;
	outgoingResolved: boolean;
	incomingResolved: boolean;
}

export class TransitionNode extends BaseNode<
	TransitionNodeParams,
	ResolvedTransitionNodeState
> {
	constructor(params: TransitionNodeParams) {
		super(params);
		this.children = [params.outgoingNode, params.incomingNode];
	}

	get transitionType(): TransitionType {
		return this.params.transition.type;
	}

	get duration(): number {
		return this.params.transition.duration;
	}
}
