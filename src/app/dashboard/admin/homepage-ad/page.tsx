import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HomepageAdForm } from "@/components/HomepageAdForm";

export const dynamic = "force-dynamic";

export default async function AdminHomepageAdPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const ad = await prisma.homepageAd.findUnique({ where: { id: "homepage-ad" } });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-wide">Homepage ad</h1>
        <a href="/dashboard/admin" className="text-sm underline">← Admin dashboard</a>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Controls the banner ad shown on the homepage. Upload an image, set the link it should open, then turn it
        on — it only appears once an image, a link and "enabled" are all set.
      </p>
      <div className="mt-6">
        <HomepageAdForm
          initial={{
            imageKey: ad?.imageKey ?? null,
            linkUrl: ad?.linkUrl ?? "",
            enabled: ad?.enabled ?? false,
          }}
        />
      </div>
    </main>
  );
}
