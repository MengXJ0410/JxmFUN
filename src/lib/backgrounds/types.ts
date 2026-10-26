import type {
  BackgroundEntry,
  BackgroundFrame,
  BackgroundPlatform,
  BackgroundTheme,
} from "@/lib/home/backgrounds";

export type BackgroundImage = {
  file: string;
  size: number;
  modified: number;
};

export type BackgroundStateEntry = BackgroundEntry & {
  exists: boolean;
};

export type BackgroundState = {
  images: BackgroundImage[];
  entries: BackgroundStateEntry[];
  missing: BackgroundStateEntry[];
};

export type BackgroundMutation = {
  action: "update" | "remove" | "delete" | "sync";
  file?: string;
  theme?: BackgroundTheme;
  platform?: BackgroundPlatform;
  frame?: BackgroundFrame;
  prune?: boolean;
};

export type BackgroundMutationResult = {
  state: BackgroundState;
  added?: number;
  removed?: number;
  file?: string;
};
