import { z } from "zod";

const webEnvSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	VITE_SITE_URL: z.string().default("http://localhost:5173"),
	VITE_MARBLE_API_URL: z.string().default("https://api.marblecms.com"),
	VITE_FREESOUND_CLIENT_ID: z.string().default(""),
	VITE_SOUNDS_API_URL: z.string().default("/api/sounds/search"),
	VITE_FEEDBACK_API_URL: z.string().default("/api/feedback"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse({
	NODE_ENV: import.meta.env.MODE,
	VITE_SITE_URL: import.meta.env.VITE_SITE_URL,
	VITE_MARBLE_API_URL: import.meta.env.VITE_MARBLE_API_URL,
	VITE_FREESOUND_CLIENT_ID: import.meta.env.VITE_FREESOUND_CLIENT_ID,
	VITE_SOUNDS_API_URL: import.meta.env.VITE_SOUNDS_API_URL,
	VITE_FEEDBACK_API_URL: import.meta.env.VITE_FEEDBACK_API_URL,
});
