#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, statfs, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";

const HOST_PROC = process.env.MONITOR_HOST_PROC || "/host/proc";
const HOST_SYS = process.env.MONITOR_HOST_SYS || "/host/sys";
const HOST_ROOT = process.env.MONITOR_HOST_ROOT || "/host/root";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const OUTPUT = process.env.MONITOR_OUTPUT || join(process.cwd(), ".runtime", "monitor.json");
const INTERVAL_MS = Math.max(1000, Number(process.env.MONITOR_INTERVAL_MS || 3000) || 3000);

let previousCpu = null;
let previousNetwork = null;
let previousNetworkAt = 0;
let collecting = false;

async function readText(file, fallback = "") {
  try {
    return await readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

async function readDir(file) {
  try {
    return await readdir(file, { withFileTypes: true });
  } catch {
    return [];
  }
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMeminfo(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^(\w+):\s+(\d+)\s+kB/i);
    if (match) values[match[1]] = Number(match[2]) * 1024;
  }
  return values;
}

function readCpuTimes(text) {
  const line = text.split("\n").find((entry) => entry.startsWith("cpu "));
  if (!line) return null;
  const fields = line.trim().split(/\s+/).slice(1).map((value) => Number(value));
  const total = fields.reduce((sum, value) => sum + value, 0);
  const idle = (fields[3] || 0) + (fields[4] || 0);
  return { total, idle };
}

function cpuUsage(text) {
  const current = readCpuTimes(text);
  if (!current) return 0;
  if (!previousCpu) {
    previousCpu = current;
    return 0;
  }
  const total = current.total - previousCpu.total;
  const idle = current.idle - previousCpu.idle;
  previousCpu = current;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - idle / total)));
}

function readNetwork(text) {
  let rx = 0;
  let tx = 0;
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (!match) continue;
    const name = match[1].trim();
    if (/^(lo|docker|veth|br-|tun|virbr)/i.test(name)) continue;
    const fields = match[2].trim().split(/\s+/).map((value) => Number(value));
    rx += fields[0] || 0;
    tx += fields[8] || 0;
  }
  return { rx, tx };
}

async function readHostNetwork() {
  const hostNetwork = await readText(join(HOST_PROC, "1", "net", "dev"));
  return hostNetwork || readText(join(HOST_PROC, "net", "dev"));
}

function networkRates(text) {
  const current = readNetwork(text);
  const now = Date.now();
  const elapsed = previousNetworkAt ? Math.max(0.001, (now - previousNetworkAt) / 1000) : 0;
  const rxRate = previousNetwork && elapsed ? Math.max(0, (current.rx - previousNetwork.rx) / elapsed) : 0;
  const txRate = previousNetwork && elapsed ? Math.max(0, (current.tx - previousNetwork.tx) / elapsed) : 0;
  previousNetwork = current;
  previousNetworkAt = now;
  return {
    rxBytesPerSec: rxRate,
    txBytesPerSec: txRate,
    rxTotalBytes: current.rx,
    txTotalBytes: current.tx,
  };
}

async function collectTemperature() {
  const sensors = [];
  for (const entry of await readDir(join(HOST_SYS, "class", "thermal"))) {
    if (!entry.name.startsWith("thermal_zone")) continue;
    const base = join(HOST_SYS, "class", "thermal", entry.name);
    const raw = number((await readText(join(base, "temp"))).trim(), NaN);
    if (!Number.isFinite(raw)) continue;
    const type = (await readText(join(base, "type"))).trim() || entry.name;
    sensors.push({ label: type, celsius: raw / 1000 });
  }
  for (const entry of await readDir(join(HOST_SYS, "class", "hwmon"))) {
    if (!entry.name.startsWith("hwmon")) continue;
    const base = join(HOST_SYS, "class", "hwmon", entry.name);
    const name = (await readText(join(base, "name"))).trim() || entry.name;
    for (const file of await readDir(base)) {
      if (!/^temp\d+_input$/.test(file.name)) continue;
      const raw = number((await readText(join(base, file.name))).trim(), NaN);
      if (!Number.isFinite(raw)) continue;
      sensors.push({ label: `${name} ${file.name.replace("_input", "")}`, celsius: raw / 1000 });
    }
  }
  const unique = sensors.filter((sensor, index) => (
    sensor.celsius > -50 && sensor.celsius < 200 &&
    sensors.findIndex((other) => other.label === sensor.label) === index
  ));
  return {
    maxCelsius: unique.length ? Math.max(...unique.map((sensor) => sensor.celsius)) : null,
    sensors: unique,
  };
}

async function collectDisk() {
  try {
    const stats = await statfs(HOST_ROOT);
    const blockSize = number(stats.bsize);
    const total = number(stats.blocks) * blockSize;
    const free = number(stats.bfree) * blockSize;
    const available = number(stats.bavail) * blockSize;
    const used = Math.max(0, total - free);
    return {
      mount: "/",
      totalBytes: total,
      usedBytes: used,
      freeBytes: available,
      percent: total > 0 ? (used / total) * 100 : 0,
    };
  } catch {
    return null;
  }
}

async function collectHost() {
  const [stat, meminfo, loadavg, uptime, hostname, hostRootHostname, version, cpuinfo, thermal, disk, networkText] = await Promise.all([
    readText(join(HOST_PROC, "stat")),
    readText(join(HOST_PROC, "meminfo")),
    readText(join(HOST_PROC, "loadavg")),
    readText(join(HOST_PROC, "uptime")),
    readText(join(HOST_PROC, "sys", "kernel", "hostname")),
    readText(join(HOST_ROOT, "etc", "hostname")),
    readText(join(HOST_PROC, "version")),
    readText(join(HOST_PROC, "cpuinfo")),
    collectTemperature(),
    collectDisk(),
    readHostNetwork(),
  ]);

  const memory = parseMeminfo(meminfo);
  const memTotal = memory.MemTotal || 0;
  const memAvailable = memory.MemAvailable || 0;
  const memUsed = Math.max(0, memTotal - memAvailable);
  const swapTotal = memory.SwapTotal || 0;
  const swapFree = memory.SwapFree || 0;
  const swapUsed = Math.max(0, swapTotal - swapFree);
  const load = loadavg.trim().split(/\s+/).slice(0, 3).map((value) => number(value));
  const model = cpuinfo.match(/model name\s*:\s*(.+)/i)?.[1]?.trim() || "Unknown CPU";
  const uptimeSec = number(uptime.trim().split(/\s+/)[0]);
  const network = networkRates(networkText);

  return {
    hostname: hostRootHostname.trim() || hostname.trim() || os.hostname(),
    kernel: version.trim(),
    uptimeSec,
    cpu: {
      usagePercent: cpuUsage(stat),
      cores: os.cpus().length,
      model,
      load: [load[0] || 0, load[1] || 0, load[2] || 0],
    },
    memory: {
      totalBytes: memTotal,
      usedBytes: memUsed,
      availableBytes: memAvailable,
      percent: memTotal > 0 ? (memUsed / memTotal) * 100 : 0,
    },
    swap: {
      totalBytes: swapTotal,
      usedBytes: swapUsed,
      percent: swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0,
    },
    temperature: thermal,
    disk,
    network,
  };
}

function dockerRequest(pathname, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: DOCKER_SOCKET,
      path: pathname,
      method: "GET",
      timeout: timeoutMs,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if ((response.statusCode || 500) >= 400) {
          reject(new Error(`Docker API ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Docker API timeout")));
    request.on("error", reject);
    request.end();
  });
}

function containerCpu(stats) {
  const current = stats?.cpu_stats;
  const previous = stats?.precpu_stats;
  if (!current?.cpu_usage || !previous?.cpu_usage) return 0;
  const cpuDelta = number(current.cpu_usage.total_usage) - number(previous.cpu_usage.total_usage);
  const systemDelta = number(current.system_cpu_usage) - number(previous.system_cpu_usage);
  const cores = number(current.online_cpus) || current.cpu_usage.percpu_usage?.length || 1;
  if (systemDelta <= 0 || cpuDelta <= 0) return 0;
  return Math.max(0, Math.min(cores * 100, (cpuDelta / systemDelta) * cores * 100));
}

function containerMemory(stats) {
  const usage = number(stats?.memory_stats?.usage);
  const cache = number(stats?.memory_stats?.stats?.inactive_file) || number(stats?.memory_stats?.stats?.cache);
  const used = Math.max(0, usage - cache);
  const limit = number(stats?.memory_stats?.limit);
  return {
    usedBytes: used,
    limitBytes: limit,
    percent: limit > 0 ? (used / limit) * 100 : 0,
  };
}

async function collectDocker() {
  try {
    const [version, list] = await Promise.all([
      dockerRequest("/version"),
      dockerRequest("/containers/json?all=1"),
    ]);
    const containers = Array.isArray(list) ? list : [];
    const running = containers.filter((container) => container.State === "running");
    const stats = await Promise.allSettled(running.map((container) => (
      dockerRequest(`/containers/${container.Id}/stats?stream=false`, 3000)
    )));
    const statsById = new Map();
    running.forEach((container, index) => {
      const result = stats[index];
      if (result?.status === "fulfilled") statsById.set(container.Id, result.value);
    });

    const normalized = containers.map((container) => {
      const stat = statsById.get(container.Id);
      const memory = containerMemory(stat);
      return {
        id: container.Id,
        name: (container.Names?.[0] || "").replace(/^\//, ""),
        image: container.Image || "",
        state: container.State || "unknown",
        status: container.Status || "",
        health: container.Health?.Status || "none",
        cpuPercent: containerCpu(stat),
        memoryUsedBytes: memory.usedBytes,
        memoryLimitBytes: memory.limitBytes,
        memoryPercent: memory.percent,
      };
    }).sort((a, b) => {
      if (a.state === "running" && b.state !== "running") return -1;
      if (a.state !== "running" && b.state === "running") return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      available: true,
      version: version?.Version || "",
      error: "",
      containers: normalized,
      counts: {
        total: containers.length,
        running: running.length,
        stopped: containers.filter((container) => container.State === "exited").length,
        paused: containers.filter((container) => container.State === "paused").length,
        unhealthy: containers.filter((container) => container.Health?.Status === "unhealthy").length,
      },
    };
  } catch (error) {
    return {
      available: false,
      version: "",
      error: error instanceof Error ? error.message : String(error),
      containers: [],
      counts: { total: 0, running: 0, stopped: 0, paused: 0, unhealthy: 0 },
    };
  }
}

async function collect() {
  if (collecting) return;
  collecting = true;
  try {
    const [host, docker] = await Promise.all([
      collectHost().catch((error) => {
        console.error("[monitor] host metrics failed:", error);
        return null;
      }),
      collectDocker(),
    ]);
    if (!host) return;
    const snapshot = { updatedAt: Date.now(), host, docker };
    await mkdir(dirname(OUTPUT), { recursive: true });
    const temp = `${OUTPUT}.tmp`;
    await writeFile(temp, `${JSON.stringify(snapshot)}\n`, { encoding: "utf8", mode: 0o644 });
    await rename(temp, OUTPUT);
  } catch (error) {
    console.error("[monitor] collect failed:", error);
  } finally {
    collecting = false;
  }
}

previousCpu = readCpuTimes(await readText(join(HOST_PROC, "stat")));
previousNetwork = readNetwork(await readHostNetwork());
previousNetworkAt = Date.now();
await new Promise((resolve) => setTimeout(resolve, 300));
await collect();
const timer = setInterval(() => { void collect(); }, INTERVAL_MS);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
