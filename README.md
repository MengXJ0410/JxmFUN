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

访问 http://localhost:3000。

## 生产运行

```bash
docker compose up -d --build
docker compose logs -f mxjweb
```

容器仅监听 `127.0.0.1:3000`，公网流量由 Cloudflare Tunnel 转发，不直接暴露端口。

## 目录结构

```text
src/
├─ app/                 # 路由、布局、全局样式
├─ components/home/     # 首页三个区块与组件
├─ content/             # 站点、作者、页面文案
└─ lib/                 # 外观设置、背景图、滚动与气泡逻辑
public/
└─ images/              # 背景图与头像
docs/
└─ deployment.md        # 部署与运维说明
```

## 修改内容

- 页面文案与功能项：`src/content/home.ts`
- 作者信息与社交链接：`src/content/profile.ts`
- 站点标题与描述：`src/content/site.ts`
- 背景图：`public/images/backgrounds/`，按文件名顺序轮播
- 头像：`public/images/avatar.webp`
- 全局样式：`src/app/globals.css`

修改背景图后需要重新构建容器：

```bash
docker compose up -d --build
```

## 部署

详见 [docs/deployment.md](docs/deployment.md)。
