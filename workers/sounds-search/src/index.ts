export interface Env {
	FREESOUND_CLIENT_ID: string;
	FREESOUND_API_KEY: string;
}

export default {
	async fetch(request: Request, _env: Env, _ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname !== "/api/sounds/search") {
			return new Response("Not found", { status: 404 });
		}

		const query = url.searchParams.get("query");
		if (!query) {
			return new Response(JSON.stringify({ error: "Missing query parameter" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
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
					Authorization: `Token ${_env.FREESOUND_API_KEY}`,
				},
			},
		);

		if (!response.ok) {
			return new Response(
				JSON.stringify({ error: "Freesound API error", status: response.status }),
				{
					status: response.status,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const data = await response.json();
		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		});
	},
} satisfies ExportedHandler<Env>;
