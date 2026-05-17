export type Sponsor = {
	name: string;
	url: string;
	logo: string;
	description: string;
	invertOnDark?: boolean;
};

export const SPONSORS: Sponsor[] = [
	{
		name: "Cloudflare",
		url: "https://cloudflare.com?utm_source=stratoscut",
		logo: "/logos/others/cloudflare.svg",
		description: "Platform where we deploy and host StratosCut.",
		invertOnDark: true,
	},
];
