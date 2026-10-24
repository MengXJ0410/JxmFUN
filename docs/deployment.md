# 部署说明

## 架构

```text
浏览器
  → https://mxj.jxmfun.xyz
  → Cloudflare
  → Cloudflare Tunnel
  → http://127.0.0.1:3000
  → mxjweb 容器
```

容器只绑定本机回环地址，宿主机不需要开放 3000 端口。

## 前置条件

- 安装 Docker 与 Docker Compose
- 安装并运行 cloudflared
- `jxmfun.xyz` 已接入 Cloudflare 且状态为 Active

## 访问密钥

网关通过运行时环境变量 `SITE_ACCESS_KEY` 读取访问密钥。复制示例文件并设置：

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

密钥只注入容器运行时，不会写入镜像；`.env` 已被 Git 忽略。修改 `.env` 后需要重新创建容器：

```bash
npm run docker:recreate
```

未设置 `SITE_ACCESS_KEY` 时，网关进入彩蛋模式：任意输入均可进入，并显示“呜呜呜我困了，看不见”。此模式仅适合本地调试，生产环境必须设置密钥。

## 首次部署

```bash
git clone https://github.com/MengXJ0410/JxmFUN.git
cd JxmFUN
cp .env.example .env
# 编辑 .env，设置 SITE_ACCESS_KEY
npm install
npm run docker:up
```

`npm run docker:up` 等价于：

```bash
docker compose --env-file .env -f deploy/compose.yml up -d --build
```

验证：

```bash
curl -I http://127.0.0.1:3000
```

未登录访问 `/` 时直接返回验证页，响应中不包含首页正文；`/gate` 返回 `307` 跳转到 `/`。

如果拉取基础镜像失败，可指定镜像源：

```bash
NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine docker compose --env-file .env -f deploy/compose.yml up -d --build
```

PowerShell：

```powershell
$env:NODE_IMAGE="docker.m.daocloud.io/library/node:22-alpine"
npm run docker:up
```

## 访问网关

- 路由：`/` 同时承载验证页和首页，`/api/unlock` 为解锁接口，`/api/lock` 用于清除登录 Cookie；`/gate` 兼容跳转到 `/`。
- 验证成功后写入 `mxj_gate` Cookie：`HttpOnly`、`SameSite=Lax`、`Path=/`，不设置 `Max-Age`，关闭浏览器后失效。
- 同一 IP 连续输错 5 次锁定 5 分钟；记录保存在容器内存中，重启容器后清空。
- 网关页面与首页响应使用 `Cache-Control: private, no-store`，避免代理缓存未验证内容。
- 修改 `SITE_ACCESS_KEY` 后，所有旧 Cookie 立即失效。
- 当前只保护首页内容；`public/images/` 等静态资源仍可直接访问。若需保护整站，需要增加统一的资源网关。

## 背景图配置

背景图属性位于 `config/backgrounds.json`，图片位于 `public/images/backgrounds/`。`deploy/compose.yml` 会挂载：

- `config/` → `/app/config`（可写，供站内 `/backgrounds` 保存配置）
- `public/images/backgrounds/` → `/app/public/images/backgrounds`（只读）

已登录用户可直接访问 `/backgrounds`，也可以从首页外观设置面板进入。新增或替换图片、修改配置后执行：

```bash
npm run docker:recreate
```

不需要重新构建镜像；只有修改应用代码时才需要 `npm run docker:up`。

属性说明：

- `theme`：`day` / `night` / `both`
- `platform`：`computer` / `phone` / `both`
- 手机断点：`760px`
- 未匹配到图片时使用 `both/both` 保底；无保底图时显示纯白/纯黑
- 站内 `/backgrounds` 仅已登录用户可访问，保存会立即写入 `config/backgrounds.json`
- 容器内配置目录可写；图片目录只读，替换图片通过宿主机目录完成

配置维护可使用图形界面：

```bash
npm run backgrounds:gui
```

默认打开 `http://127.0.0.1:4173`，可查看缩略图、预览大图和直接修改属性。更多命令行用法见 README。

## Cloudflare Tunnel

在 Cloudflare Zero Trust 中为隧道添加 Public Hostname：

| 字段 | 值 |
| --- | --- |
| Subdomain | `mxj` |
| Domain | `jxmfun.xyz` |
| Path | 留空 |
| Service Type | `HTTP` |
| Service URL | `127.0.0.1:3000` |

保存后确认 DNS 自动生成的 CNAME 指向 `<tunnel-id>.cfargotunnel.com`，并保持代理开启。SSL/TLS 模式使用 Full。

## 更新

```bash
git pull
npm run docker:up
```

## 日志与状态

```bash
npm run docker:ps
npm run docker:logs
```

## 回滚

```bash
git checkout <previous-commit>
npm run docker:up
```

容器无持久化业务数据，回滚只需要切换代码版本后重新构建。
