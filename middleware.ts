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
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return NextResponse.next();

  const expected = await sha256Hex(pw);
  const cookie = req.cookies.get("dash_auth")?.value;
  if (cookie === expected) return NextResponse.next();

  // One login for dashboard.thekitchenpickle.com: the kitchen-social project
  // (which owns the domain and forwards /affiliate here) sets ks_auth =
  // SHA-256(its password). Accept that too, so signing in there covers this
  // section. SOCIAL_AUTH_HASH is that hash (env var, never committed — public repo).
  const social = process.env.SOCIAL_AUTH_HASH;
  if (social && req.cookies.get("ks_auth")?.value === social) return NextResponse.next();

  // A fetch() can't use a redirect to the login page — it would try to parse the
  // HTML as JSON ("Unexpected token <"). Say what actually happened instead.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in to the affiliate dashboard. Reload the page to sign in." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
