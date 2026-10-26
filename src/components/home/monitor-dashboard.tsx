"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  Container,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Thermometer,
} from "lucide-react";
import type { MonitorContainer, MonitorSnapshot } from "@/lib/monitor/types";
import styles from "./monitor-dashboard.module.css";

const CORE_CONTAINERS = ["mxjweb", "astrbot", "napcat", "easytier"];
const HISTORY_LIMIT = 20;

type HistoryPoint = {
  t: number;
  cpu: number;
  memory: number;
  temperature: number | null;
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatRate(value: number) {
  return `${formatBytes(value)}/s`;
}

function formatUptime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", { hour12: false });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function Sparkline({ values, color, max = 100 }: { values: number[]; color: string; max?: number }) {
  const points = values.length > 1 ? values : [0, ...values];
  const step = 100 / Math.max(1, points.length - 1);
  const line = points.map((value, index) => {
    const x = index * step;
    const y = 28 - (clampPercent((value / max) * 100) / 100) * 26;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className={styles.sparkline} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,30 ${line} 100,30`} fill={color} opacity="0.09" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function containerStateClass(container: MonitorContainer) {
  if (container.health === "unhealthy") return styles.stateBad;
  if (container.state !== "running") return styles.stateWarn;
  if (container.health === "healthy") return styles.stateOk;
  return styles.stateIdle;
}

function containerHealth(container: MonitorContainer) {
  if (container.health === "healthy") return <span className={styles.healthOk}>healthy</span>;
  if (container.health === "unhealthy") return <span className={styles.healthBad}>unhealthy</span>;
  if (container.state !== "running") return <span className={styles.healthWarn}>{container.state}</span>;
  return <span className={styles.healthIdle}>—</span>;
}

export function MonitorDashboard() {
  const [data, setData] = useState<MonitorSnapshot | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/monitor", { cache: "no-store" });
      const payload = await response.json() as { data?: MonitorSnapshot; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "监控数据读取失败");
      const next = payload.data;
      setData(next);
      setError("");
      setStale(Date.now() - next.updatedAt > 15_000);
      setHistory((current) => {
        const last = current[current.length - 1];
        if (last?.t === next.updatedAt) return current;
        return [...current, {
          t: next.updatedAt,
          cpu: next.host.cpu.usagePercent,
          memory: next.host.memory.percent,
          temperature: next.host.temperature.maxCelsius,
        }].slice(-HISTORY_LIMIT);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "监控数据读取失败");
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 3000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  const containers = data?.docker.containers ?? [];
  const coreContainers = containers.filter((container) => CORE_CONTAINERS.includes(container.name));
  const displayedContainers = showAll
    ? containers
    : coreContainers.length > 0 ? coreContainers : containers.slice(0, 4);
  const hiddenCount = Math.max(0, containers.length - displayedContainers.length);
  const cpuHistory = useMemo(() => history.map((point) => point.cpu), [history]);
  const memoryHistory = useMemo(() => history.map((point) => point.memory), [history]);
  const temperatureHistory = useMemo(() => history.map((point) => point.temperature ?? 0), [history]);

  if (!data && loading) {
    return <div className={styles.dashboard}><div className={styles.loading}><RefreshCw className={styles.spin} size={18} />正在读取服务器监控数据...</div></div>;
  }

  if (!data) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.banner}>
          <CircleAlert size={16} />
          <span>{error || "监控数据尚未生成，请确认 mxjmonitor 正在运行。"}</span>
          <button type="button" onClick={() => void load()}><RefreshCw size={14} />重试</button>
        </div>
      </div>
    );
  }

  const host = data.host;
  const docker = data.docker;
  const cpuWarn = host.cpu.usagePercent > 85;
  const memoryWarn = host.memory.percent > 90;
  const temperatureWarn = (host.temperature.maxCelsius ?? 0) > 75;
  const diskWarn = (host.disk?.percent ?? 0) > 90;
  const dockerWarn = docker.counts.unhealthy > 0 || docker.counts.stopped > 0;

  return (
    <div className={styles.dashboard}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>SERVER OBSERVATORY</span>
          <h1>监控室</h1>
          <p>服务器硬件、运行状态与 Docker 后台服务</p>
        </div>
        <div className={styles.headActions}>
          <span className={`${styles.live} ${stale ? styles.liveStale : ""}`}>
            <i />{stale ? "数据已过期" : "实时数据"}
          </span>
          <span className={styles.updated}><Clock3 size={13} />{formatTime(data.updatedAt)}</span>
          <button className={styles.refresh} type="button" onClick={() => void load()} aria-label="刷新监控数据"><RefreshCw size={15} /></button>
        </div>
      </header>

      {stale ? <div className={styles.banner}><CircleAlert size={16} /><span>数据超过 15 秒未更新，请检查 mxjmonitor 容器。</span></div> : null}
      {error ? <div className={styles.banner}><CircleAlert size={16} /><span>{error}</span></div> : null}

      <section className={styles.grid} aria-label="硬件状态">
        <article className={`${styles.card} ${cpuWarn ? styles.cardWarn : ""}`}>
          <div className={styles.cardHead}><span><Cpu size={15} />CPU</span><span className={styles.cardTag}>{host.cpu.cores} 核</span></div>
          <div className={styles.cardValue}>{host.cpu.usagePercent.toFixed(1)}<small>%</small></div>
          <div className={styles.meta}>负载 {host.cpu.load.map((value) => value.toFixed(2)).join(" / ")}</div>
          <Sparkline values={cpuHistory} color="var(--mon-cyan)" />
          <div className={styles.bar}><i style={{ width: `${clampPercent(host.cpu.usagePercent)}%` }} /></div>
          <div className={styles.cardFoot}>{host.cpu.model}</div>
        </article>

        <article className={`${styles.card} ${memoryWarn ? styles.cardWarn : ""}`}>
          <div className={styles.cardHead}><span><MemoryStick size={15} />内存</span><span className={styles.cardTag}>{host.memory.percent.toFixed(1)}%</span></div>
          <div className={styles.cardValue}>{formatBytes(host.memory.usedBytes)}<small> / {formatBytes(host.memory.totalBytes)}</small></div>
          <div className={styles.meta}>可用 {formatBytes(host.memory.availableBytes)} · Swap {formatBytes(host.swap.usedBytes)} / {formatBytes(host.swap.totalBytes)}</div>
          <Sparkline values={memoryHistory} color="var(--mon-violet)" />
          <div className={styles.bar}><i style={{ width: `${clampPercent(host.memory.percent)}%` }} /></div>
          <div className={styles.cardFoot}>Swap {host.swap.percent.toFixed(1)}%</div>
        </article>

        <article className={`${styles.card} ${temperatureWarn ? styles.cardWarn : ""}`}>
          <div className={styles.cardHead}><span><Thermometer size={15} />温度</span><span className={styles.cardTag}>{host.temperature.sensors.length} 个传感器</span></div>
          <div className={styles.cardValue}>{host.temperature.maxCelsius === null ? "不可用" : `${host.temperature.maxCelsius.toFixed(1)}`}{host.temperature.maxCelsius === null ? null : <small>°C</small>}</div>
          <div className={styles.meta}>最高温度 · {temperatureWarn ? "温度偏高" : "正常范围"}</div>
          <Sparkline values={temperatureHistory} color="var(--mon-yellow)" max={100} />
          <div className={styles.bar}><i style={{ width: `${clampPercent(host.temperature.maxCelsius ?? 0)}%` }} /></div>
          <div className={styles.cardFoot}>{host.temperature.sensors.slice(0, 3).map((sensor) => `${sensor.label} ${sensor.celsius.toFixed(0)}°`).join(" · ") || "未检测到传感器"}</div>
        </article>

        <article className={`${styles.card} ${diskWarn ? styles.cardWarn : ""}`}>
          <div className={styles.cardHead}><span><HardDrive size={15} />磁盘</span><span className={styles.cardTag}>{host.disk?.mount ?? "—"}</span></div>
          <div className={styles.cardValue}>{host.disk ? host.disk.percent.toFixed(1) : "—"}{host.disk ? <small>%</small> : null}</div>
          <div className={styles.meta}>{host.disk ? `${formatBytes(host.disk.usedBytes)} / ${formatBytes(host.disk.totalBytes)}` : "磁盘信息不可用"}</div>
          <div className={styles.bar}><i style={{ width: `${clampPercent(host.disk?.percent ?? 0)}%` }} /></div>
          <div className={styles.cardFoot}>{host.disk ? `可用 ${formatBytes(host.disk.freeBytes)}` : "检查宿主 / 挂载"}</div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}><span><Network size={15} />网络</span><span className={styles.cardTag}>实时速率</span></div>
          <div className={styles.networkRow}><span>↓ {formatRate(host.network.rxBytesPerSec)}</span><span>↑ {formatRate(host.network.txBytesPerSec)}</span></div>
          <div className={styles.meta}>累计 ↓ {formatBytes(host.network.rxTotalBytes)} · ↑ {formatBytes(host.network.txTotalBytes)}</div>
          <div className={styles.cardFoot}>宿主网络接口合计</div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHead}><span><Server size={15} />系统</span><span className={styles.cardTag}>J1900</span></div>
          <div className={styles.hostName}>{host.hostname}</div>
          <div className={styles.systemRows}>
            <span>运行时间</span><strong>{formatUptime(host.uptimeSec)}</strong>
            <span>内核</span><strong title={host.kernel}>{host.kernel.replace(/^Linux version\s*/, "").split(" ")[0]}</strong>
            <span>Docker</span><strong>{docker.available ? docker.version : "不可用"}</strong>
          </div>
        </article>
      </section>

      <section className={`${styles.docker} ${dockerWarn ? styles.dockerWarn : ""}`} aria-label="Docker 容器状态">
        <div className={styles.dockerHead}>
          <div>
            <span className={styles.kicker}><Container size={13} />DOCKER</span>
            <h2>后台服务</h2>
          </div>
          <div className={styles.dockerStats}>
            <span><i className={styles.okDot} />运行 {docker.counts.running}/{docker.counts.total}</span>
            <span><i className={styles.warnDot} />停止 {docker.counts.stopped}</span>
            <span><i className={styles.badDot} />异常 {docker.counts.unhealthy}</span>
          </div>
        </div>

        {!docker.available ? (
          <div className={styles.banner}><CircleAlert size={16} /><span>Docker 数据不可用：{docker.error || "无法连接 Docker socket"}</span></div>
        ) : (
          <>
            <div className={styles.tableHead}>
              <span>容器</span><span>状态</span><span>CPU</span><span>内存</span>
            </div>
            <div className={styles.table}>
              {displayedContainers.map((container) => (
                <div className={styles.containerRow} key={container.id}>
                  <div className={styles.containerName}>
                    <i className={`${styles.stateDot} ${containerStateClass(container)}`} />
                    <span><strong>{container.name}</strong>{CORE_CONTAINERS.includes(container.name) ? <em>核心</em> : null}<small>{container.image}</small></span>
                  </div>
                  <div className={styles.containerStatus}><span>{container.status}</span>{containerHealth(container)}</div>
                  <div className={styles.containerMetric}>{container.cpuPercent.toFixed(1)}%</div>
                  <div className={styles.containerMetric}>{formatBytes(container.memoryUsedBytes)}<small>{formatBytes(container.memoryLimitBytes)}</small></div>
                </div>
              ))}
              {displayedContainers.length === 0 ? <div className={styles.empty}>没有可显示的容器。</div> : null}
            </div>
            {containers.length > coreContainers.length ? (
              <button className={styles.toggle} type="button" onClick={() => setShowAll((value) => !value)}>
                {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAll ? "收起非核心容器" : `展开全部 ${containers.length} 个容器`}
                {!showAll && hiddenCount > 0 ? <small>还有 {hiddenCount} 个</small> : null}
              </button>
            ) : null}
          </>
        )}
      </section>

      <footer className={styles.footer}><Activity size={13} />每 3 秒自动刷新 · 只读监控</footer>
    </div>
  );
}
