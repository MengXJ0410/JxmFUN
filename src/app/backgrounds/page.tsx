import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackgroundsAdmin } from "@/components/backgrounds/backgrounds-admin";
import { isUnlocked } from "@/lib/gate/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "背景图配置 · JxmFUN",
  robots: { index: false, follow: false },
};

export default async function BackgroundsPage() {
  if (!(await isUnlocked())) redirect("/");
  return <BackgroundsAdmin />;
}
