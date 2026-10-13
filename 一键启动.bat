@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title JXM个人网站

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请安装 Node.js 20.9 或更高版本后重试。
  pause
  exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 20 || (major === 20 && minor < 9)) process.exit(1)" >nul 2>nul
if errorlevel 1 (
  echo [错误] 当前 Node.js 版本过低，请安装 Node.js 20.9 或更高版本。
  node --version
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 npm，请重新安装 Node.js 并确保 npm 已加入 PATH。
  pause
  exit /b 1
)

if not exist "node_modules\next\dist\bin\next" (
  echo 正在准备项目依赖，首次运行可能需要一些时间...
  if exist "package-lock.json" (
    call npm ci --prefer-offline --no-audit --no-fund
  ) else (
    call npm install --prefer-offline --no-audit --no-fund
  )
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络连接和 package-lock.json 后重试。
    pause
    exit /b 1
  )
)

echo 正在启动网站，请稍候...
echo 默认地址：http://localhost:3000（端口被占用时 Next.js 会自动选择其他端口）
echo 服务启动后请访问终端显示的 Local URL. Close this window to stop.
call npm run dev -- --hostname 0.0.0.0
if errorlevel 1 (
  echo [错误] 网站启动失败。请检查上方错误信息；也可删除 node_modules 后重新运行本脚本。
  pause
  exit /b 1
)
