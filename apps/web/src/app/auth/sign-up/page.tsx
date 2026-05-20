"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SignUpPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const result = await signUp.email({ email, password, name });
			if (result?.error) {
				toast.error(result.error.message || "Failed to create account");
			} else {
				toast.success("Account created successfully");
				router.push("/");
				router.refresh();
			}
		} catch {
			toast.error("An unexpected error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Create an account</CardTitle>
					<CardDescription>
						Enter your details to get started
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								type="text"
								placeholder="Your name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								autoComplete="name"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="email"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="new-password"
								minLength={8}
							/>
						</div>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Creating account..." : "Sign up"}
						</Button>
						<p className="text-muted-foreground text-center text-sm">
							Already have an account?{" "}
							<Link href="/auth/sign-in" className="text-primary hover:underline">
								Sign in
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
