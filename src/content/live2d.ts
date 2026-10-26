// 默认加载 4096 WebP 模型（贴图约 1.1MB）；8192 原图只作为服务器备份保留。
export const LIVE2D_MODEL_PATH = "/live2d/hiro/hiro-4096.model3.json";
export const LIVE2D_CORE_PATH = "/live2d/core/live2dcubismcore.min.js";

// 设置按钮图标（128×128，透明 PNG）；文件缺失时显示「希」字占位。
export const LIVE2D_SETTINGS_ICON_PATH = "/live2d/ui/hiro-settings-02-tiny.png";
// "1" = 已召唤并显示，"0" = 已召唤但隐藏；不存在 = 新访客，默认不加载
export const LIVE2D_STORAGE_KEY = "jxmfun-live2d-enabled";
export const LIVE2D_SESSION_KEY = "jxmfun-live2d-greeted";
export const LIVE2D_SCALE_STORAGE_KEY = "jxmfun-live2d-scale";
export const LIVE2D_POSITION_STORAGE_KEY = "jxmfun-live2d-position";
export const LIVE2D_PASSTHROUGH_STORAGE_KEY = "jxmfun-live2d-passthrough";
export const LIVE2D_SIZE_MIN = 70;
export const LIVE2D_SIZE_MAX = 130;
export const LIVE2D_SIZE_DEFAULT = 100;
export const LIVE2D_MIN_TOP_PX = 64;

export const LIVE2D_EXPRESSIONS = ["monvhua", "taishou", "zuibu"] as const;
export type Live2DExpression = (typeof LIVE2D_EXPRESSIONS)[number];

// 常规互动先不用魔女笑；资源保留，后续需要时再启用。
export const LIVE2D_CLICK_EXPRESSIONS = ["taishou", "zuibu"] as const;
export const LIVE2D_IDLE_POSE: Live2DExpression = "taishou";

export const LIVE2D_IDLE_STILL_MS = 3000;
export const LIVE2D_IDLE_LEAVE_MS = 800;

export const LIVE2D_IDLE_POSE_FIRST_MIN_MS = 6000;
export const LIVE2D_IDLE_POSE_FIRST_MAX_MS = 12000;
export const LIVE2D_IDLE_POSE_REPEAT_MIN_MS = 12000;
export const LIVE2D_IDLE_POSE_REPEAT_MAX_MS = 24000;
export const LIVE2D_IDLE_POSE_RETRY_MIN_MS = 4000;
export const LIVE2D_IDLE_POSE_RETRY_MAX_MS = 8000;
export const LIVE2D_IDLE_POSE_HOLD_MIN_MS = 2000;
export const LIVE2D_IDLE_POSE_HOLD_MAX_MS = 6000;

export const LIVE2D_IDLE_GAZE_X_LIMIT = 0.85;
export const LIVE2D_IDLE_GAZE_Y_MIN = -0.45;
export const LIVE2D_IDLE_GAZE_Y_MAX = 0.6;
export const LIVE2D_IDLE_GAZE_DRIFT_MIN_MS = 1200;
export const LIVE2D_IDLE_GAZE_DRIFT_MAX_MS = 2800;
export const LIVE2D_IDLE_GAZE_HOLD_MIN_MS = 400;
export const LIVE2D_IDLE_GAZE_HOLD_MAX_MS = 1500;
export const LIVE2D_IDLE_GAZE_SACCADE_CHANCE = 0.25;
export const LIVE2D_IDLE_GAZE_SACCADE_MIN_MS = 120;
export const LIVE2D_IDLE_GAZE_SACCADE_MAX_MS = 220;

export const LIVE2D_CLICK_HOLD_MS = 6000;

export const LIVE2D_GREETINGS: readonly string[] = [
  "唉？你来了。既然来了，就好好看看这里，别到处乱走。",
  "你来了。这里还在建设中，不过既然是你，我就勉为其难陪你一会儿。",
];

export const LIVE2D_TAP_LINES: readonly string[] = [
  "别、别突然碰我。有什么事就说。",
  "哼，这种程度的互动，也算不上不正确。",
  "『伪证』我可不是因为被你点到才高兴的。",
  "你、你这笨蛋，别一直戳我。",
];

export const LIVE2D_IDLE_LINES: readonly string[] = [
  "你在看什么？我脸上有东西吗？",
  "没什么事的话，就去做点正确的事吧。",
  "晤......这里安静得有点过分了。",
  "如果你只是路过，那也没关系。",
];

export const LIVE2D_EXPRESSION_LINES: Record<Live2DExpression, string> = {
  monvhua: "这样……可以了吧。别一直盯着看。",
  taishou: "唉......就这一次。",
  zuibu: "你、你这笨蛋，别学我。",
};
