import type { EffectElement } from "@/timeline";

export async function hashEffects(effects: EffectElement[]): Promise<string> {
	if (effects.length === 0) return "none";

	const config = effects.map(e => ({
		type: e.type,
		params: e.params,
	}));

	const data = new TextEncoder().encode(JSON.stringify(config));
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map(b => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 16);
}
