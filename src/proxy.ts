import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verify } from "@/lib/session";

/**
 * Reading is public. Only /admin is gated here; every write endpoint enforces
 * its own role with requireRole(), so an anonymous POST reaches the route and
 * is refused there rather than being silently redirected.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verify(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (session.role !== "ADMIN") return NextResponse.redirect(new URL("/", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
