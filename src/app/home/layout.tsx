import { redirect } from "next/navigation";
import { Live2DCompanion } from "@/components/live2d/live2d-companion";
import { isUnlocked } from "@/lib/gate/server";

export const dynamic = "force-dynamic";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  if (!(await isUnlocked())) redirect("/");
  return (
    <>
      {children}
      <Live2DCompanion />
    </>
  );
}
