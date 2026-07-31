import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Guards /dashboard/* by session and role, and serves a genuine HTTP 410
 * Gone for /jobs/[slug] pages whose job has been permanently ARCHIVED
 * (deleted by its employer, or removed by an admin) rather than the softer
 * 404 that Next.js notFound() gives -- App Router has no supported way to
 * set a custom status code from a Server Component, so that check has to
 * happen here instead of in jobs/[slug]/page.tsx, via a lookup against
 * /api/job-status/[slug].
 */
export default withAuth(
  async function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    // Public job pages: check for a permanently-archived listing and 410 it.
    // "browse" is the static /jobs/browse facet page, not a job slug.
    const jobSlugMatch = path.match(/^\/jobs\/([^/]+)$/);
    if (jobSlugMatch && jobSlugMatch[1] !== "browse") {
      const statusRes = await fetch(new URL(`/api/job-status/${jobSlugMatch[1]}`, req.url));
      const { status } = await statusRes.json().catch(() => ({ status: null }));
      if (status === "ARCHIVED") {
        return new NextResponse("Gone", { status: 410 });
      }
      return NextResponse.next();
    }

    const roleHome =
      role === "EMPLOYER" ? "/dashboard/employer" : role === "ADMIN" ? "/dashboard/admin" : "/dashboard/candidate";

    // Admins can access every dashboard area (e.g. viewing a candidate
    // profile via /dashboard/employer/candidates/[id] to support the admin
    // "View profile" link) -- the role-prefix checks below are a UX
    // convenience for CANDIDATE/EMPLOYER only, never a wall against ADMIN.
    if (role !== "ADMIN") {
      if (path.startsWith("/dashboard/candidate") && role !== "CANDIDATE") {
        return NextResponse.redirect(new URL(roleHome, req.url));
      }
      if (path.startsWith("/dashboard/employer") && role !== "EMPLOYER") {
        return NextResponse.redirect(new URL(roleHome, req.url));
      }
    }
    if (path.startsWith("/dashboard/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL(roleHome, req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    // Without this, next-auth default authorized callback requires a
    // valid session for every matched path -- fine when the matcher was
    // /dashboard/* only, but it would silently force anonymous visitors to
    // /login on every public job page now that /jobs/:slug is matched too.
    // All real gating stays in the function body above.
    callbacks: { authorized: () => true },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/jobs/:path*"],
};
