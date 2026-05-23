"use client";
import { useState, useEffect } from "react";
import { type FixedItem } from "@/lib/constants";

interface SpendingDashboardProps {
  availableBalance: number;
  fixedDefinitions: Record<string, FixedItem[]>;
  fixedPaid: string[];
  variableExpenses: { amount: number; date?: string | Date }[];
  hideBalance: boolean;
  loading: boolean;
}

export default function SpendingDashboard({
  availableBalance,
  fixedDefinitions,
  fixedPaid,
  variableExpenses,
  hideBalance,
  loading,
}: SpendingDashboardProps) {
  const [expanded, setExpanded] = useState(false);
  const [safeToSpend, setSafeToSpend] = useState(0);
  const [streak, setStreak] = useState(0);

  // Compute Safe-to-Spend and Saving Streaks
  useEffect(() => {
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
    // For a fully gamified feel, we look at the last 7 days of variable expenses.
    // If a day's total expense is under the daily allowance, it keeps the streak alive!
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

  if (loading) return null;

  return (
    <div className="mb-6 select-none">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full bg-zinc-50 rounded-[2rem] border border-zinc-100 overflow-hidden shadow-sm outline-none"
      >
        <div className="flex justify-between items-center p-6 font-black text-zinc-800">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm">
              👑
            </div>
            <div>
              <span>Allowance & Streaks</span>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                {hideBalance ? "€***,**" : `€${safeToSpend.toFixed(2)}`} / day safe
              </p>
            </div>
          </div>
          <span className="text-zinc-300 font-light text-2xl">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {/* Smooth CSS Grid rows height transition */}
      <div className={`grid transition-all duration-300 ease-in-out ${
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
      }`}>
        <div className="overflow-hidden">
          <div className="bg-zinc-50 border border-zinc-100 border-t-0 rounded-b-[2rem] px-6 pb-6 -mt-6 pt-8 grid grid-cols-2 gap-4">
            
            {/* Safe to spend bubble */}
            <div className="bg-white rounded-3xl p-5 border border-zinc-100 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
              <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                Safe to Spend Today
              </span>
              <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 flex flex-col items-center justify-center relative">
                {/* Active progress ring accent */}
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin duration-3000 opacity-60" />
                <span className="text-sm font-black text-zinc-800">
                  {hideBalance ? "***" : `€${safeToSpend.toFixed(0)}`}
                </span>
                <span className="text-[8px] font-bold text-zinc-400 uppercase">today</span>
              </div>
            </div>

            {/* Saving streak bubble */}
            <div className="bg-white rounded-3xl p-5 border border-zinc-100 flex flex-col items-center text-center shadow-sm relative">
              <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                Saving Streak
              </span>
              <div className="w-20 h-20 rounded-full border-4 border-orange-500/20 flex flex-col items-center justify-center">
                <span className="text-2xl mb-0.5 animate-bounce">🔥</span>
                <span className="text-sm font-black text-zinc-800">
                  {streak} {streak === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
