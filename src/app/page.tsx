import { GateExperience } from "@/components/gate/gate-experience";
import { getHomeBackgrounds } from "@/lib/backgrounds";
import { isUnlocked } from "@/lib/gate/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const unlocked = await isUnlocked();
  return <GateExperience unlocked={unlocked} backgrounds={getHomeBackgrounds()} />;
}
