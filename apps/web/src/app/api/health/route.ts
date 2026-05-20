import { NextResponse } from "next/server";
import { webEnv } from "@/env/web";

export async function GET() {
	const checks: Record<string, { status: "ok" | "error"; message?: string }> =
		{};

	// Check database connectivity
	try {
		const { db } = await import("@/db");
		await db.execute("SELECT 1");
		checks.database = { status: "ok" };
	} catch (error) {
		checks.database = {
			status: "error",
			message: error instanceof Error ? error.message : "Unknown error",
		};
	}

	// Check Redis connectivity
	try {
		const { Redis } = await import("@upstash/redis");
		const redis = new Redis({
			url: webEnv.UPSTASH_REDIS_REST_URL,
			token: webEnv.UPSTASH_REDIS_REST_TOKEN,
		});
		await redis.ping();
		checks.redis = { status: "ok" };
	} catch (error) {
		checks.redis = {
			status: "error",
			message: error instanceof Error ? error.message : "Unknown error",
		};
	}

	const hasErrors = Object.values(checks).some((c) => c.status === "error");
	const overallStatus = hasErrors ? "degraded" : "healthy";

	return NextResponse.json(
		{
			status: overallStatus,
			timestamp: new Date().toISOString(),
			checks,
		},
		{ status: hasErrors ? 503 : 200 },
	);
}
