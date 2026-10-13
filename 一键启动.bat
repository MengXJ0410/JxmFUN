@echo off
setlocal
cd /d "%~dp0"
title JXM个人网站

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 20.9 或更高版本。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 正在安装项目依赖...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败。
    pause
    exit /b 1
  )
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  if not "%%P"=="0" (
    echo 正在停止占用 3000 端口的进程 %%P...
    taskkill /F /PID %%P >nul 2>nul
  )
)

echo 正在启动网站：http://localhost:3000
echo 关闭此窗口即可停止网站。
call npm run dev -- --hostname 0.0.0.0
pause
