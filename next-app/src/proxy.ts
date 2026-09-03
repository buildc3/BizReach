import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/auth";

/**
 * First-line auth gate (Next 16's renamed `middleware`). Every route handler
 * still calls `requireUser` itself — this is defense-in-depth, not the only
 * check, per Next's own guidance that proxy coverage can silently regress
 * (e.g. a matcher change) — see strategy.md §9.5.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const userId = token ? await verifyToken(token) : null;

  if (userId) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", message: "Not authenticated" },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!login|signup|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
