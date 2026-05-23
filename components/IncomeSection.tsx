"use client";
import { useState, useRef, useCallback } from "react";
import { type Transaction } from "@/hooks/useBudgetData";

const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD = 80;

interface IncomeRowProps {
  tx: Transaction;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
}

function IncomeRow({ tx, onDelete, onEdit }: IncomeRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(String(tx.amount));
  const [draftDesc, setDraftDesc] = useState(tx.desc || "");

  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const isSwiping = useRef(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = useCallback(() => {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      setDraftAmount(String(tx.amount));
      setDraftDesc(tx.desc || "");
      setEditing(true);
    }, LONG_PRESS_MS);
  }, [tx]);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    isSwiping.current = false;
    startPress();
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 10) {
      cancelPress();
      isSwiping.current = true;
    }
    if (dx < 0) setSwipeX(Math.max(dx, -140));
  };

  const onTouchEnd = () => {
    cancelPress();
    if (isSwiping.current && swipeX < -SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate(30);
      onDelete(tx.id);
    } else {
      setSwipeX(0);
    }
    isSwiping.current = false;
  };

  const confirmEdit = () => {
    const amount = parseFloat(draftAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;
    onEdit(tx.id, { amount, desc: draftDesc });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl p-3 border border-zinc-200 space-y-2">
        <div className="flex gap-2">
          <input
            type="text" inputMode="decimal"
            value={draftAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                setDraftAmount(val);
              }
            }}
            autoFocus
            className="w-24 bg-zinc-100 rounded-xl px-3 py-2 text-base font-black text-zinc-800 outline-none"
          />
          <input
            type="text"
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            className="flex-1 bg-zinc-100 rounded-xl px-3 py-2 text-base text-zinc-600 outline-none"
            placeholder="Description"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-[10px] font-black text-zinc-400 px-3 py-1.5 rounded-lg bg-zinc-100">CANCEL</button>
          <button onClick={confirmEdit} className="text-[10px] font-black text-white px-3 py-1.5 rounded-lg bg-emerald-500">SAVE ✓</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete reveal */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-rose-500 rounded-xl"
        style={{ width: 64, opacity: Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1) }}
      >
        <span className="text-white text-xs font-black">DELETE</span>
      </div>

      <div
        className="relative flex justify-between items-center select-none"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 ? "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)" : "none",
        }}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex-1 py-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-zinc-700">{tx.desc || tx.category}</p>
            {tx.account && (
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${tx.account === "KBC" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}>
                {tx.account}
              </span>
            )}
            <span className="text-[8px] text-zinc-300 font-bold ml-auto">HOLD·SWIPE←</span>
          </div>
          <p className="text-[10px] text-emerald-500 font-bold">+€{tx.amount.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

interface IncomeSectionProps {
  incomeItems: Transaction[];
  totalIncome: number;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
}

export default function IncomeSection({
  incomeItems,
  totalIncome,
  expanded,
  onToggle,
  onDelete,
  onEdit,
}: IncomeSectionProps) {
  return (
    <div className="bg-emerald-50 rounded-[2rem] border border-emerald-100 overflow-hidden shadow-sm mb-3">
      <button
        onClick={onToggle}
        className="w-full flex justify-between p-6 font-black text-zinc-800 items-center"
      >
        <div className="text-left">
          <p>Income</p>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mt-0.5">
            €{totalIncome.toFixed(2)} total · {incomeItems.length} item{incomeItems.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="text-zinc-300 font-light text-2xl">{expanded ? "−" : "+"}</span>
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${
        expanded ? "grid-rows-[1fr] opacity-100 border-t border-emerald-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
      }`}>
        <div className="overflow-hidden">
          <div className="px-6 pb-6 space-y-3 pt-4 bg-emerald-50/50">
            {incomeItems.length === 0 ? (
              <p className="text-xs text-zinc-300 font-bold text-center py-2">No income recorded</p>
            ) : (
              incomeItems.map((tx) => (
                <IncomeRow key={tx.id} tx={tx} onDelete={onDelete} onEdit={onEdit} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
