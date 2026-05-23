"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useBudgetData, type Transaction } from "@/hooks/useBudgetData";
import { VARIABLE_CATEGORIES, type QuickPreset } from "@/lib/constants";
import MonthHeader from "@/components/MonthHeader";
import BalanceCard from "@/components/BalanceCard";
import FundsRow from "@/components/FundsRow";
import SpendingChart from "@/components/SpendingChart";
import FixedSection from "@/components/FixedSection";
import CategorySection from "@/components/CategorySection";
import IncomeSection from "@/components/IncomeSection";
import AddDock from "@/components/AddDock";
import ConfirmSheet from "@/components/ConfirmSheet";
import UndoToast from "@/components/UndoToast";

export default function BudgetTracker() {
  const {
    viewingMonth,
    activeMonth,
    isViewingHistory,
    incomeItems,
    variableExpenses,
    fixedPaid,
    savings,
    loading,
    error,
    budgetLimits,
    presets,
    fixedDefinitions,
    totals,
    categoryTotals,
    goToPrevMonth,
    goToNextMonth,
    returnToLive,
    startNextMonth,
    addIncome,
    addExpense,
    deleteIncome,
    deleteExpense,
    undoDeleteIncome,
    undoDeleteExpense,
    editIncome,
    editExpense,
    toggleFixedPaid,
    updateSavings,
    setBudgetLimit,
    removeBudgetLimit,
    addPreset,
    deletePreset,
  } = useBudgetData();

  // ── Accordion state ────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => (prev === key ? null : key));

  // ── New month confirm sheet ────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Undo toast state ──────────────────────────────────────────────────────
  const [deletedTx, setDeletedTx] = useState<Transaction | null>(null);
  const [deletedType, setDeletedType] = useState<"income" | "expense">("expense");

  const handleDeleteExpense = useCallback((id: string) => {
    const tx = variableExpenses.find((e) => e.id === id);
    if (tx) { setDeletedTx(tx); setDeletedType("expense"); }
    deleteExpense(id);
  }, [variableExpenses, deleteExpense]);

  const handleDeleteIncome = useCallback((id: string) => {
    const tx = incomeItems.find((i) => i.id === id);
    if (tx) { setDeletedTx(tx); setDeletedType("income"); }
    deleteIncome(id);
  }, [incomeItems, deleteIncome]);

  const handleUndo = useCallback((tx: Transaction) => {
    if (deletedType === "expense") undoDeleteExpense(tx);
    else undoDeleteIncome(tx);
    setDeletedTx(null);
  }, [deletedType, undoDeleteExpense, undoDeleteIncome]);

  // ── Add handler ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(
    (item: Omit<Transaction, "id">, type: "Income" | "Expense") => {
      if (type === "Income") addIncome(item);
      else addExpense(item);
    },
    [addIncome, addExpense]
  );

  // ── Preset save handler ────────────────────────────────────────────────────
  const handleSavePreset = useCallback(
    (preset: Omit<QuickPreset, "id">) => addPreset(preset),
    [addPreset]
  );

  // ── Preset undo state & callbacks ──────────────────────────────────────────
  const [deletedPreset, setDeletedPreset] = useState<QuickPreset | null>(null);

  const handleDeletePreset = useCallback((id: string) => {
    const p = presets.find((x) => x.id === id);
    if (p) {
      setDeletedPreset(p);
      setTimeout(() => {
        setDeletedPreset(curr => curr?.id === id ? null : curr);
      }, 7000);
    }
    deletePreset(id);
  }, [presets, deletePreset]);

  const handleUndoPreset = useCallback(() => {
    if (deletedPreset) {
      const { id, ...rest } = deletedPreset;
      addPreset(rest);
      setDeletedPreset(null);
    }
  }, [deletedPreset, addPreset]);

  const handleInstantLogPreset = useCallback(
    (preset: QuickPreset) => {
      if (navigator.vibrate) navigator.vibrate(40);
      const newTx: Omit<Transaction, "id"> = {
        amount: preset.amount,
        category: preset.category,
        desc: preset.desc || preset.label,
        account: preset.account,
      };
      if (preset.type === "Income") {
        addIncome(newTx);
      } else {
        addExpense(newTx);
      }
    },
    [addIncome, addExpense]
  );

  // ── Hide Balance state (syncs BalanceCard, FundsRow & SpendingChart) ───────
  const [hideBalance, setHideBalance] = useState(false);

  useEffect(() => {
    setHideBalance(localStorage.getItem("hideBalance") === "true");
  }, []);

  const toggleHideBalance = useCallback(() => {
    setHideBalance((prev) => {
      const newVal = !prev;
      localStorage.setItem("hideBalance", String(newVal));
      return newVal;
    });
  }, []);

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white p-6 pb-72 font-sans">
      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold p-3 rounded-2xl text-center">
          {error}
        </div>
      )}

      <MonthHeader
        viewingMonth={viewingMonth}
        activeMonth={activeMonth}
        isViewingHistory={isViewingHistory}
        loading={loading}
        onNewMonth={() => setConfirmOpen(true)}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onReturnToLive={returnToLive}
      />

      <BalanceCard
        availableBalance={totals.availableBalance}
        kbcAvailable={totals.kbcAvailable}
        tebAvailable={totals.tebAvailable}
        totalIncome={totals.totalIncome}
        totalSpent={totals.totalSpent}
        savings={savings}
        loading={loading}
        hideBalance={hideBalance}
        onToggleHide={toggleHideBalance}
        fixedDefinitions={fixedDefinitions}
        fixedPaid={fixedPaid}
        variableExpenses={variableExpenses}
      />

      <FundsRow
        rolloverTotal={totals.rolloverTotal}
        savings={savings}
        availableBalance={totals.availableBalance}
        onSavingsChange={updateSavings}
        hideBalance={hideBalance}
      />

      <SpendingChart
        categoryTotals={categoryTotals}
        variableTotal={totals.variableTotal}
        hideBalance={hideBalance}
      />

      <div className="space-y-0">
        <FixedSection
          fixedDefinitions={fixedDefinitions}
          fixedPaid={fixedPaid}
          expanded={expanded}
          onToggle={toggleExpanded}
          onTogglePaid={toggleFixedPaid}
        />

        {VARIABLE_CATEGORIES.map((cat, i) => (
          <CategorySection
            key={cat}
            category={cat}
            categoryIndex={i}
            transactions={variableExpenses.filter((e) => e.category === cat)}
            categoryTotal={categoryTotals[cat] || 0}
            variableTotal={totals.variableTotal}
            budgetLimit={budgetLimits[cat]}
            expanded={expanded === cat}
            onToggle={() => toggleExpanded(cat)}
            onDelete={handleDeleteExpense}
            onEdit={editExpense}
            onSetBudgetLimit={(limit) => setBudgetLimit(cat, limit)}
            onRemoveBudgetLimit={() => removeBudgetLimit(cat)}
          />
        ))}

        <IncomeSection
          incomeItems={incomeItems}
          totalIncome={totals.totalIncome}
          expanded={expanded === "__income__"}
          onToggle={() => toggleExpanded("__income__")}
          onDelete={handleDeleteIncome}
          onEdit={editIncome}
        />
      </div>

      {/* Undo toast */}
      <UndoToast
        deletedTx={deletedTx}
        onUndo={handleUndo}
        onDismiss={() => setDeletedTx(null)}
      />

      {/* Undo Preset Toast */}
      {deletedPreset && (
        <div className="fixed top-6 left-6 right-6 z-[100] animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 rounded-full shadow-2xl p-2 pl-5 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <p className="text-xs font-bold text-zinc-200 tracking-wide select-none">
                <span className="text-zinc-500 font-medium mr-1.5">Deleted Preset</span>
                {deletedPreset.label}
              </p>
            </div>
            <div className="flex items-center gap-1.5 pr-1.5">
              <button
                onClick={handleUndoPreset}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] tracking-wider px-5 py-2.5 rounded-full shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                UNDO
              </button>
              <button
                onClick={() => setDeletedPreset(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-black transition-all active:scale-95 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <AddDock
        onAdd={handleAdd}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        presets={presets}
        availableBalance={totals.availableBalance}
        loading={loading}
        disabled={isViewingHistory}
        pastTransactions={variableExpenses.concat(incomeItems)}
        categoryTotals={categoryTotals}
        budgetLimits={budgetLimits}
        onInstantLogPreset={handleInstantLogPreset}
      />

      {/* New month confirmation bottom sheet */}
      <ConfirmSheet
        open={confirmOpen}
        title="Start New Month?"
        description={`KBC (€${totals.kbcAvailable.toFixed(2)}) and TEB (€${totals.tebAvailable.toFixed(2)}) balances will carry forward automatically.`}
        confirmLabel="Start New Month →"
        onConfirm={async () => { setConfirmOpen(false); await startNextMonth(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
