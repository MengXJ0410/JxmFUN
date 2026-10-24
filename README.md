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
- 页面只在浅色/深色或窗口宽度变化时重新随机选图
- 无匹配时优先使用 `theme=both` 且 `platform=both` 的保底图；仍无图时显示纯白/纯黑

图形界面（推荐）：

```bash
npm run backgrounds:gui
```

默认打开 `http://127.0.0.1:4173`，左侧显示缩略图和当前属性，右侧可预览大图并修改 `theme` / `platform`。不自动打开浏览器或换端口：

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

`config/` 和 `public/images/backgrounds/` 都会挂载到容器中。现在也可以直接访问站点的 `/backgrounds` 页面，在浏览器里查看缩略图、预览并编辑属性；保存立即写入配置。

在 Docker 中修改背景后执行：

```bash
npm run docker:recreate
```

无需重新构建镜像；只有修改应用代码时才需要 `npm run docker:up`。

## 部署

详见 [docs/deployment.md](docs/deployment.md)。
