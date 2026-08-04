import { redirect } from "next/navigation";
import { createElement as h } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSiteManager } from "@/components/AdminSiteManager";

export const dynamic = "force-dynamic";

export default async function AdminSitesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

const sites = await prisma.miningSite.findMany({
  orderBy: { createdAt: "desc" },
  include: { operatorCompany: { select: { id: true, name: true, slug: true } } },
});

return h(
  "main",
  { className: "mx-auto max-w-5xl px-4 py-8" },
  h(
    "div",
    { className: "flex items-end justify-between gap-3" },
    h("h1", { className: "font-display text-3xl uppercase tracking-wide" }, "Mining sites"),
    h("a", { href: "/dashboard/admin", className: "text-sm underline" }, "\u2190 Admin dashboard")
    ),
  h(
    "p",
    { className: "mt-1 text-sm text-ink/60" },
    "Roster, access and camp/facility data for physical mine sites, shared across every job posted against them. Sites start as drafts \u2014 publish once the core details are filled in."
    ),
  h(
    "div",
    { className: "mt-6" },
    h(AdminSiteManager, { initialSites: sites as any })
    )
  );
}
