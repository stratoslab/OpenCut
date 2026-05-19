import { Routes, Route } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { BotIdClient } from "botid/client";
import { baseMetaData } from "./app/metadata";
import { Helmet } from "react-helmet-async";
import LandingPage from "./pages/LandingPage";
import ProjectsPage from "./pages/ProjectsPage";
import EditorPage from "./pages/EditorPage";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";
import ChangelogIndex from "./pages/ChangelogIndex";
import ChangelogDetail from "./pages/ChangelogDetail";
import ContributorsPage from "./pages/ContributorsPage";
import RoadmapPage from "./pages/RoadmapPage";
import SponsorsPage from "./pages/SponsorsPage";
import BrandPage from "./pages/BrandPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import NotFoundPage from "./pages/NotFoundPage";
import ArchitecturePage from "./pages/ArchitecturePage";

export default function App() {
	return (
		<div className="font-sans antialiased">
			<Helmet>
				<title>{baseMetaData.title}</title>
				<meta name="description" content={baseMetaData.description} />
			</Helmet>
			<BotIdClient protect={[]} />
			<TooltipProvider>
				<Routes>
					<Route path="/" element={<LandingPage />} />
					<Route path="/projects" element={<ProjectsPage />} />
					<Route path="/editor/:projectId" element={<EditorPage />} />
					<Route path="/blog" element={<BlogIndex />} />
					<Route path="/blog/:slug" element={<BlogPost />} />
					<Route path="/changelog" element={<ChangelogIndex />} />
					<Route path="/changelog/:version" element={<ChangelogDetail />} />
					<Route path="/contributors" element={<ContributorsPage />} />
					<Route path="/roadmap" element={<RoadmapPage />} />
					<Route path="/sponsors" element={<SponsorsPage />} />
					<Route path="/brand" element={<BrandPage />} />
					<Route path="/privacy" element={<PrivacyPage />} />
				<Route path="/terms" element={<TermsPage />} />
				<Route path="/architecture" element={<ArchitecturePage />} />
				<Route path="*" element={<NotFoundPage />} />
				</Routes>
			</TooltipProvider>
		</div>
	);
}
