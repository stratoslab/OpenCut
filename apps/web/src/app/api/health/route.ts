import { NextResponse } from "next/server";
import { webEnv } from "@/env/web";

export async function GET() {
	const checks: Record<string, { status: "ok" | "error" }> = {};
	const isProd = webEnv.NODE_ENV === "production";

	// Check database connectivity
	try {
		const { db } = await import("@/db");
		await db.execute("SELECT 1");
		checks.database = { status: "ok" };
	} catch {
		checks.database = { status: "error" };
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
	} catch {
		checks.redis = { status: "error" };
	}

	const hasErrors = Object.values(checks).some((c) => c.status === "error");
	const overallStatus = hasErrors ? "degraded" : "healthy";

	const response: Record<string, unknown> = {
		status: overallStatus,
		timestamp: new Date().toISOString(),
	};

	if (!isProd) {
		response.checks = checks;
	}

	return NextResponse.json(response, { status: hasErrors ? 503 : 200 });
}
