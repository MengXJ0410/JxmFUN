export const HOME_PAGE_LABELS = ["首页", "关于我", "更多功能"] as const;

export const HOME_BUBBLE_TERMS: string[] = ["棍木", "棍木", "棍木", "棍木", "棍木", "棍木"];

export type HomeFeatureIcon = "bot" | "chat" | "image" | "layers";

export type HomeFeature = {
  icon: HomeFeatureIcon;
  title: string;
  description: string;
};

export const HOME_FEATURES: HomeFeature[] = [
  { icon: "bot", title: "棍木棍木棍木", description: "棍木棍木棍木" },
  { icon: "chat", title: "棍木棍木棍木", description: "棍木棍木棍木" },
  { icon: "image", title: "棍木棍木棍木", description: "棍木棍木棍木" },
  { icon: "layers", title: "棍木棍木棍木", description: "棍木棍木棍木" },
];

export const HOME_COPY = {
  brand: "JXM · PERSONAL SPACE",
  heroTitle: "喵喵喵喵",
  heroSubtitle: "让每一次对话，都成为新的灵感入口。",
  heroCta: "了解这个项目",
  heroExplore: "向下探索",
  returnToGate: "返回传送门",
  authorKicker: "ABOUT THE CREATOR",
  projectKicker: "LUGUAN LUGUAN",
  projectTitle: "棍木棍木棍木",
  projectLead: "棍木棍木棍木",
  aboutExplore: "继续探索",
  moreKicker: "WHAT'S NEXT",
  moreTitle: "更多可能，正在路上",
  moreDescription: "新的想法仍在生长，期待下一次与你见面。",
  moreCta: "回到首页",
} as const;
