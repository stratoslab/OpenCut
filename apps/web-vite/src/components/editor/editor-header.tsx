"use client";

import { Button } from "../ui/button";
import { useRef, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Link } from "react-router-dom";
import { RenameProjectDialog } from "@/project/components/rename-project-dialog";
import { DeleteProjectDialog } from "@/project/components/delete-project-dialog";
import { useNavigate } from "react-router-dom";
import { FaDiscord } from "react-icons/fa6";
import { ExportButton } from "./export-button";
import { FeedbackPopover } from "@/feedback/components/feedback-popover";
import { ThemeToggle } from "../theme-toggle";
import { DEFAULT_LOGO_URL } from "@/site/brand";
import { SOCIAL_LINKS } from "@/site/social";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { CommandIcon, Logout05Icon, Download01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShortcutsDialog } from "@/actions/components/shortcuts-dialog";
import Image from "@/components/ui/image";
import { cn } from "@/utils/ui";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { projectBundler, type BundleMetadata } from "@/project/project-bundler";

export function EditorHeader() {
	return (
		<header className="bg-background flex h-[3.4rem] items-center justify-between px-3 pt-0.5">
			<div className="flex items-center gap-1">
				<ProjectDropdown />
				<EditableProjectName />
			</div>
			<nav className="flex items-center gap-2">
				<ProjectBundleButtons />
				<FeedbackPopover />
				<ExportButton />
				<ThemeToggle />
			</nav>
		</header>
	);
}

function ProjectDropdown() {
	const [openDialog, setOpenDialog] = useState<
		"delete" | "rename" | "shortcuts" | null
	>(null);
	const [isExiting, setIsExiting] = useState(false);
	const navigate = useNavigate();
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());

	const handleExit = async () => {
		if (isExiting) return;
		setIsExiting(true);

		try {
			await editor.project.prepareExit();
			editor.project.closeProject();
		} catch (error) {
			console.error("Failed to prepare project exit:", error);
		} finally {
			editor.project.closeProject();
			navigate("/projects");
		}
	};

	const handleSaveProjectName = async (newName: string) => {
		if (
			activeProject &&
			newName.trim() &&
			newName !== activeProject.metadata.name
		) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName.trim(),
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			} finally {
				setOpenDialog(null);
			}
		}
	};

	const handleDeleteProject = async () => {
		if (activeProject) {
			try {
				await editor.project.deleteProjects({
					ids: [activeProject.metadata.id],
				});
				navigate("/projects");
			} catch (error) {
				toast.error("Failed to delete project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			} finally {
				setOpenDialog(null);
			}
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="p-1 rounded-sm size-8">
						<Image
							src={DEFAULT_LOGO_URL}
							alt="Project thumbnail"
							width={32}
							height={32}
							className="invert dark:invert-0 size-5"
						/>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="z-100 w-44">
					<DropdownMenuItem
						onClick={handleExit}
						disabled={isExiting}
						icon={<HugeiconsIcon icon={Logout05Icon} />}
					>
						Exit project
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={() => setOpenDialog("shortcuts")}
						icon={<HugeiconsIcon icon={CommandIcon} />}
					>
						Shortcuts
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem asChild icon={<FaDiscord className="size-4!" />}>
						<a
							href={SOCIAL_LINKS.discord}
							target="_blank"
							rel="noopener noreferrer"
						>
							Discord
						</a>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<RenameProjectDialog
				isOpen={openDialog === "rename"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "rename" : null)}
				onConfirm={(newName) => handleSaveProjectName(newName)}
				projectName={activeProject?.metadata.name || ""}
			/>
			<DeleteProjectDialog
				isOpen={openDialog === "delete"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "delete" : null)}
				onConfirm={handleDeleteProject}
				projectNames={[activeProject?.metadata.name || ""]}
			/>
			<ShortcutsDialog
				isOpen={openDialog === "shortcuts"}
				onOpenChange={(isOpen) => setOpenDialog(isOpen ? "shortcuts" : null)}
			/>
		</>
	);
}

function EditableProjectName() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const originalNameRef = useRef("");

	const projectName = activeProject?.metadata.name || "";

	const startEditing = () => {
		if (isEditing) return;
		originalNameRef.current = projectName;
		setIsEditing(true);

		requestAnimationFrame(() => {
			inputRef.current?.select();
		});
	};

	const saveEdit = async () => {
		if (!inputRef.current || !activeProject) return;
		const newName = inputRef.current.value.trim();
		setIsEditing(false);

		if (!newName) {
			inputRef.current.value = originalNameRef.current;
			return;
		}

		if (newName !== originalNameRef.current) {
			try {
				await editor.project.renameProject({
					id: activeProject.metadata.id,
					name: newName,
				});
			} catch (error) {
				toast.error("Failed to rename project", {
					description:
						error instanceof Error ? error.message : "Please try again",
				});
			}
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			inputRef.current?.blur();
		} else if (event.key === "Escape") {
			event.preventDefault();
			if (inputRef.current) {
				inputRef.current.value = originalNameRef.current;
				inputRef.current.setSelectionRange(0, 0);
			}
			setIsEditing(false);
			inputRef.current?.blur();
		}
	};

	return (
		<input
			ref={inputRef}
			type="text"
			defaultValue={projectName}
			readOnly={!isEditing}
			onClick={startEditing}
			onBlur={saveEdit}
			onKeyDown={handleKeyDown}
			style={{ fieldSizing: "content" }}
			className={cn(
				"text-[0.9rem] h-8 px-2 py-1 rounded-sm bg-transparent outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground",
				isEditing && "ring-1 ring-ring cursor-text hover:bg-transparent",
			)}
		/>
	);
}

function ProjectBundleButtons() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [showImportDialog, setShowImportDialog] = useState(false);
	const [exportName, setExportName] = useState("");
	const [exportDescription, setExportDescription] = useState("");
	const [exportAuthor, setExportAuthor] = useState("");

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
			toast.success("Project exported");
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

			if (!validation.valid) {
				toast.error(`Invalid bundle: ${validation.errors.join(", ")}`);
				return;
			}

			toast.success(`Imported: ${bundle.metadata.name}`);
			setShowImportDialog(false);
		} catch (error) {
			toast.error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	};

	return (
		<>
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={() => {
						setExportName(activeProject?.metadata.name ?? "");
						setShowExportDialog(true);
					}}
				>
					<HugeiconsIcon icon={Download01Icon} className="size-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={() => setShowImportDialog(true)}
				>
					<HugeiconsIcon icon={Upload01Icon} className="size-4" />
				</Button>
			</div>

			<Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Import Project</DialogTitle>
						<DialogDescription>
							Load a .opencut project file.
						</DialogDescription>
					</DialogHeader>
					<div className="rounded border-2 border-dashed p-6 text-center">
						<input
							type="file"
							accept=".opencut,application/x-opencut"
							onChange={handleImport}
							className="hidden"
							id="header-bundle-import"
						/>
						<label
							htmlFor="header-bundle-import"
							className="cursor-pointer text-muted-foreground hover:text-foreground"
						>
							<HugeiconsIcon icon={Upload01Icon} className="mx-auto mb-2 size-8" />
							<p className="text-sm">Click to select a .opencut file</p>
						</label>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
