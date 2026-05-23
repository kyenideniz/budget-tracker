"use client";
import { useState } from "react";

interface FundsRowProps {
  rolloverTotal: number;
  savings: number;
  availableBalance: number;
  onSavingsChange: (val: number) => void;
  hideBalance: boolean;
}

export default function FundsRow({
  rolloverTotal,
  savings,
  availableBalance,
  onSavingsChange,
  hideBalance,
}: FundsRowProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const displayValue = focused ? draft : savings === 0 ? "" : String(savings);
  const maxSavings = availableBalance + savings;
  const overBudget = Number(draft) > maxSavings && focused;

  return (
    <section className="bg-zinc-50 rounded-[2rem] p-6 mb-6 border border-zinc-100 grid grid-cols-2 gap-4 select-none">
      <div className="text-center">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
          Carried Forward
        </p>
        <p className="text-lg font-black text-zinc-800">
          {hideBalance ? "***,**" : `€${rolloverTotal.toFixed(2)}`}
        </p>
      </div>

      <div className="text-center border-l border-zinc-200">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
          Set to Savings
        </p>
        {hideBalance ? (
          <p className="text-lg font-black text-zinc-400 h-7 flex items-center justify-center">
            ***,**
          </p>
        ) : (
          <>
            <input
              type="number"
              inputMode="decimal"
              value={displayValue}
              placeholder="0"
              onFocus={() => {
                setDraft(savings === 0 ? "" : String(savings));
                setFocused(true);
              }}
              onBlur={() => {
                const val = parseFloat(draft);
                if (!isNaN(val)) onSavingsChange(val);
                setFocused(false);
                setDraft("");
              }}
              onChange={(e) => setDraft(e.target.value)}
              className={`w-24 bg-transparent text-center font-black text-lg outline-none transition-colors ${
                overBudget ? "text-rose-500" : "text-blue-600"
              }`}
            />
            {overBudget && (
              <p className="text-[9px] text-rose-400 font-bold mt-0.5 animate-pulse">
                Max €{maxSavings.toFixed(0)}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
