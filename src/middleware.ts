import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Guards /dashboard/* by session and role.
 * Fine-grained authorization still happens in every API route and page —
 * this is a UX layer, not the security boundary.
 */
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    const roleHome =
      role === "EMPLOYER" ? "/dashboard/employer" : role === "ADMIN" ? "/dashboard/admin" : "/dashboard/candidate";

    if (path.startsWith("/dashboard/candidate") && role !== "CANDIDATE") {
      return NextResponse.redirect(new URL(roleHome, req.url));
    }
    if (path.startsWith("/dashboard/employer") && role !== "EMPLOYER") {
      return NextResponse.redirect(new URL(roleHome, req.url));
    }
    if (path.startsWith("/dashboard/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL(roleHome, req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
