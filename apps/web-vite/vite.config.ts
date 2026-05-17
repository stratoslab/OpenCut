import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import path from "path";

export default defineConfig({
	plugins: [react(), tailwindcss(), wasm()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	define: {
		global: "globalThis",
		"process.env": "{}",
	},
	worker: {
		format: "es",
	},
	build: {
		target: "esnext",
		rollupOptions: {
			output: {
				manualChunks: {
					"opencut-wasm": ["opencut-wasm"],
					transformers: ["@huggingface/transformers"],
					"editor-core": ["./src/core"],
					ui: [
						"@radix-ui/react-dialog",
						"@radix-ui/react-dropdown-menu",
						"@radix-ui/react-select",
						"@radix-ui/react-tooltip",
					],
				},
			},
		},
	},
});
