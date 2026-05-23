"use client";
import { useState, useRef, useCallback } from "react";
import { type Transaction } from "@/hooks/useBudgetData";
import { categoryColor } from "@/lib/utils";

interface CategorySectionProps {
  category: string;
  categoryIndex: number;
  transactions: Transaction[];
  categoryTotal: number;
  variableTotal: number;
  budgetLimit?: number;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  onSetBudgetLimit: (limit: number) => void;
  onRemoveBudgetLimit: () => void;
}

const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD = 80;

// ── Budget bar colour based on usage ──────────────────────────────────────────
function barColor(pct: number, overBudget: boolean): string {
  if (overBudget || pct >= 1) return "#ef4444";
  if (pct >= 0.8) return "#f97316";
  if (pct >= 0.6) return "#f59e0b";
  return "";  // use category color (passed as style)
}

// ── Swipeable transaction row ─────────────────────────────────────────────────
function TransactionRow({
  tx,
  color,
  onDelete,
  onEdit,
}: {
  tx: Transaction;
  color: string;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(String(tx.amount));
  const [draftDesc, setDraftDesc] = useState(tx.desc || "");

  // Swipe state
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const isSwiping = useRef(false);

  // Long-press state
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
      cancelPress();           // cancel long-press if swiping
      isSwiping.current = true;
    }
    if (dx < 0) setSwipeX(Math.max(dx, -140));  // only allow left swipe, cap at -140
  };

  const onTouchEnd = () => {
    cancelPress();
    if (isSwiping.current && swipeX < -SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate(30);
      onDelete(tx.id);
    } else {
      setSwipeX(0);  // spring back
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
          <button onClick={confirmEdit} className="text-[10px] font-black text-white px-3 py-1.5 rounded-lg bg-blue-600">SAVE ✓</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete reveal zone */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-rose-500 rounded-xl"
        style={{ width: 64, opacity: Math.min(Math.abs(swipeX) / SWIPE_THRESHOLD, 1) }}
      >
        <span className="text-white text-xs font-black">DELETE</span>
      </div>

      {/* Row content */}
      <div
        className="relative flex justify-between items-center select-none bg-transparent"
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
            <p className="text-sm font-bold text-zinc-700">{tx.desc || "Expense"}</p>
            {tx.account && (
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${tx.account === "KBC" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}>
                {tx.account}
              </span>
            )}
            <span className="text-[8px] text-zinc-300 font-bold ml-auto">HOLD·SWIPE←</span>
          </div>
          <p className="text-[10px] font-medium italic" style={{ color }}>€{tx.amount.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main CategorySection ──────────────────────────────────────────────────────
export default function CategorySection({
  category,
  categoryIndex,
  transactions,
  categoryTotal,
  variableTotal,
  budgetLimit,
  expanded,
  onToggle,
  onDelete,
  onEdit,
  onSetBudgetLimit,
  onRemoveBudgetLimit,
}: CategorySectionProps) {
  const color = categoryColor(categoryIndex);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState(String(budgetLimit ?? ""));

  // Long-press on header to set budget limit
  const headerPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHeaderPress = () => {
    headerPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      setLimitDraft(String(budgetLimit ?? ""));
      setEditingLimit(true);
    }, LONG_PRESS_MS);
  };
  const cancelHeaderPress = () => {
    if (headerPressTimer.current) clearTimeout(headerPressTimer.current);
  };

  const confirmLimit = () => {
    const val = parseFloat(limitDraft.replace(",", "."));
    if (!isNaN(val) && val > 0) onSetBudgetLimit(val);
    else if (limitDraft === "") onRemoveBudgetLimit();
    setEditingLimit(false);
  };

  const pctOfVariable = variableTotal > 0 ? (categoryTotal / variableTotal) * 100 : 0;
  const pctOfBudget = budgetLimit ? categoryTotal / budgetLimit : null;
  const overBudget = pctOfBudget !== null && pctOfBudget >= 1;
  const budgetBarColor = pctOfBudget !== null ? barColor(pctOfBudget, overBudget) : color;
  const barWidth = pctOfBudget !== null
    ? `${Math.min(pctOfBudget * 100, 100)}%`
    : `${Math.min(pctOfVariable, 100)}%`;

  return (
    <div className="bg-white rounded-[2rem] border border-zinc-100 overflow-hidden shadow-sm mb-3">
      {/* Header */}
      <div
        className="w-full flex justify-between p-6 font-black text-zinc-800 items-center cursor-pointer select-none"
        onMouseDown={startHeaderPress}
        onMouseUp={cancelHeaderPress}
        onMouseLeave={cancelHeaderPress}
        onTouchStart={startHeaderPress}
        onTouchEnd={cancelHeaderPress}
        onClick={() => { if (!editingLimit) onToggle(); }}
      >
        <div className="text-left flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <p>{category}</p>
            {overBudget && (
              <span className="text-[8px] font-black text-rose-500 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full animate-pulse">
                OVER
              </span>
            )}
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${overBudget ? "text-rose-500" : "text-zinc-400"}`}>
            €{categoryTotal.toFixed(2)}{budgetLimit ? ` / €${budgetLimit}` : " total"}
          </p>
          {/* Progress bar */}
          {categoryTotal > 0 && (
            <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${overBudget ? "animate-pulse" : ""}`}
                style={{ width: barWidth, backgroundColor: budgetBarColor || color }}
              />
            </div>
          )}
          {!budgetLimit && (
            <p className="text-[8px] text-zinc-300 font-bold mt-1">HOLD HEADER TO SET BUDGET</p>
          )}
        </div>
        <span className="text-zinc-300 font-light text-2xl">{expanded ? "−" : "+"}</span>
      </div>

      {/* Inline budget limit editor */}
      {editingLimit && (
        <div className="px-6 pb-4 bg-zinc-50 border-t border-zinc-100">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2 pt-3">
            Monthly budget limit for {category}
          </p>
          <div className="flex gap-2">
            <input
              type="text" inputMode="decimal"
              value={limitDraft}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                  setLimitDraft(val);
                }
              }}
              autoFocus
              placeholder="e.g. 200"
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-base font-black text-zinc-800 outline-none"
            />
            <button onClick={confirmLimit} className="text-[10px] font-black text-white px-3 py-2 rounded-xl bg-blue-600">SET</button>
            {budgetLimit && (
              <button onClick={() => { onRemoveBudgetLimit(); setEditingLimit(false); }} className="text-[10px] font-black text-rose-400 px-3 py-2 rounded-xl bg-rose-50">REMOVE</button>
            )}
            <button onClick={() => setEditingLimit(false)} className="text-[10px] font-black text-zinc-400 px-3 py-2 rounded-xl bg-zinc-100">✕</button>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className={`grid transition-all duration-300 ease-in-out ${
        expanded ? "grid-rows-[1fr] opacity-100 border-t border-zinc-50" : "grid-rows-[0fr] opacity-0 pointer-events-none"
      }`}>
        <div className="overflow-hidden">
          <div className="px-6 pb-6 space-y-3 pt-4 bg-zinc-50/30">
            {transactions.length === 0 ? (
              <p className="text-xs text-zinc-300 font-bold text-center py-2">No entries yet</p>
            ) : (
              transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  color={color}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
