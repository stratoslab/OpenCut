import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { initWasmPlanner } from "./transcript-editor/planner";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<HelmetProvider>
			<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
				<BrowserRouter>
					<App />
					<Toaster />
				</BrowserRouter>
			</ThemeProvider>
		</HelmetProvider>
	</StrictMode>,
);

initWasmPlanner();
