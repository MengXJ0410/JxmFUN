# Live2D 看板娘（/home）

`/home` 右下角的希罗看板娘。桌面端默认显示半身，手机端默认隐藏，可通过右下角「希罗」按钮显示。

## 1. 文件结构

```text
public/live2d/
├─ core/
│  ├─ live2dcubismcore.min.js   # Live2D Cubism 5 Core（官方原文件）
│  └─ NOTICE.txt
└─ hiro/
   ├─ hiro.model3.json          # 桌面主模型，引用 8192 原图
   ├─ hiro-4096.model3.json     # 小纹理设备回退模型，引用 4096 WebP
   ├─ hiro.moc3                 # 4.66MB，Cubism 5
   ├─ hiro.physics3.json
   ├─ hiro.cdi3.json
   ├─ textures/
   │  ├─ texture_00.png         # 原始 8192×8192，约 26.7MB
   │  └─ texture_00.webp        # 4096×4096 回退，约 1.1MB
   └─ expressions/
      ├─ monvhua.exp3.json      # 抬手 + 魔女笑
      ├─ taishou.exp3.json      # 抬手
      └─ zuibu.exp3.json        # 嘟嘴
```

原始 VTube Studio 文件在 `public/hirolive2d/`，已被 `.gitignore` 和 `.dockerignore` 忽略；生成后的 `public/live2d/hiro/textures/texture_00.png` 会正常提交。

代码：

- `src/components/live2d/live2d-companion.tsx`
- `src/components/live2d/live2d-settings-panel.tsx`
- `src/components/live2d/live2d-companion.module.css`
- `src/lib/live2d/idle.ts`：待机视线漂移/扫视插值
- `src/content/live2d.ts`
- `src/app/home/layout.tsx`

## 2. 资源生成

```bash
python scripts/prepare-live2d.py
```

脚本会：

- 找到 `public/hirolive2d/` 下的 `.model3.json`；
- 复制 `moc3` / `physics3` / `cdi3` / 3 个表情；
- 原样复制 8192 PNG 为 `texture_00.png`；
- 从原图生成 4096 WebP 回退 `texture_00.webp`；
- 生成主模型 `hiro.model3.json` 和回退模型 `hiro-4096.model3.json`，两者都带 `Expressions` 和 `LipSync` 组。

需要本地安装 Pillow：

```bash
pip install pillow
```

## 3. 运行时

- **PixiJS 8** + **untitled-pixi-live2d-engine**（支持 Cubism 3/4/5）。
- 核心脚本在 import 引擎前通过 `<script>` 加载，因为引擎在模块加载时检查 `window.Live2DCubismCore`。
- 模型在页面挂载后延迟约 0.9 秒加载，不阻塞首屏。
- 启动时读取 `gl.MAX_TEXTURE_SIZE`：
  - `>= 8192`：加载 `hiro.model3.json`，使用原始 8192 PNG；
  - `< 8192`：加载 `hiro-4096.model3.json`，使用 4096 WebP 回退。
- 纹理使用 `textureOptions: { lod: "full" }`，保留原图细节，不再自动降采样。
- 桌面 60 FPS，手机 30 FPS；页面隐藏时暂停 ticker。
- 关闭看板娘时销毁 Pixi 实例，释放显存。

## 4. 视线基准

视线以**人物头部/眼睛的屏幕位置**为基准，不再使用浏览器视口中心：

```text
headX = canvas.left + model.bounds.x + model.bounds.width / 2
headY = canvas.top  + model.bounds.y + model.bounds.height * 0.12

dx = (pointerX - headX) / (window.innerWidth * 0.5)
dy = (pointerY - headY) / (window.innerHeight * 0.5)
```

- 鼠标在人物头部时视线回正；
- 鼠标到页面左上/右下时相对头部转动；
- 拖拽、尺寸滑条、窗口尺寸变化后都会重新计算头部锚点。

## 5. 互动参数

这个模型没有 Motion 文件，头部物理的输入是：

| 参数 | 作用 | 取值范围 |
| --- | --- | --- |
| `Param85` | 头部左右 | 约 -30 ~ 30 |
| `Param86` | 头部上下 | 约 -30 ~ 30 |
| `Param87` | 头部倾斜 | 约 -30 ~ 30 |
| `ParamEyeBallX/Y` | 眼球 | -1 ~ 1 |

物理会把 `Param85/86/87` 转成 `ParamAngleX/Y/Z`、`ParamBodyAngleX/Y/Z` 和头发/衣服参数，所以**视线跟随必须驱动 `Param85/86/87`**，不能只驱动 `ParamAngleX/Y/Z`。

框架的 `setParameterValueById` 需要 `CubismId` handle，不能直接传字符串。实现里通过：

```ts
internalModel.getIdSafe("Param85")
// 或
internalModel.idManager.getId("Param85")
```

取 handle。

## 6. 位置、拖拽与穿透

### 默认位置

- 完整人物高度 H = 当前尺寸（默认 100%）；
- 默认顶部 = `视口高度 - 2/3 × H`；
- 默认左侧 = `视口宽度 - 人物宽度`；
- 效果：人物上方 2/3 可见，下方 1/3 在屏幕外（半身）。

### 中键拖拽

- 鼠标中键（`button === 1`）按下并移动才拖拽；
- 左键仍然是点击互动；
- 阻止 Windows 中键自动滚动；
- 使用 pointer capture，鼠标移出画布也能继续拖；
- 横向限制在视口内；
- 纵向允许继续向下拖，但至少保留 1/3 人物可见；
- 向上最多拖到气泡仍在视口内；
- 拖拽位置写入 `localStorage`，刷新后保留。

### 鼠标穿透

人物左侧常驻「鼠标穿透」开关：

- 开启：画布 `pointer-events: none`，点击落到后面的网页；不能点击/拖拽人物；视线继续跟随；
- 关闭：恢复点击、右键设置、中键拖拽；
- 开关、设置齿轮、设置面板始终可点击；
- 状态写入 `localStorage`。

## 7. 设置面板

- **未开启鼠标穿透时**，在人物上右键打开设置面板；
- 人物左侧的设置齿轮也可以打开（手机可用）；
- 面板样式复用「外观设置」的 `appearance-*` 全局样式，跟随浅色/深色模式；
- 面板内容：
  - 显示 / 隐藏人物；
  - 人物大小滑条，70%–130%，默认 100%；
- 面板固定在右键位置或齿轮旁边，并限制在视口内；
- 点击面板外部、按 Escape、点关闭按钮都会关闭；
- 尺寸写入 `localStorage`；
- 隐藏人物时面板可以保持打开，右下角仍保留「希罗」按钮。

## 8. 互动行为

| 行为 | 效果 |
| --- | --- |
| 鼠标移动 | 退出 idle，头部、身体、眼球跟随（相对头部） |
| 鼠标离开 / 静止 3 秒 | 进入 idle，开始东张西望 |
| idle | 慢漂移 + 偶发快速扫视；6–12 秒后首次尝试抬手 |
| idle 抬手 | 保持 2–6 秒后回默认；鼠标回来让当前抬手播完 |
| 点击角色 | 随机抬手/嘟嘴 + 气泡台词（魔女笑暂不启用） |
| 中键拖拽 | 移动人物位置，刷新后保留 |
| 鼠标右键 | 打开设置面板 |
| 鼠标穿透开关 | 让点击穿过人物到网页 |
| 设置齿轮 | 打开设置面板（手机可用） |
| 尺寸滑条 | 70%–130% 调整人物大小，保持半身裁切 |
| 闲置 25–45 秒 | 随机一句台词 |
| 首次加载 | 本次会话说一句问候 |
| 页面切后台 | 暂停渲染 |
| `prefers-reduced-motion` | 气泡/按钮动画关闭，模型仍会呼吸和视线变化 |

### 待机状态机（idle）

- 状态：`follow`（跟随鼠标）→ `idle`（东张西望）→ `react`（点击短暂覆盖）。
- 进入 idle：
  - 鼠标离开页面约 0.8 秒；
  - 或鼠标在页面内静止 3 秒。
- idle 视线：
  - 慢漂移 1.2–2.8 秒；
  - 保持 0.4–1.5 秒；
  - 约 25% 概率用 120–220ms 快速扫视，制造“位置突变”；
  - 左右约 ±0.85，上下 -0.45~0.6。
- idle 抬手：
  - 进入 idle 后 6–12 秒首次尝试；
  - 之后每 12–24 秒尝试一次；
  - 只使用 `taishou`（抬手），保持 2–6 秒后回默认；
  - 鼠标回来时取消尚未触发的抬手，正在播放的抬手播完；
  - 点击可以立即覆盖抬手。
- 魔女笑 `monvhua` 在待机和点击中都暂时不启用，exp3 与台词保留。
- 参数集中在 `src/content/live2d.ts`，视线插值在 `src/lib/live2d/idle.ts`。

台词集中在 `src/content/live2d.ts`，按 AstrBot 里的「希罗」人设提炼，可直接修改。

## 9. localStorage 键

| 键 | 作用 |
| --- | --- |
| `jxmfun-live2d-enabled` | 人物显示/隐藏 |
| `jxmfun-live2d-scale` | 人物大小百分比 |
| `jxmfun-live2d-position` | 拖拽后的 `{left, top}` |
| `jxmfun-live2d-passthrough` | 鼠标穿透状态 |
| `jxmfun-live2d-greeted` | 本次会话是否已问候（sessionStorage） |

## 10. 缓存

`next.config.ts` 为 `/live2d/:path*` 设置：

```text
Cache-Control: public, max-age=604800
```

`hiro.moc3` 额外尝试设置 `Content-Type: text/plain`，让 Cloudflare/Next 自动 gzip（4.66MB → 约 2.77MB）。如果部署后确认没有压缩，可以删掉这条规则，不影响功能。

`texture_00.png` 是 26.7MB 原图，首次加载较慢，之后由浏览器和 Cloudflare 缓存。更新模型时建议换目录版本（例如 `public/live2d/hiro-v2/`）并同步改模型路径，避免 7 天缓存导致旧资源。

## 11. 与 AstrBot 对接（预留，尚未实现）

服务器上的 AstrBot 4.29.1 自带 Open API，且数据库里已有完整的「希罗」人设（`personas` 表，2190 字系统提示词）。

已确认的接入路径：

```text
浏览器 → Next.js /api/companion/chat → http://172.17.0.1:6185/api/v1/chat
                                      Authorization: Bearer <AstrBot API Key>
```

- `mxjweb` 容器已验证可以访问 `http://172.17.0.1:6185`。
- Open API 路由：`POST /api/v1/chat`，支持 SSE 流式返回。
- 请求字段：`message`、`username`、`session_id`、`config_id`、`enable_streaming`。
- 人设：需要把会话的 `persona_id` 设为「希罗」。AstrBot 的 `api_keys` 表当前为空，接入前需要在 AstrBot 面板新建一个带 `chat` 权限的 API Key。
- Next.js 侧新增代理路由，负责：
  - 校验 `isUnlocked()`；
  - 按 IP 限流；
  - 把 AstrBot key 放在服务端环境变量；
  - 解析 SSE，只把纯文本返回给前端。
- 前端只需把气泡 API 换成对话输入框，模型、表情、视线跟随不用改。

本次只做基础互动，没有创建 AstrBot key，也没有写对话 UI。

## 12. 授权

- `live2dcubismcore.min.js` 是 Live2D Inc. 的 Redistributable Code，按官方协议原样分发，见 `public/live2d/core/NOTICE.txt`。
- 模型资源由站点所有者提供。仓库是公开的，提交 `public/live2d/` 后模型可被公开下载；请确认模型的使用与公开授权。

## 13. 排障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 一直显示“加载中” | 8192 贴图较大或请求被拦截 | 看 Network 面板，确认 `hiro.model3.json`、`hiro.moc3`、`texture_00.png` 都是 200 |
| 显示“希罗加载失败” | WebGL 不可用、Core 未加载、moc3 版本不匹配 | 看 Console；确认 `Live2DCubismCore` 存在；moc3 是 v5，需要 Cubism 5 Core |
| 手机上纹理失败/显存不足 | 设备 `MAX_TEXTURE_SIZE < 8192` 或显存不足 | 正常会自动走 `hiro-4096.model3.json`；仍失败时检查 WebGL |
| 有模型但头不跟随 | 只驱动了 `ParamAngleX/Y/Z` | 改为驱动 `Param85/86/87` |
| 视线仍然偏 | 头部锚点计算错误 | 确认使用 canvas 的实际屏幕位置和模型可见 bounds |
| 表情没反应 | `model3.json` 缺 `Expressions` | 用 `scripts/prepare-live2d.py` 重新生成 |
| 中键拖拽触发自动滚动 | 没阻止中键默认行为 | 确认 canvas 上有 `mousedown` / `auxclick` 的 `preventDefault` |
| 穿透后无法关闭 | 穿透开关被画布盖住 | 开关在画布外，检查 `.controls` 的 `pointer-events` |
| 设置面板不跟随明暗 | 没有复用 `appearance-*` 样式 | 确认面板类名包含 `appearance-panel`，且全局 CSS 已加载 |
| 更新模型后仍是旧图 | 7 天缓存 | 换目录版本或改文件名 |
