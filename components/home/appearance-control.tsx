"use client";

import { useState } from "react";
import { Moon, Palette, Sun } from "lucide-react";
import { APPEARANCE_CHANGE_EVENT, APPEARANCE_STORAGE_KEY, DEFAULT_ACCENT, defaultAppearance, parseAppearance, type AppearancePreferences } from "@/client/appearance";

const COLORS = ["#6de7ff", "#7c9dff", "#ff8fa3", "#ffd166"];

export function AppearanceControl() {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearancePreferences>(() => {
    if (typeof window === "undefined") return defaultAppearance;
    return parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY));
  });

  function update(next: AppearancePreferences) {
    setAppearance(next);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
    document.documentElement.dataset.colorMode = next.colorMode === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : next.colorMode;
    window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGE_EVENT, { detail: {
      accent: next.accent,
      bubbleColorRange: next.bubbleColorRange,
      bubbleActivity: next.bubbleActivity,
      colorMode: document.documentElement.dataset.colorMode,
    } }));
  }

  return <div className="appearance-control">
    <button className="appearance-trigger" type="button" onClick={() => setOpen(!open)} aria-label="外观设置" aria-expanded={open} title="外观设置"><Palette size={18} /></button>
    {open && <div className="appearance-panel">
      <div className="appearance-panel-heading"><strong>外观</strong><button type="button" aria-label="关闭设置" onClick={() => setOpen(false)}>×</button></div>
      <div className="appearance-mode">
        <button type="button" className={appearance.colorMode !== "dark" ? "is-active" : ""} onClick={() => update({ ...appearance, colorMode: "light" })}><Sun size={16} />浅色</button>
        <button type="button" className={appearance.colorMode === "dark" ? "is-active" : ""} onClick={() => update({ ...appearance, colorMode: "dark" })}><Moon size={16} />深色</button>
      </div>
      <span className="appearance-label">强调色</span>
      <div className="appearance-colors">{COLORS.map((color) => <button type="button" key={color} aria-label={`使用颜色 ${color}`} className={appearance.accent === color ? "is-active" : ""} style={{ backgroundColor: color }} onClick={() => update({ ...appearance, accent: color })} />)}</div>
      <label className="appearance-range"><span>气泡活跃度</span><input type="range" min="0" max="200" value={appearance.bubbleActivity} onChange={(event) => update({ ...appearance, bubbleActivity: Number(event.target.value) })} /></label>
      <label className="appearance-range"><span>气泡色彩范围</span><input type="range" min="0" max="100" value={appearance.bubbleColorRange} onChange={(event) => update({ ...appearance, bubbleColorRange: Number(event.target.value) })} /></label>
      <button className="appearance-reset" type="button" onClick={() => update({ ...defaultAppearance, accent: DEFAULT_ACCENT })}>恢复默认</button>
    </div>}
  </div>;
}
