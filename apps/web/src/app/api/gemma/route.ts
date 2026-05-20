import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const gemmaRequestSchema = z.object({
	prompt: z.string().min(1, "Prompt is required"),
});

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = gemmaRequestSchema.safeParse(body);

	if (!result.success) {
		return NextResponse.json(
			{ error: "Invalid input", details: result.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}

	// Gemma LLM requires a local model server or cloud API.
	// This endpoint is a placeholder until a Gemma server is configured.
	// To enable: set GEMMA_API_URL env var pointing to a running Gemma server.
	const gemmaApiUrl = process.env.GEMMA_API_URL;

	if (!gemmaApiUrl) {
		return NextResponse.json(
			{
				error: "Gemma LLM not configured",
				message:
					"AI transcript editing requires a Gemma model server. Set GEMMA_API_URL environment variable to enable this feature.",
			},
			{ status: 501 },
		);
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);

		const response = await fetch(gemmaApiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt: result.data.prompt }),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			return NextResponse.json(
				{ error: "Gemma server error", details: errorText },
				{ status: response.status },
			);
		}

		const data = await response.json();
		return NextResponse.json({ response: data.response || data.text || "" });
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return NextResponse.json(
				{ error: "Gemma request timed out" },
				{ status: 504 },
			);
		}
		return NextResponse.json(
			{ error: "Failed to connect to Gemma server" },
			{ status: 502 },
		);
	}
}
