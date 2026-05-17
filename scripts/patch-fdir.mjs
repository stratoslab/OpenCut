#!/usr/bin/env node
// Patch fdir ESM module to use standard require instead of bun-specific __require
// This fixes esbuild bundling errors with opennextjs-cloudflare

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

function patchFdir(dir) {
	const fdirPath = join(dir, "fdir/dist/index.mjs");
	if (!existsSync(fdirPath)) return false;

	let content = readFileSync(fdirPath, "utf-8");
	if (content.includes("__require.resolve")) {
		content = content
			.replace(/__require\.resolve/g, 'typeof require !== "undefined" && require.resolve')
			.replace(/__require\(/g, "require(");
		writeFileSync(fdirPath, content);
		console.log(`Patched ${fdirPath}`);
		return true;
	}
	return false;
}

// Check root node_modules
patchFdir("node_modules");

// Check .bun directory
const bunDir = "node_modules/.bun";
if (existsSync(bunDir)) {
	const entries = readdirSync(bunDir);
	for (const entry of entries) {
		if (entry.startsWith("fdir@")) {
			patchFdir(join(bunDir, entry, "node_modules"));
		}
	}
}

// Check apps/web node_modules
patchFdir("apps/web/node_modules");
