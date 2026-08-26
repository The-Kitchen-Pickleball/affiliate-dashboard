import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** SHA-256 hex (Web Crypto — works in the edge middleware runtime). */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Password gate. Everything requires a valid `dash_auth` cookie except the login
 * page and the login API. The cookie holds SHA-256(DASHBOARD_PASSWORD) — set only
 * after a correct password is entered — so it can't be forged without the password.
 * If DASHBOARD_PASSWORD isn't configured, the gate stays open (avoids locking out
 * during setup); it activates the moment the env var is set.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const pw = process.env.DASHBOARD_PASSWORD;

  // Diagnostic: proves middleware ran and whether it can see the password env var.
  const stamp = (res: NextResponse) => {
    res.headers.set("x-dash-gate", pw ? "armed" : "disarmed");
    return res;
  };

  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return stamp(NextResponse.next());
  }

  if (!pw) return stamp(NextResponse.next());

  const expected = await sha256Hex(pw);
  const cookie = req.cookies.get("dash_auth")?.value;
  if (cookie === expected) return stamp(NextResponse.next());

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return stamp(NextResponse.redirect(url));
}

export const config = {
  // Run on everything except Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
