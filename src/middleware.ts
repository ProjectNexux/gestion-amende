import { NextRequest, NextResponse } from "next/server";

/**
 * Espace client (2026-08-24): server-side gate for the CLIENT role, enforced BEFORE any page or
 * API route handler runs — a client can never reach an admin page/route just by typing its URL,
 * regardless of what the UI shows/hides. Only cookies are read here (no DB call), matching the
 * rest of the app's cookie-based session model.
 *
 * Requests with no "role" cookie at all (not logged in, or server-to-server calls like the email
 * poll scheduler's internal fetch) are left untouched — existing per-page requireSociete()/login
 * redirects already handle that case.
 */
const CLIENT_ALLOWED_PREFIXES = ["/client", "/login", "/api/logout", "/api/client", "/client-setup"];

function isAllowedForClient(pathname: string): boolean {
  return CLIENT_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(req: NextRequest) {
  const role = req.cookies.get("role")?.value;
  if (role !== "client") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isAllowedForClient(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/client", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|tessdata).*)"],
};
