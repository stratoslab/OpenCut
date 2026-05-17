import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center">
			<h1 className="text-6xl font-bold">404</h1>
			<p className="text-muted-foreground text-lg">Page not found</p>
			<Button asChild>
				<Link to="/">Go Home</Link>
			</Button>
		</div>
	);
}
