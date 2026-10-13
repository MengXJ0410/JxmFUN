import { HomeHero } from "@/components/home/home-hero";
export default function HomePage() {
  const backgrounds = ["/home-backgrounds/469f1a79d265005f0a22.png", "/home-backgrounds/627e66e94d18e9772d.jpg", "/home-backgrounds/%E7%A0%82%E7%8B%BC%E7%99%BD%E5%AD%90.png", "/home-backgrounds/BLM%7DM%24LTS7U7T%5B3%40M6%7B%5B4CO.jpg", "/home-backgrounds/ScreenShot_2026-02-21_211033_565.png"];
  const normalizedBackgrounds = backgrounds.map((src) => decodeURIComponent(src));
  return <HomeHero backgrounds={normalizedBackgrounds} />;
}
