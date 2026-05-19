import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { BasePage } from "@/app/base-page";
import type { ArchitectureData } from "@/components/architecture/flow-viewer-types";

export const metadata: Metadata = {
  title: "Architecture - StratosCut",
  description:
    "Explore the interactive StratosCut architecture diagram — nodes, flows, and component relationships across the codebase.",
};

function loadArchitectureData(): ArchitectureData {
  const jsonPath = path.join(process.cwd(), "docs", "architecture-flows.json");

  let raw: string;
  try {
    raw = fs.readFileSync(jsonPath, "utf-8");
  } catch {
    throw new Error("architecture-flows.json not found");
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("architecture-flows.json is invalid JSON");
  }

  const d = data as ArchitectureData;
  if (!d.version || !d.nodes || !d.flows) {
    throw new Error("architecture-flows.json is invalid JSON");
  }

  return d;
}

const FlowViewer = dynamic(
  () => import("@/components/architecture/flow-viewer"),
  { ssr: false }
);

export default function ArchitecturePage() {
  const data = loadArchitectureData();
  return (
    <BasePage maxWidth="full" mainClassName="px-0 pt-0 pb-0 gap-0">
      <FlowViewer data={data} />
    </BasePage>
  );
}
