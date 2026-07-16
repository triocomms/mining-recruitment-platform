import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardRoot() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role === "EMPLOYER") redirect("/dashboard/employer");
  if (role === "ADMIN") redirect("/dashboard/admin");
  redirect("/dashboard/candidate");
}
