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

## 首次部署

```bash
git clone https://github.com/MengXJ0410/JxmFUN.git
cd JxmFUN
docker compose up -d --build
```

验证：

```bash
curl -I http://127.0.0.1:3000
```

如果拉取基础镜像失败，可指定镜像源：

```bash
NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine docker compose up -d --build
```

PowerShell：

```powershell
$env:NODE_IMAGE="docker.m.daocloud.io/library/node:22-alpine"
docker compose up -d --build
```

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
docker compose up -d --build
```

## 日志与状态

```bash
docker compose ps
docker compose logs -f mxjweb
```

## 回滚

```bash
git checkout <previous-commit>
docker compose up -d --build
```

容器无持久化业务数据，回滚只需要切换代码版本后重新构建。
