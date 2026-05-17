import { withBotId } from "botid/next/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextConfig: any = {
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	reactStrictMode: true,
	productionBrowserSourceMaps: true,
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "plus.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.marblecms.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "api.iconify.design",
			},
			{
				protocol: "https",
				hostname: "api.simplesvg.com",
			},
			{
				protocol: "https",
				hostname: "api.unisvg.com",
			},
			{
				protocol: "https",
				hostname: "cdn.brandfetch.io",
			},
		],
	},
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let config: any = withBotId(nextConfig as any);

// Only apply content-collections when not building for Cloudflare Workers
// (content-collections uses dynamic require which breaks opennext bundling)
if (process.env.OPENNEXT !== "true") {
	const { withContentCollections } = require("@content-collections/next");
	config = withContentCollections(config);
}

export default config;
