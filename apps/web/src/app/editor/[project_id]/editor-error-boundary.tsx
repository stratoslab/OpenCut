"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: ErrorInfo | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
		errorInfo: null,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error, errorInfo: null };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error("Editor error boundary caught:", error, errorInfo);
		this.setState({ error, errorInfo });
	}

	private handleTryAgain = (): void => {
		this.setState({ hasError: false, error: null, errorInfo: null });
	};

	private handleReload = (): void => {
		window.location.reload();
	};

	public render(): ReactNode {
		if (this.state.hasError) {
			return (
				<div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-6 p-8">
					<div className="text-destructive text-6xl">⚠</div>
					<h1 className="text-foreground text-2xl font-semibold">
						Something went wrong
					</h1>
					<p className="text-muted-foreground max-w-md text-center text-sm">
						An error occurred in the editor. Your project data is safe — try
						reloading or starting a fresh session.
					</p>
					{this.state.error && (
						<details className="text-muted-foreground max-h-48 w-full max-w-2xl overflow-auto rounded border bg-muted/50 p-4 text-xs font-mono">
							<summary className="cursor-pointer font-sans font-medium">
								Error details
							</summary>
							<pre className="mt-2 whitespace-pre-wrap">
								{this.state.error.toString()}
								{this.state.errorInfo?.componentStack}
							</pre>
						</details>
					)}
					<div className="flex gap-3">
						<Button onClick={this.handleTryAgain}>Try Again</Button>
						<Button variant="outline" onClick={this.handleReload}>
							Reload Page
						</Button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
