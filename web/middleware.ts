import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  // Allow auth-related routes
  if (isApiAuth) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect unauthenticated users to sign in
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all paths except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
