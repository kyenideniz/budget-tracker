"use client";
import { useEffect, useState } from "react";
import { type Transaction } from "@/hooks/useBudgetData";

interface UndoToastProps {
  deletedTx: Transaction | null;
  onUndo: (tx: Transaction) => void;
  onDismiss: () => void;
  timeoutMs?: number;
}

export default function UndoToast({
  deletedTx,
  onUndo,
  onDismiss,
  timeoutMs = 7000, // Increased default to 7 seconds!
}: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!deletedTx) return;
    setProgress(100);

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / timeoutMs) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);

    const timer = setTimeout(() => {
      onDismiss();
    }, timeoutMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [deletedTx, timeoutMs, onDismiss]);

  const visible = !!deletedTx;

  return (
    <div
      className={`fixed top-6 left-6 right-6 z-[100] transition-all duration-500 ease-out ${
        visible 
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" 
          : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
      }`}
    >
      <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 rounded-full shadow-2xl p-2 pl-5 flex items-center justify-between overflow-hidden">
        
        {/* Dynamic Island Style Message */}
        <div className="flex items-center gap-2.5">
          {/* Pulsating Rose Alert Indicator */}
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <p className="text-xs font-bold text-zinc-200 tracking-wide select-none">
            <span className="text-zinc-500 font-medium mr-1.5">Deleted</span>
            {deletedTx?.desc || deletedTx?.category || "transaction"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 pr-1.5">
          <button
            onClick={() => {
              if (deletedTx) onUndo(deletedTx);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] tracking-wider px-5 py-2.5 rounded-full shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all"
          >
            UNDO
          </button>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-black transition-all active:scale-95"
            title="Dismiss early"
          >
            ✕
          </button>
        </div>

        {/* Elegant Micro Progress Bar inset at the bottom */}
        <div
          className="absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-none opacity-80"
          style={{ width: `${progress * 0.88}%` }}
        />
      </div>
    </div>
  );
}
