import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/editor", "/projects"];

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const isProtected = protectedRoutes.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);

	if (!isProtected) {
		return NextResponse.next();
	}

	const sessionCookie = request.cookies.get("better-auth.session_token");

	if (!sessionCookie) {
		const signInUrl = new URL("/auth/sign-in", request.url);
		signInUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(signInUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/editor/:path*", "/projects/:path*"],
};
