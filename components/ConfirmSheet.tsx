"use client";
import { useEffect, useRef } from "react";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={handleBackdrop}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-[2.5rem] p-8 pb-12 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-8" />

        <h2 className="text-xl font-black text-white mb-2">{title}</h2>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">{description}</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-black py-4 rounded-2xl text-sm transition-all"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-400 font-black py-4 rounded-2xl text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
