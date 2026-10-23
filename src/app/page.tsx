import { HomePage } from "@/components/home/home-page";
import { getHomeBackgrounds } from "@/lib/backgrounds";

export default function Home() {
  return <HomePage backgrounds={getHomeBackgrounds()} />;
}
