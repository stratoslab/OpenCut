import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_MARBLE_API_URL: z.url().default("https://api.marblecms.com"),

	// Server
	DATABASE_URL: z.string({
		required_error:
			"DATABASE_URL must be set. Example: postgresql://user:pass@host:5432/db",
	}).refine(
		(url) =>
			url.startsWith("postgres://") || url.startsWith("postgresql://"),
		"DATABASE_URL must be a postgres:// or postgresql:// URL",
	),

	BETTER_AUTH_SECRET: z.string({
		required_error:
			"BETTER_AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32",
	}),
	UPSTASH_REDIS_REST_URL: z.url().default("http://localhost:8079"),
	UPSTASH_REDIS_REST_TOKEN: z.string({
		required_error:
			"UPSTASH_REDIS_REST_TOKEN must be set for production Redis access",
	}),
	MARBLE_WORKSPACE_KEY: z.string().default("dev-key"),
	FREESOUND_CLIENT_ID: z.string().default("dev-client-id"),
	FREESOUND_API_KEY: z.string().default("dev-api-key"),
	DATABUDDY_CLIENT_ID: z.string().default(""),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
