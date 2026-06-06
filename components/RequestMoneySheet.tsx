"use client";
import { useEffect, useState, useRef } from "react";

interface RequestMoneySheetProps {
  open: boolean;
  partnerName: string;
  onSend: (amount: number, description: string) => void;
  onClose: () => void;
}

export default function RequestMoneySheet({
  open,
  partnerName,
  onSend,
  onClose,
}: RequestMoneySheetProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
      // Auto-focus amount input after animation settles
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSend = () => {
    if (!isValid) return;
    onSend(parsedAmount, description.trim());
    setAmount("");
    setDescription("");
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={handleBackdrop}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-10 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mb-4" />

        {/* Title */}
        <h2 className="text-lg font-black text-zinc-900 mb-6">
          Request from {partnerName}
        </h2>

        {/* Amount input */}
        <div className="mb-4">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black text-zinc-400 select-none">
              €
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                let val = e.target.value.replace(/[^0-9.,]/g, "");
                const match = val.match(/^[0-9]*[.,]?[0-9]*/);
                if (match) setAmount(match[0]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              className="w-full bg-zinc-100 rounded-2xl pl-12 pr-4 py-5 text-3xl font-black text-zinc-900 outline-none tabular-nums transition-all focus:ring-2 focus:ring-zinc-300"
            />
          </div>
        </div>

        {/* Description input */}
        <div className="mb-6">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">
            Description
          </label>
          <input
            type="text"
            placeholder="What's it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            className="w-full bg-zinc-100 rounded-xl px-4 py-3.5 text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-300 placeholder:text-zinc-400"
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!isValid}
          className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900 text-white font-black py-4 rounded-2xl text-sm transition-all active:scale-[0.98]"
        >
          Send Request →
        </button>
      </div>
    </div>
  );
}
