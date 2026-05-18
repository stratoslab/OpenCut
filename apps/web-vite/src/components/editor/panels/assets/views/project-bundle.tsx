"use client";

import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { projectBundler, type ProjectBundle, type BundleMetadata, type BundleValidationResult } from "@/project/project-bundler";
import { useEditor } from "@/editor/use-editor";
import { Download01Icon, Upload01Icon, CheckmarkCircle01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { cn } from "@/utils/ui";

export function ProjectBundleView() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());

	const [showExportDialog, setShowExportDialog] = useState(false);
	const [showImportDialog, setShowImportDialog] = useState(false);
	const [exportName, setExportName] = useState(activeProject?.metadata.name ?? "");
	const [exportDescription, setExportDescription] = useState("");
	const [exportAuthor, setExportAuthor] = useState("");
	const [validationResult, setValidationResult] = useState<BundleValidationResult | null>(null);

	const handleExport = async () => {
		if (!activeProject) {
			toast.error("No active project");
			return;
		}

		try {
			const mediaAssets = editor.media.getAssets();
			const mediaFiles = mediaAssets.map((asset) => ({
				id: asset.id,
				name: asset.name,
				type: asset.type,
				file: asset.file,
			}));

			const metadata: Partial<BundleMetadata> = {
				name: exportName || activeProject.metadata.name,
				description: exportDescription,
				author: exportAuthor || "OpenCut User",
			};

			const projectData = {
				metadata: activeProject.metadata,
				scenes: activeProject.scenes,
				currentSceneId: activeProject.currentSceneId,
				settings: activeProject.settings,
				version: activeProject.version,
			};

			const bundle = await projectBundler.createBundle(projectData, mediaFiles, metadata);
			const blob = await projectBundler.exportBundle(bundle);

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${bundle.metadata.name.replace(/\s+/g, "-").toLowerCase()}.opencut`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			setShowExportDialog(false);
			toast.success("Project exported successfully");
		} catch (error) {
			toast.error(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	};

	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const blob = new Blob([file], { type: "application/x-opencut" });
			const bundle = await projectBundler.importBundle(blob);
			const validation = projectBundler.validateBundle(bundle);

			setValidationResult(validation);

			if (validation.valid) {
				toast.success(`Imported: ${bundle.metadata.name}`);
				setShowImportDialog(false);
			} else {
				toast.error(`Invalid bundle: ${validation.errors.join(", ")}`);
			}
		} catch (error) {
			toast.error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	};

	return (
		<PanelView title="Project Bundle">
			<div className="flex h-full flex-col p-3 space-y-4">
				<div className="space-y-2">
					<h4 className="text-sm font-medium">Export / Import</h4>
					<p className="text-muted-foreground text-xs">
						Package your entire project including media, timeline, and settings into a single .opencut file.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
						<Button
							variant="outline"
							className="h-20 flex flex-col gap-1"
							onClick={() => {
								setExportName(activeProject?.metadata.name ?? "");
								setShowExportDialog(true);
							}}
						>
							<HugeiconsIcon icon={Download01Icon} className="size-5" />
							<span className="text-xs">Export</span>
						</Button>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Export Project</DialogTitle>
								<DialogDescription>
									Package your project as a .opencut file.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-3">
								<div className="space-y-2">
									<Label className="text-xs">Project Name</Label>
									<Input
										value={exportName}
										onChange={(e) => setExportName(e.target.value)}
										className="h-8 text-xs"
									/>
								</div>
								<div className="space-y-2">
									<Label className="text-xs">Description</Label>
									<Textarea
										value={exportDescription}
										onChange={(e) => setExportDescription(e.target.value)}
										className="text-xs"
										rows={2}
									/>
								</div>
								<div className="space-y-2">
									<Label className="text-xs">Author</Label>
									<Input
										value={exportAuthor}
										onChange={(e) => setExportAuthor(e.target.value)}
										className="h-8 text-xs"
									/>
								</div>
							</div>
							<DialogFooter>
								<Button onClick={handleExport}>Export Project</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					<Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
						<Button
							variant="outline"
							className="h-20 flex flex-col gap-1"
							onClick={() => setShowImportDialog(true)}
						>
							<HugeiconsIcon icon={Upload01Icon} className="size-5" />
							<span className="text-xs">Import</span>
						</Button>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Import Project</DialogTitle>
								<DialogDescription>
									Load a .opencut project file.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-3">
								<div className="rounded border-2 border-dashed p-6 text-center">
									<input
										type="file"
										accept=".opencut,application/x-opencut"
										onChange={handleImport}
										className="hidden"
										id="bundle-import"
									/>
									<label
										htmlFor="bundle-import"
										className="cursor-pointer text-muted-foreground hover:text-foreground"
									>
										<HugeiconsIcon icon={Upload01Icon} className="mx-auto mb-2 size-8" />
										<p className="text-sm">Click to select a file</p>
										<p className="text-xs mt-1">.opencut files only</p>
									</label>
								</div>

								{validationResult && (
									<div
										className={cn(
											"rounded p-3 text-xs",
											validationResult.valid
												? "bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200"
												: "bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200"
										)}
									>
										<div className="flex items-center gap-2">
											<HugeiconsIcon
												icon={validationResult.valid ? CheckmarkCircle01Icon : AlertCircleIcon}
												className="size-4"
											/>
											<span className="font-medium">
												{validationResult.valid ? "Valid Bundle" : "Invalid Bundle"}
											</span>
										</div>
										{validationResult.errors.length > 0 && (
											<ul className="mt-1 list-disc pl-4">
												{validationResult.errors.map((err, i) => (
													<li key={i}>{err}</li>
												))}
											</ul>
										)}
										{validationResult.warnings.length > 0 && (
											<ul className="mt-1 list-disc pl-4 text-yellow-700 dark:text-yellow-300">
												{validationResult.warnings.map((w, i) => (
													<li key={i}>{w}</li>
												))}
											</ul>
										)}
									</div>
								)}
							</div>
						</DialogContent>
					</Dialog>
				</div>

				<div className="space-y-2">
					<h4 className="text-sm font-medium">Bundle Info</h4>
					<div className="space-y-1 rounded border p-3 text-xs">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Version</span>
							<span>1.0.0</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Format</span>
							<span>.opencut</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Media</span>
							<span>{editor.media.getAssets().length} assets</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Scenes</span>
							<span>{activeProject?.scenes?.length ?? 0}</span>
						</div>
					</div>
				</div>
			</div>
		</PanelView>
	);
}
