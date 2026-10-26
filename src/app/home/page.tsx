import { redirect } from "next/navigation";
import { RealHomeShell } from "@/components/home/real-home-shell";
import { isUnlocked } from "@/lib/gate/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "JXM · 个人网站",
};

export default async function RealHomePage() {
  if (!(await isUnlocked())) redirect("/");
  return <RealHomeShell active="home" />;
}
