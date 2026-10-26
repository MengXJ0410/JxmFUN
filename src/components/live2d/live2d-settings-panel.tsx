"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { LIVE2D_SIZE_MAX, LIVE2D_SIZE_MIN } from "@/content/live2d";

type Live2DSettingsPanelProps = {
  anchor: { x: number; y: number };
  viewport: { width: number; height: number };
  visible: boolean;
  passthrough: boolean;
  scale: number;
  ignoreRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onToggleVisible: () => void;
  onTogglePassthrough: () => void;
  onScaleChange: (value: number) => void;
};

export function Live2DSettingsPanel({
  anchor,
  viewport,
  visible,
  passthrough,
  scale,
  ignoreRef,
  onClose,
  onToggleVisible,
  onTogglePassthrough,
  onScaleChange,
}: Live2DSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (ignoreRef?.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ignoreRef, onClose]);

  const panelWidth = Math.min(304, Math.max(0, viewport.width - 32));
  const panelHeight = 258;
  const left = Math.min(
    Math.max(anchor.x, 12),
    Math.max(12, viewport.width - panelWidth - 12),
  );
  const top = Math.min(
    Math.max(anchor.y, 12),
    Math.max(12, viewport.height - panelHeight - 12),
  );
  const progress =
    ((scale - LIVE2D_SIZE_MIN) / (LIVE2D_SIZE_MAX - LIVE2D_SIZE_MIN)) * 100;

  const style = {
    "--panel-x": `${left}px`,
    "--panel-y": `${top}px`,
  } as CSSProperties;

  return (
    <div
      ref={panelRef}
      className="appearance-panel live2d-settings-panel"
      style={style}
      role="dialog"
      aria-label="希罗设置"
    >
      <div className="appearance-panel-heading">
        <strong>希罗设置</strong>
        <button type="button" aria-label="关闭希罗设置" onClick={onClose}>
          ×
        </button>
      </div>
      <button
        type="button"
        className={`appearance-choice appearance-system${visible ? " is-on" : ""}`}
        aria-pressed={visible}
        onClick={onToggleVisible}
      >
        {visible ? "隐藏人物" : "显示人物"}
      </button>
      <button
        type="button"
        className={`appearance-choice appearance-system${passthrough ? " is-on" : ""}`}
        aria-pressed={passthrough}
        onClick={onTogglePassthrough}
      >
        {passthrough ? "关闭鼠标穿透" : "开启鼠标穿透"}
      </button>
      <label className="appearance-range">
        <span>人物大小</span>
        <input
          type="range"
          min={LIVE2D_SIZE_MIN}
          max={LIVE2D_SIZE_MAX}
          step={1}
          value={scale}
          style={{ "--range-progress": `${progress}%` } as CSSProperties}
          onChange={(event) => onScaleChange(Number(event.target.value))}
        />
      </label>
      <span className="appearance-label" style={{ justifySelf: "end" }}>
        {scale}%
      </span>
    </div>
  );
}
