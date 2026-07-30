import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Every route is gated except the login page and its action. The app holds
// live bank data and has no per-user model, so the default is deny.
export async function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;

  // Fail closed. A missing secret must not silently disable the gate.
  if (!secret) {
    return NextResponse.json(
      { error: "server_misconfigured", detail: "AUTH_SECRET is not set" },
      { status: 503 }
    );
  }

  const ok = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (ok) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  // Plaid cannot authenticate with a session cookie. This route verifies the
  // Plaid-Verification JWT itself and rejects anything unsigned.
  if (pathname === "/api/plaid/webhook") return NextResponse.next();

  // API callers get a status they can act on rather than a login redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Exclude static assets, or the login page loads without CSS.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
