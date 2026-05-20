export interface Env {
	FREESOUND_CLIENT_ID: string;
	FREESOUND_API_KEY: string;
	ALLOWED_ORIGIN: string;
}

function getCorsHeaders(request: Request, allowedOrigin: string) {
	const origin = request.headers.get("Origin");
	if (origin === allowedOrigin || allowedOrigin === "*") {
		return {
			"Access-Control-Allow-Origin": origin || allowedOrigin,
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};
	}
	return {};
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: getCorsHeaders(request, env.ALLOWED_ORIGIN),
			});
		}

		if (url.pathname !== "/api/sounds/search") {
			return new Response("Not found", { status: 404 });
		}

		const corsHeaders = getCorsHeaders(request, env.ALLOWED_ORIGIN);
		if (!corsHeaders["Access-Control-Allow-Origin"]) {
			return new Response(
				JSON.stringify({ error: "Origin not allowed" }),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const query = url.searchParams.get("query");
		if (!query) {
			return new Response(JSON.stringify({ error: "Missing query parameter" }), {
				status: 400,
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}

		const params = new URLSearchParams({
			query,
			format: "json",
			fields: "id,name,previews,tags,duration,license,user,images",
			page_size: url.searchParams.get("page_size") ?? "20",
			page: url.searchParams.get("page") ?? "1",
		});

		const response = await fetch(
			`https://freesound.org/apiv2/search/text/?${params.toString()}`,
			{
				headers: {
					Authorization: `Token ${env.FREESOUND_API_KEY}`,
				},
			},
		);

		if (!response.ok) {
			return new Response(
				JSON.stringify({ error: "Freesound API error", status: response.status }),
				{
					status: response.status,
					headers: { "Content-Type": "application/json", ...corsHeaders },
				},
			);
		}

		const data = await response.json();
		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json",
				...corsHeaders,
			},
		});
	},
} satisfies ExportedHandler<Env>;
