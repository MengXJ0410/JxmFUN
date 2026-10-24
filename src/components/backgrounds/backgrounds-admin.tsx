"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Image as ImageIcon, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BackgroundMutationResult,
  BackgroundState,
  BackgroundStateEntry,
} from "@/lib/backgrounds/types";
import type { BackgroundPlatform, BackgroundTheme } from "@/lib/home/backgrounds";
import styles from "./backgrounds-admin.module.css";

type ViewEntry = BackgroundStateEntry & { unlisted?: boolean };
type Status = { text: string; kind: "" | "ok" | "error" };

function imageSrc(file: string) {
  return `/images/backgrounds/${encodeURIComponent(file)}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function BackgroundsAdmin() {
  const [state, setState] = useState<BackgroundState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [theme, setTheme] = useState<BackgroundTheme>("both");
  const [platform, setPlatform] = useState<BackgroundPlatform>("both");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ text: "", kind: "" });
  const uploadRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<ViewEntry[]>(() => {
    if (!state) return [];
    const configured = new Set(state.entries.map((entry) => entry.file));
    const unlisted = state.images
      .filter((image) => !configured.has(image.file))
      .map((image) => ({
        file: image.file,
        src: imageSrc(image.file),
        theme: "both" as const,
        platform: "both" as const,
        exists: true,
        unlisted: true,
      }));
    return [...state.entries, ...unlisted];
  }, [state]);

  const selectedEntry = entries.find((entry) => entry.file === selected) ?? null;
  const selectedImage = state?.images.find((image) => image.file === selected) ?? null;

  function applyState(next: BackgroundState) {
    setState(next);
    const keep = Boolean(
      selected &&
      (next.entries.some((entry) => entry.file === selected) || next.images.some((image) => image.file === selected)),
    );
    const file = keep ? selected : next.images[0]?.file ?? next.entries[0]?.file ?? null;
    const entry = next.entries.find((item) => item.file === file);
    setSelected(file);
    setTheme(entry?.theme ?? "both");
    setPlatform(entry?.platform ?? "both");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/backgrounds", { cache: "no-store" });
        const data = (await response.json()) as { state?: BackgroundState; error?: string };
        if (!response.ok) throw new Error(data.error || "读取配置失败");
        if (!cancelled && data.state) {
          const next = data.state;
          const first = next.images[0]?.file ?? next.entries[0]?.file ?? null;
          const entry = next.entries.find((item) => item.file === first);
          setState(next);
          setSelected(first);
          setTheme(entry?.theme ?? "both");
          setPlatform(entry?.platform ?? "both");
        }
      } catch (error) {
        if (!cancelled) setStatus({ text: error instanceof Error ? error.message : "读取配置失败", kind: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setStatus({ text: "", kind: "" });
    try {
      const response = await fetch("/api/backgrounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await response.json()) as BackgroundMutationResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "操作失败");
      applyState(data.state);
      setStatus({ text: success, kind: "ok" });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "操作失败", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const selectFile = (file: string) => {
    const entry = entries.find((item) => item.file === file);
    setSelected(file);
    setTheme(entry?.theme ?? "both");
    setPlatform(entry?.platform ?? "both");
    setStatus({ text: "", kind: "" });
  };

  const save = () => {
    if (!selected) return;
    void run({ action: "update", file: selected, theme, platform }, `已保存 ${selected}`);
  };

  const remove = () => {
    if (!selected || !selectedEntry || selectedEntry.unlisted) return;
    if (!window.confirm(`从配置中移除 ${selected}？图片文件不会被删除。`)) return;
    void run({ action: "remove", file: selected }, `已移除 ${selected}`);
  };

  const sync = (prune: boolean) => {
    if (prune && !window.confirm("移除配置中所有文件已不存在的条目？图片文件不会被删除。")) return;
    void run({ action: "sync", prune }, prune ? "已清理缺失条目" : "已同步背景目录");
  };

  const upload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".webp") && file.type !== "image/webp") {
      setStatus({ text: "只支持 WebP 图片", kind: "error" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus({ text: "文件不能超过 20MB", kind: "error" });
      return;
    }
    setBusy(true);
    setStatus({ text: "上传中...", kind: "" });
    try {
      const response = await fetch("/api/backgrounds/upload", {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: file,
        cache: "no-store",
      });
      const data = (await response.json()) as BackgroundMutationResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "上传失败");
      if (data.state) {
        setState(data.state);
        const target = data.file ?? data.state.images[0]?.file ?? null;
        setSelected(target);
        const entry = data.state.entries.find((item) => item.file === target);
        setTheme(entry?.theme ?? "both");
        setPlatform(entry?.platform ?? "both");
      }
      setStatus({ text: `已上传 ${data.file ?? ""}`, kind: "ok" });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "上传失败", kind: "error" });
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const reload = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/backgrounds", { cache: "no-store" });
      const data = (await response.json()) as { state?: BackgroundState; error?: string };
      if (!response.ok) throw new Error(data.error || "刷新失败");
      if (data.state) applyState(data.state);
      setStatus({ text: "已刷新", kind: "ok" });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "刷新失败", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const missingCount = state?.entries.filter((entry) => !entry.exists).length ?? 0;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <header className={styles.brand}>
            <Link className={styles.back} href="/">
              <ArrowLeft size={14} />返回首页
            </Link>
            <h1>背景图配置</h1>
            <p>保存后执行 <code>npm run docker:recreate</code> 生效</p>
          </header>
          <input
            ref={uploadRef}
            className={styles.fileInput}
            type="file"
            accept="image/webp,.webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className={styles.toolbar}>
            <button type="button" onClick={() => uploadRef.current?.click()} disabled={busy}>上传图片</button>
            <button type="button" onClick={() => sync(false)} disabled={busy}>同步目录</button>
            <button type="button" onClick={() => sync(true)} disabled={busy}>清理缺失</button>
            <button type="button" onClick={() => void reload()} disabled={busy}>刷新</button>
          </div>
          <div className={styles.list} role="listbox" aria-label="背景图列表">
            {entries.length === 0 ? (
              <p className={styles.emptyList}>目录中没有背景图。</p>
            ) : entries.map((entry) => (
              <button
                key={entry.file}
                type="button"
                role="option"
                aria-selected={entry.file === selected}
                className={`${styles.item} ${entry.file === selected ? styles.itemActive : ""} ${entry.exists ? "" : styles.itemWarn}`}
                onClick={() => selectFile(entry.file)}
              >
                <span
                  className={styles.thumb}
                  style={entry.exists ? { backgroundImage: `url("${imageSrc(entry.file)}")` } : undefined}
                />
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{entry.file}</span>
                  <span className={styles.itemMeta}>
                    {entry.exists ? `${entry.theme} / ${entry.platform}` : "文件缺失"}
                    {entry.unlisted ? " · 未写入配置" : ""}
                    {selectedImage?.file === entry.file ? ` · ${formatSize(selectedImage.size)}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <footer className={styles.sideFooter}>
            <span>{state?.images.length ?? 0} 张图片</span>
            <span>{missingCount > 0 ? `${missingCount} 个配置缺失` : "配置同步正常"}</span>
          </footer>
        </aside>

        <section className={styles.main}>
          <div className={`${styles.preview} ${selectedEntry ? "" : styles.previewEmpty}`}>
            {selectedEntry && selectedImage ? (
              <Image
                key={`${selectedEntry.file}-${selectedImage.modified}`}
                className={styles.previewImage}
                src={`${imageSrc(selectedEntry.file)}?v=${selectedImage.modified}`}
                alt={selectedEntry.file}
                fill
                unoptimized
                sizes="(max-width: 780px) 100vw, 70vw"
              />
            ) : (
              <span>{selectedEntry ? "图片文件不存在" : "选择一张背景图查看预览"}</span>
            )}
            {selectedEntry ? (
              <span className={styles.previewLabel}>{selectedEntry.theme} / {selectedEntry.platform}</span>
            ) : null}
          </div>

          <section className={styles.editor}>
            <div className={styles.fields}>
              <label className={styles.field}>
                <span>Theme</span>
                <select value={theme} onChange={(event) => setTheme(event.target.value as BackgroundTheme)} disabled={!selectedEntry || busy}>
                  <option value="both">both</option>
                  <option value="day">day</option>
                  <option value="night">night</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Platform</span>
                <select value={platform} onChange={(event) => setPlatform(event.target.value as BackgroundPlatform)} disabled={!selectedEntry || busy}>
                  <option value="both">both</option>
                  <option value="computer">computer</option>
                  <option value="phone">phone</option>
                </select>
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={save} disabled={!selected || busy}>
                <Save size={15} />保存属性
              </button>
              <button className={styles.danger} type="button" onClick={remove} disabled={!selectedEntry || selectedEntry.unlisted || busy}>
                <Trash2 size={15} />从配置移除
              </button>
            </div>
          </section>

          <div className={styles.hint}>
            <ImageIcon size={15} />
            <span>theme 跟随浅色/深色，platform 以 760px 为界；无匹配时使用 both/both 保底。上传仅支持 WebP，自动命名为 bg_XXX。</span>
          </div>

          <footer className={styles.footer}>
            <span>配置：<code>config/backgrounds.json</code></span>
            <span>图片：<code>public/images/backgrounds</code></span>
            <span className={`${styles.status} ${status.kind ? styles[status.kind] : ""}`} role="status" aria-live="polite">
              {status.text}
            </span>
            <button className={styles.refresh} type="button" onClick={() => void reload()} disabled={busy} aria-label="刷新">
              <RefreshCw size={14} />
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
