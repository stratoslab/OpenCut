import { withBotId } from "botid/next/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextConfig: any = {
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	reactStrictMode: true,
	productionBrowserSourceMaps: false,
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
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value:
							"camera=(), microphone=(), geolocation=(), interest-cohort=()",
					},
					{
						key: "Content-Security-Policy",
						value: [
							"default-src 'self'",
							"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.databuddy.cc https://cdn.botid.cc",
							"style-src 'self' 'unsafe-inline'",
							"img-src 'self' data: blob: https://plus.unsplash.com https://images.unsplash.com https://images.marblecms.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com https://cdn.brandfetch.io",
							"font-src 'self' data:",
							"connect-src 'self' https://api.marblecms.com https://freesound.org https://cdn.databuddy.cc https://cdn.botid.cc",
							"media-src 'self' blob: data:",
							"frame-ancestors 'none'",
							"base-uri 'self'",
							"form-action 'self'",
						].join("; "),
					},
				],
			},
		];
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
