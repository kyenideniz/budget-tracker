"use client";
import { useRef, useState } from "react";
import { type QuickPreset } from "@/lib/constants";

const LONG_PRESS_MS = 500;

interface QuickPresetsProps {
  presets: QuickPreset[];
  onSelect: (preset: QuickPreset) => void;
  onDelete: (id: string) => void;
  onSaveCurrent: () => void;
  onInstantLog?: (preset: QuickPreset) => void;
  disabled?: boolean;
}

function PresetPill({
  preset,
  onSelect,
  onDelete,
  onInstantLog,
}: {
  preset: QuickPreset;
  onSelect: (p: QuickPreset) => void;
  onDelete: (id: string) => void;
  onInstantLog?: (p: QuickPreset) => void;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const startPress = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      if (onInstantLog) onInstantLog(preset);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    onSelect(preset);
  };

  return (
    <div className="relative flex-shrink-0 group select-none">
      <button
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchCancel={cancelPress}
        onClick={handleClick}
        style={{ WebkitTouchCallout: "none" }}
        className={`flex-shrink-0 px-4 py-2 pr-7 rounded-full text-[10px] font-black transition-all active:scale-95 border select-none ${
          preset.type === "Income"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : preset.account === "KBC"
            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        }`}
      >
        {preset.label} €{preset.amount}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(preset.id);
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[7px] bg-zinc-800/60 text-zinc-400 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer select-none"
        title="Delete Preset"
      >
        ✕
      </button>
    </div>
  );
}

export default function QuickPresets({
  presets,
  onSelect,
  onDelete,
  onSaveCurrent,
  onInstantLog,
  disabled,
  isCollapsed,
}: QuickPresetsProps & { isCollapsed?: boolean }) {
  if (presets.length === 0 && disabled) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 no-scrollbar ${isCollapsed ? "" : "mb-3"}`}>
      {presets.map((p) => (
        <PresetPill
          key={p.id}
          preset={p}
          onSelect={onSelect}
          onDelete={onDelete}
          onInstantLog={onInstantLog}
        />
      ))}
      {!disabled && !isCollapsed && (
        <button
          onClick={onSaveCurrent}
          className="flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black border border-dashed border-zinc-600 text-zinc-500 hover:border-zinc-400 hover:text-zinc-400 transition-colors select-none"
        >
          ＋ Save
        </button>
      )}
    </div>
  );
}

