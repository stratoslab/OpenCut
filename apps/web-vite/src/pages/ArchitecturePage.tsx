import { useState, useEffect } from "react";
import FlowViewer from "@/components/architecture/flow-viewer";
import type { ArchitectureData } from "@/components/architecture/flow-viewer-types";

export default function ArchitecturePage() {
	const [data, setData] = useState<ArchitectureData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/architecture-flows.json")
			.then((res) => {
				if (!res.ok) throw new Error("Failed to load architecture data");
				return res.json();
			})
			.then((json) => setData(json))
			.catch((err) => setError(err.message));
	}, []);

	if (error) {
		return (
			<div className="flex h-[calc(100vh-64px)] items-center justify-center bg-neutral-950 text-neutral-100">
				<p className="text-red-400">{error}</p>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex h-[calc(100vh-64px)] items-center justify-center bg-neutral-950 text-neutral-100">
				<p className="text-neutral-400">Loading architecture...</p>
			</div>
		);
	}

	return <FlowViewer data={data} />;
}
