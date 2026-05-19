import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { initWasmPlanner } from "./transcript-editor/planner";
import { audioEngine } from "./audio/audio-engine";
import { clearPool } from "./video/frame-extractor";
import "./index.css";

function AppWithCleanup() {
	useEffect(() => {
		return () => {
			audioEngine.close();
			clearPool();
		};
	}, []);

	return <App />;
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<HelmetProvider>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				<BrowserRouter>
					<AppWithCleanup />
					<Toaster />
				</BrowserRouter>
			</ThemeProvider>
		</HelmetProvider>
	</StrictMode>,
);

initWasmPlanner();
