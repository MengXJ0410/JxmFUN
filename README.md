# JxmFUN

个人主页项目，基于 Next.js 16 与 Tailwind CSS 4，生产环境通过 Docker 运行，并由 Cloudflare Tunnel 暴露到公网。

## 线上地址

https://mxj.jxmfun.xyz

## 技术栈

- Next.js 16（App Router，standalone 输出）
- React 19
- Tailwind CSS 4
- Docker / Docker Compose
- Cloudflare Tunnel

## 本地开发

```bash
npm install
npm run dev
```

访问 http://localhost:3000。未登录时 `/` 会直接显示验证页。

本地调试若暂时不想配置密钥，可跳过 `.env`；网关会进入彩蛋模式，任意输入均可进入。

## 访问密钥

复制环境变量示例并设置 `SITE_ACCESS_KEY`：

```bash
cp .env.example .env
```

```dotenv
SITE_ACCESS_KEY=请替换为足够长的随机字符串
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

说明：

- 访问 `https://mxj.jxmfun.xyz` 时，未验证用户在 `/` 看到验证页；`/gate` 仅兼容跳转到 `/`。
- 验证成功后写入仅当前浏览器会话有效的 `HttpOnly` Cookie，关闭浏览器后需要重新验证。
- 同一 IP 连续输错 5 次会锁定 5 分钟；锁定记录保存在容器内存中，重启容器后清空。
- 未设置 `SITE_ACCESS_KEY` 时，网关会显示“呜呜呜我困了，看不见”，任何输入都可以进入。这仅适合本地调试，生产环境务必设置密钥。
- 已登录后可访问 `/backgrounds` 管理背景图；外观设置面板中也提供了入口。
- 首页左下角的“返回传送门”会清除当前登录 Cookie 并回到 `/` 验证页；上次成功输入的密钥会保留在当前标签页，方便再次进入。
- 修改密钥后执行 `npm run docker:recreate`，旧 Cookie 会立即失效。

## 本地开发启动器

```bash
npm run dev:ui
```

打开 `http://127.0.0.1:4180`，提供：

- 启动本地测试：重启 `3100` 端口开发服务器并打开网页
- 停止本地开发服务器
- 执行 git 推送：同时推送 `origin` 和服务器 `server` 远程
- 服务端拉取并重启：通过 SSH 让服务器同步并重建容器

右侧控制台显示实时日志；左侧显示本地开发、Git 和服务器容器状态。

## 生产运行

```bash
npm run docker:up
npm run docker:logs
```

等价于：

```bash
docker compose --env-file .env -f deploy/compose.yml up -d --build
```

容器仅监听 `127.0.0.1:3000`，公网流量由 Cloudflare Tunnel 转发，不直接暴露端口。

## 根目录说明

根目录只保留工具链必须从固定位置读取的文件：

- `package.json`、`package-lock.json`：依赖与脚本
- `next.config.ts`、`next-env.d.ts`、`tsconfig.json`：Next.js 与 TypeScript 约定
- `eslint.config.mjs`、`postcss.config.mjs`：ESLint 与 PostCSS 自动发现
- `.env*`、`.gitignore`、`.gitattributes`、`README.md`：环境与仓库配置
Docker 相关文件已集中到 `deploy/`，背景图配置集中在 `config/`。

## 目录结构

```text
src/
├─ app/                 # 路由、布局、全局样式、访问验证页与解锁接口
├─ components/home/     # 首页三个区块与组件
├─ components/gate/     # 访问验证终端与 Matrix 雨
├─ content/             # 站点、作者、页面文案
└─ lib/                 # 外观、背景图、滚动与气泡、网关逻辑
public/
└─ images/              # 背景图与头像
config/
└─ backgrounds.json     # 背景图主题与端配置
deploy/
├─ Dockerfile           # 生产镜像
└─ compose.yml          # 容器编排与端口
scripts/
└─ backgrounds.mjs      # 背景配置快捷编辑脚本
docs/
└─ deployment.md        # 部署与运维说明
```

## 修改内容

- 页面文案与功能项：`src/content/home.ts`
- 作者信息与社交链接：`src/content/profile.ts`
- 站点标题与描述：`src/content/site.ts`
- 背景图文件：`public/images/backgrounds/`
- 背景图属性：`config/backgrounds.json`
- 头像：`public/images/avatar.webp`
- 全局样式：`src/app/globals.css`
- 网关文案与动画时长：`src/content/gate.ts`
- 网关样式：`src/components/gate/gate.module.css`
- Live2D 台词：`src/content/live2d.ts`
- Live2D 组件与样式：`src/components/live2d/`

## Live2D 看板娘

`/home` 右下角显示希罗看板娘，桌面默认显示半身、手机默认隐藏。模型资源在 `public/live2d/`，原始 VTube Studio 文件在 `public/hirolive2d/`（不入库）。

- 主贴图：默认 4096 WebP（约 1.1MB）；8192 原图（约 26.7MB）只留在服务器做备份，不参与加载
- 加载反馈：人物区域中央显示进度条与「希罗回溯中……」
- 重新生成资源：`python scripts/prepare-live2d.py`
- 说明文档：[docs/live2d.md](docs/live2d.md)
- 互动：头部视线跟随、待机东张西望、偶发抬手、点击表情、气泡台词、中键拖拽、鼠标穿透
- 待机：鼠标离开或静止 3 秒后随机看四周，偶尔抬手 2–6 秒；点击只用抬手/嘟嘴，魔女笑暂不启用
- 设置：右键人物或点左侧设置按钮，可显示/隐藏、调整大小、开关鼠标穿透；面板与「外观设置」同款并跟随明暗模式
- 设置图标：`public/live2d/ui/hiro-settings-02-tiny.png`（128×128 透明 PNG），缺失时显示「希」字占位；悬停有提示和 Q 弹动画，面板打开时高亮
- AI 对话：本次未接入，AstrBot 对接方案见 `docs/live2d.md`

### 背景图配置

每张背景图在 `config/backgrounds.json` 中声明：

```json
{
  "file": "bg_001.webp",
  "theme": "night",
  "platform": "computer"
}
```

- `theme`：`day` / `night` / `both`
- `platform`：`computer` / `phone` / `both`
- 手机断点：`760px`
- 首次进入随机起点，之后每 5 秒按配置顺序轮换
- 每张背景从右向左漂移，并带鼠标视差
- 无匹配时优先使用 `theme=both` 且 `platform=both` 的保底图；仍无图时显示纯白/纯黑

图形界面（推荐）：

```bash
npm run backgrounds:gui
```

默认打开 `http://127.0.0.1:4173`，左侧显示缩略图和当前属性，右侧可预览大图、修改 `theme` / `platform`，并上传 WebP 背景图。上传会自动命名为下一个 `bg_XXX.webp`。不自动打开浏览器或换端口：

```bash
npm run backgrounds:gui -- --no-open --port 4174
```

命令行操作：

```bash
npm run backgrounds -- sync
npm run backgrounds -- sync --prune
npm run backgrounds -- status
npm run backgrounds -- list
npm run backgrounds -- set bg_001 theme=night platform=computer
npm run backgrounds -- remove bg_001
```

`config/` 和 `public/images/backgrounds/` 都会挂载到容器中。已登录后可直接访问 `/backgrounds`，查看缩略图、预览、编辑属性，并上传 WebP 背景图；上传会自动命名为下一个 `bg_XXX.webp`。

在 Docker 中修改背景后执行：

```bash
npm run docker:recreate
```

无需重新构建镜像；只有修改应用代码时才需要 `npm run docker:up`。

## 部署

详见 [docs/deployment.md](docs/deployment.md)。
