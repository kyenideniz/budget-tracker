"use client";
import { useState, useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import { type FixedItem } from "@/lib/constants";

const ACCOUNT_PILL_COLORS = [
  "bg-blue-500/10 border-blue-500/20 text-blue-400 bg-blue-500",
  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 bg-emerald-500",
  "bg-violet-500/10 border-violet-500/20 text-violet-400 bg-violet-500",
  "bg-orange-500/10 border-orange-500/20 text-orange-400 bg-orange-500",
];

interface BalanceCardProps {
  availableBalance: number;
  /** Per-account balances keyed by account name */
  accountBalances: Record<string, number>;
  /** Ordered list of the user's account names */
  accounts: string[];
  totalIncome: number;
  totalSpent: number;
  savings: number;
  loading: boolean;
  hideBalance: boolean;
  onToggleHide: () => void;
  fixedDefinitions: Record<string, FixedItem[]>;
  fixedPaid: string[];
  variableExpenses: { amount: number; date?: string | Date }[];
}

export default function BalanceCard({
  availableBalance,
  accountBalances,
  accounts,
  totalIncome,
  totalSpent,
  savings,
  loading,
  hideBalance,
  onToggleHide,
  fixedDefinitions,
  fixedPaid,
  variableExpenses,
}: BalanceCardProps) {
  const [activePage, setActivePage] = useState(0); // 0 = Balance details (default), 1 = Allowance & Streaks
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [streak, setStreak] = useState(0);

  const touchStartX = useRef<number | null>(null);

  const maskValue = (value: number, formatFn: (val: number) => string) => {
    if (loading) return "—";
    return hideBalance ? "***,**" : formatFn(value);
  };

  // Add this new function to force 2 decimals and European comma formatting
  const formatExactCurrency = (val: number) => {
    return new Intl.NumberFormat("nl-BE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Compute Safe-to-Spend and Saving Streaks
  useEffect(() => {
    if (!fixedDefinitions || !fixedPaid || !variableExpenses) return;

    // 1. Calculate unpaid fixed bills
    const unpaidBillsTotal = Object.values(fixedDefinitions)
      .flat()
      .filter((item) => !fixedPaid.includes(item.id))
      .reduce((sum, item) => sum + item.amt, 0);

    // 2. Days remaining in current month
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - today.getDate() + 1);

    // 3. Safe to spend allowance
    const pool = Math.max(0, availableBalance - unpaidBillsTotal);
    const dailyAllowance = pool / daysRemaining;
    setSafeToSpend(dailyAllowance);

    // 4. Calculate streak (days with spent < dailyAllowance in the last week)
    let activeStreak = 0;
    const dailyLimits = dailyAllowance > 0 ? dailyAllowance : 50; // fallback limit

    // Group expenses by day for the last 7 days
    const expensesByDay: Record<string, number> = {};
    variableExpenses.forEach((exp) => {
      const date = exp.date ? new Date(exp.date) : new Date();
      const dateKey = date.toDateString();
      expensesByDay[dateKey] = (expensesByDay[dateKey] || 0) + exp.amount;
    });

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date();
      checkDate.setDate(today.getDate() - i);
      const dateKey = checkDate.toDateString();
      const daySpent = expensesByDay[dateKey] || 0;

      if (daySpent <= dailyLimits) {
        activeStreak++;
      } else {
        break; // streak broken
      }
    }
    setStreak(activeStreak);
  }, [availableBalance, fixedDefinitions, fixedPaid, variableExpenses]);

  // Touch Swipe Handlers for Infinite 2-Page Carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX;

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        // Swiped left -> toggle page (0 -> 1, or 1 -> 0)
        setActivePage((prev) => (prev === 0 ? 1 : 0));
      } else {
        // Swiped right -> toggle page (1 -> 0, or 0 -> 1)
        setActivePage((prev) => (prev === 1 ? 0 : 1));
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }
    touchStartX.current = null;
  };

  const isBalanceActive = activePage === 0;
  const isAllowanceActive = activePage === 1;

  // Reusable sub-layouts to keep render code clean and perfectly organized
  const balanceContent = (
    <div className="w-1/2 flex flex-col justify-between h-full px-1 flex-shrink-0">
      {/* Header Label + Toggle Eye Button */}
      <div className="flex items-center justify-center gap-2 mb-2 select-none">
        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
          Available Balance
        </span>
        <button
          onClick={onToggleHide}
          disabled={loading}
          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-700/50 cursor-pointer"
          title={hideBalance ? "Show Balance" : "Hide Balance"}
        >
          {hideBalance ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {loading ? (
        <div className="h-16 flex items-center justify-center mt-2 mb-3">
          <div className="w-48 h-10 bg-zinc-800 rounded-2xl animate-pulse" />
        </div>
      ) : (
        <h1 className="text-6xl font-black mt-2 mb-3 tracking-tighter tabular-nums overflow-hidden text-ellipsis whitespace-nowrap px-2">
          {hideBalance ? "***,**" : formatCurrency(availableBalance)}
        </h1>
      )}

      {/* Account Split Bubbles — dynamic */}
      <div className="flex justify-center gap-2 mb-6 flex-wrap">
        {accounts.map((acc, i) => {
          const colors = ACCOUNT_PILL_COLORS[i % ACCOUNT_PILL_COLORS.length].split(" ");
          const [bgCls, borderCls, textCls, dotCls] = colors;
          return (
            <div key={acc} className={`${bgCls} border ${borderCls} px-3 py-1.5 rounded-full flex items-center gap-2`}>
              <div className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
              <span className={`text-[10px] font-black tracking-widest ${textCls} uppercase`}>
                {acc} {maskValue(accountBalances[acc] ?? 0, formatExactCurrency)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="flex justify-between text-[10px] font-bold text-zinc-400 border-t border-zinc-800 pt-6 select-none">
        <span className="text-emerald-400">
          IN {hideBalance ? "***" : loading ? "—" : `€${totalIncome.toFixed(0)}`}
        </span>
        <span className="text-rose-400">
          OUT {hideBalance ? "***" : loading ? "—" : `€${totalSpent.toFixed(0)}`}
        </span>
        <span className="text-blue-400">
          SAVED {hideBalance ? "***" : loading ? "—" : `€${savings.toFixed(0)}`}
        </span>
      </div>
    </div>
  );

  const allowanceContent = (
    <div className="w-1/2 flex flex-col justify-between h-full px-1 flex-shrink-0">
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
          Allowance & Streaks
        </span>
        <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px] shadow-sm select-none">
          👑
        </div>
      </div>

      {/* Two Bubbles Side by Side */}
      <div className="grid grid-cols-2 gap-4 my-auto py-2">
        {/* Safe to Spend Bubble */}
        <div className="bg-zinc-800/40 rounded-3xl p-4 border border-zinc-800/50 flex flex-col items-center text-center shadow-inner relative overflow-hidden">
          <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider mb-2">
            Safe Today
          </span>
          <div className="w-16 h-16 rounded-full border-4 border-blue-500/10 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin duration-3000 opacity-60" />
            <span className="text-sm font-black text-zinc-100">
              {hideBalance ? "***" : `€${safeToSpend.toFixed(0)}`}
            </span>
            <span className="text-[7px] font-bold text-zinc-500 uppercase">limit</span>
          </div>
        </div>

        {/* Saving Streak Bubble */}
        <div className="bg-zinc-800/40 rounded-3xl p-4 border border-zinc-800/50 flex flex-col items-center text-center shadow-inner relative overflow-hidden">
          <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider mb-2">
            Saving Streak
          </span>
          <div className="w-16 h-16 rounded-full border-4 border-orange-500/10 flex flex-col items-center justify-center">
            <span className="text-xl mb-0.5 animate-bounce">🔥</span>
            <span className="text-xs font-black text-zinc-100">
              {streak} {streak === 1 ? "Day" : "Days"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer info showing details */}
      <div className="flex justify-center text-[9px] font-bold text-zinc-500 border-t border-zinc-800 pt-5">
        <span>
          {hideBalance ? "€***,**" : `€${safeToSpend.toFixed(2)}`} / DAY SAFE ALLOWANCE
        </span>
      </div>
    </div>
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="bg-zinc-900 rounded-[3rem] pt-10 pb-6 px-10 shadow-2xl mb-8 text-white text-center relative overflow-hidden select-none border border-zinc-800/80"
    >
      <div className="overflow-hidden relative w-full min-h-[190px]">
        <div
          className="flex transition-transform duration-500 ease-out h-full"
          style={{ transform: `translateX(-${activePage * 50}%)`, width: "200%" }}
        >
          {/* PAGE 0: Available Balance */}
          {balanceContent}

          {/* PAGE 1: Allowance & Streaks */}
          {allowanceContent}
        </div>
      </div>

      {/* Swipe Indicator Dots */}
      <div className="flex justify-center gap-2 mt-4 select-none">
        <button
          onClick={() => setActivePage(0)}
          className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${isBalanceActive ? "bg-white/80 scale-110" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          title="Balance view"
        />
        <button
          onClick={() => setActivePage(1)}
          className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${isAllowanceActive ? "bg-white/80 scale-110" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          title="Streaks & Allowance"
        />
      </div>
    </div>
  );
}
