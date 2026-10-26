import { redirect } from "next/navigation";
import { MonitorDashboard } from "@/components/home/monitor-dashboard";
import { RealHomeShell } from "@/components/home/real-home-shell";
import { isUnlocked } from "@/lib/gate/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "JXM · 监控室",
};

export default async function MonitorPage() {
  if (!(await isUnlocked())) redirect("/");
  return (
    <RealHomeShell active="monitor">
      <MonitorDashboard />
    </RealHomeShell>
  );
}
