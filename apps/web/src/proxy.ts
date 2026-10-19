import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect to the login page when there is no session cookie at all.
 * This is a UX convenience only — the API validates the session and enforces
 * every role and ownership rule on each request.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("mf_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
