#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import process from "node:process";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4180;
const DEV_PORT = 3100;
const DEV_URL = `http://127.0.0.1:${DEV_PORT}`;
const isWindows = process.platform === "win32";
const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.DEV_LAUNCHER_PORT || DEFAULT_PORT);
const html = readFileSync(fileURLToPath(new URL("./dev-launcher.html", import.meta.url)), "utf8");
const ROOT = process.cwd();

const jobs = new Map();
let devJob = null;

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        request.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function toolName(tool) {
  if (!isWindows) return tool;
  if (tool === "npm") return "npm.cmd";
  if (tool === "git") return "git.exe";
  if (tool === "ssh") return "ssh.exe";
  return tool;
}

function spawnTool(tool, toolArgs, options) {
  if (isWindows && tool === "npm") {
    const line = `npm.cmd ${toolArgs.map((value) => (/\s/.test(value) ? `"${value}"` : value)).join(" ")}`;
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line], options);
  }
  return spawn(toolName(tool), toolArgs, options);
}

function createJob(kind) {
  const id = `${kind}-${Date.now()}`;
  const job = {
    id,
    kind,
    lines: [],
    done: false,
    code: null,
    child: null,
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

function pushLines(job, chunk) {
  const text = chunk.toString("utf8");
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (!line) continue;
    job.lines.push(line);
  }
  if (job.lines.length > 4000) job.lines.splice(0, job.lines.length - 4000);
}

function attachJob(job, child) {
  job.child = child;
  child.stdout.on("data", (chunk) => pushLines(job, chunk));
  child.stderr.on("data", (chunk) => pushLines(job, chunk));
  child.on("error", (error) => {
    job.lines.push(`[launcher] ${error.message}`);
    job.done = true;
    job.code = -1;
  });
}

function startJob(kind, tool, toolArgs) {
  const job = createJob(kind);
  const child = spawnTool(tool, toolArgs, {
    cwd: ROOT,
    shell: false,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  attachJob(job, child);
  child.on("close", (code) => {
    job.done = true;
    job.code = code;
    job.lines.push(`[launcher] 进程结束，退出码 ${code}`);
  });
  return job;
}

function startChain(kind, commands) {
  const job = createJob(kind);
  let index = 0;
  let failed = null;

  const next = () => {
    if (index >= commands.length) {
      if (failed !== null) job.lines.push(`[launcher] 有步骤失败，退出码 ${failed}`);
      job.done = true;
      job.code = failed ?? 0;
      return;
    }

    const step = commands[index];
    index += 1;
    job.lines.push(`[launcher] $ ${step.tool} ${step.args.join(" ")}`);

    const child = spawnTool(step.tool, step.args, {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });
    job.child = child;
    child.stdout.on("data", (chunk) => pushLines(job, chunk));
    child.stderr.on("data", (chunk) => pushLines(job, chunk));
    child.on("error", (error) => {
      job.lines.push(`[launcher] ${error.message}`);
      if (failed === null) failed = -1;
      next();
    });
    child.on("close", (code) => {
      if (code !== 0 && failed === null) failed = code;
      next();
    });
  };

  next();
  return job;
}

function jobView(job, from = 0) {
  return {
    id: job.id,
    kind: job.kind,
    lines: job.lines.slice(from),
    total: job.lines.length,
    done: job.done,
    code: job.code,
  };
}

function runCommand(tool, toolArgs, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const child = spawnTool(tool, toolArgs, {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: "1" },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (chunk) => { out += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { err += chunk.toString("utf8"); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out: out.trim(), err: err.trim() });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: error.message });
    });
  });
}

async function gitStatus() {
  const [branch, status, log, ahead, behind] = await Promise.all([
    runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
    runCommand("git", ["status", "--porcelain"]),
    runCommand("git", ["log", "--oneline", "-5"]),
    runCommand("git", ["rev-list", "--count", "@{u}..HEAD"]),
    runCommand("git", ["rev-list", "--count", "HEAD..@{u}"]),
  ]);
  return {
    branch: branch.out || "unknown",
    dirty: status.out.length > 0,
    changes: status.out ? status.out.split("\n").slice(0, 30) : [],
    log: log.out ? log.out.split("\n") : [],
    ahead: Number(ahead.out || "0") || 0,
    behind: Number(behind.out || "0") || 0,
    error: branch.code === 0 ? "" : (branch.err || branch.out),
  };
}

async function serverStatus() {
  const result = await runCommand("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=8",
    "mxj",
    "cd /home/mxjserver/website && git log --oneline -1 && echo '---STATUS---' && git status --porcelain | head -20 && echo '---DOCKER---' && docker ps --filter name=mxjweb --format '{{.Names}}|{{.Status}}|{{.Ports}}'",
  ], 25_000);

  const repoPart = result.out.split("---STATUS---")[0]?.trim() || "";
  const afterStatus = result.out.split("---STATUS---")[1] || "";
  const dockerPart = afterStatus.split("---DOCKER---")[1]?.trim() || "";
  return {
    reachable: result.code === 0,
    error: result.code === 0 ? "" : (result.err || result.out || "SSH 连接失败"),
    commit: repoPart.split("\n")[0] || "",
    dirty: Boolean(afterStatus.split("---DOCKER---")[0]?.trim()),
    changes: (afterStatus.split("---DOCKER---")[0]?.trim() || "").split("\n").filter(Boolean),
    container: dockerPart,
  };
}

async function localHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  const started = Date.now();
  try {
    const response = await fetch(`${DEV_URL}/`, { signal: controller.signal, redirect: "manual" });
    return { up: true, status: response.status, ms: Date.now() - started };
  } catch {
    return { up: false, status: 0, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function stopDev() {
  if (!devJob || devJob.done || !devJob.child) return false;
  if (isWindows) {
    spawn("taskkill", ["/PID", String(devJob.child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    devJob.child.kill("SIGTERM");
  }
  devJob = null;
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startDev() {
  stopDev();
  const job = startJob("dev", "npm", ["run", "dev", "--", "-p", String(DEV_PORT)]);
  devJob = job;
  void waitAndOpen();
  return job;
}

async function waitAndOpen() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);
    const health = await localHealth();
    if (health.up) {
      openBrowser(DEV_URL);
      return;
    }
    if (!devJob || devJob.done) return;
  }
}

function openBrowser(url) {
  try {
    if (isWindows) {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // The console already prints the URL.
  }
}

async function handle(request, response) {
  const url = new URL(request.url || "/", `http://${HOST}:${port}`);

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/status") {
    const [git, server, health] = await Promise.all([gitStatus(), serverStatus(), localHealth()]);
    sendJson(response, 200, {
      ok: true,
      git,
      server,
      health,
      dev: { running: Boolean(devJob && !devJob.done), port: DEV_PORT, url: DEV_URL },
      cwd: ROOT,
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/job") {
    const job = jobs.get(url.searchParams.get("id") || "");
    if (!job) return sendJson(response, 404, { error: "任务不存在" });
    sendJson(response, 200, jobView(job, Number(url.searchParams.get("from") || "0")));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/action") {
    const body = await readBody(request);

    if (body.action === "dev") {
      const job = await startDev();
      return sendJson(response, 200, { ok: true, jobId: job.id, url: DEV_URL });
    }

    if (body.action === "stop-dev") {
      return sendJson(response, 200, { ok: true, stopped: stopDev() });
    }

    if (body.action === "push") {
      const status = await gitStatus();
      if (status.branch !== "main") {
        return sendJson(response, 400, { error: `当前分支是 ${status.branch}，不是 main` });
      }
      const job = startChain("push", [
        { tool: "git", args: ["push", "origin", "main"] },
        { tool: "git", args: ["push", "server", "main"] },
      ]);
      return sendJson(response, 200, { ok: true, jobId: job.id });
    }

    if (body.action === "deploy") {
      const job = startJob("deploy", "ssh", [
        "-o", "BatchMode=yes",
        "mxj",
        "cd /home/mxjserver/website && git fetch server && if [ -f config/backgrounds.json ]; then cp -f config/backgrounds.json /tmp/mxj-backgrounds.json; fi && git reset --hard server/main && if [ -f /tmp/mxj-backgrounds.json ]; then cp -f /tmp/mxj-backgrounds.json config/backgrounds.json; fi && docker compose --env-file .env -f deploy/compose.yml up -d --build",
      ]);
      return sendJson(response, 200, { ok: true, jobId: job.id });
    }

    return sendJson(response, 400, { error: "未知操作" });
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!response.headersSent) sendJson(response, 400, { error: message });
    else response.end();
  });
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`[dev-launcher] 端口 ${port} 已被占用，试试 --port ${port + 1}`);
  } else {
    console.error("[dev-launcher]", error);
  }
  process.exitCode = 1;
});

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}`;
  console.log(`[dev-launcher] ${url}`);
  console.log("[dev-launcher] 关闭这个窗口不会自动停止开发服务器；可点“停止本地”");
  if (!args.includes("--no-open")) openBrowser(url);
});
