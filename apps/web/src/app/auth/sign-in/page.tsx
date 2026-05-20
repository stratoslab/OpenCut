"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SignInPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const result = await signIn.email({ email, password });
			if (result?.error) {
				toast.error(result.error.message || "Failed to sign in");
			} else {
				toast.success("Signed in successfully");
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
					<CardTitle>Sign in</CardTitle>
					<CardDescription>
						Enter your email and password to access your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
								autoComplete="current-password"
							/>
						</div>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Signing in..." : "Sign in"}
						</Button>
						<p className="text-muted-foreground text-center text-sm">
							Don&apos;t have an account?{" "}
							<Link href="/auth/sign-up" className="text-primary hover:underline">
								Sign up
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
