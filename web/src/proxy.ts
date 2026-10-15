import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getSessionCookieValue } from "@/lib/session-config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login sayfası, public statikler, bundler çıktısı ve cron ping'i serbest
  // (/api/ping kendi CRON_SECRET kontrolünü yapar; buraya takılırsa Vercel cron çalışmaz)
  if (
    pathname === "/api/ping" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(?:ico|png|jpe?g|svg|webp|gif|woff2?|txt)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (session !== getSessionCookieValue()) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
