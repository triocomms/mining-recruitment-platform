import Link from "next/link";
import { redirect } from "next/navigation";
import { createElement as h } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmployerSiteManager } from "@/components/EmployerSiteManager";

export const dynamic = "force-dynamic";

export default async function EmployerSitesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findUnique({ where: { ownerId: session.user.id } });
  if (!company) redirect("/login");

  const sites = await prisma.miningSite.findMany({
    where: { operatorCompanyId: company.id },
    orderBy: { createdAt: "desc" },
  });

  return h(
    "main",
    { className: "mx-auto max-w-5xl px-4 py-8" },
    h(
      "div",
      { className: "flex items-end justify-between gap-3" },
      h("h1", { className: "font-display text-3xl uppercase tracking-wide" }, "Mining sites"),
      h("a", { href: "/dashboard/employer", className: "text-sm underline" }, "← Dashboard")
    ),
    h(
      "p",
      { className: "mt-1 max-w-2xl text-sm text-ink/60" },
      "Add the sites your company operates so candidates can see roster, camp and logistics details on ",
      h(Link, { href: "/sites", className: "underline" }, "the public directory"),
      ". New sites and edits go to an admin for review before they go live."
    ),
    h(
      "div",
      { className: "mt-6" },
      h(EmployerSiteManager, { initialSites: sites as any })
    )
  );
}
