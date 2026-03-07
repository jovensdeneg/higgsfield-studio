import { NextRequest, NextResponse } from "next/server";

/**
 * Basic Auth middleware — protects all pages.
 * Credentials are read from environment variables AUTH_USER and AUTH_PASSWORD.
 */
export function middleware(request: NextRequest) {
  const user = process.env.AUTH_USER;
  const password = process.env.AUTH_PASSWORD;

  // If credentials are not configured, skip auth
  if (!user || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [u, p] = decoded.split(":");
      if (u === user && p === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Jovens de Negocios"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
