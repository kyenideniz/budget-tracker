"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useBudgetData, type Transaction } from "@/hooks/useBudgetData";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { signOut } from "@/lib/auth";
import { VARIABLE_CATEGORIES, type QuickPreset, type FixedExpenses } from "@/lib/constants";
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
import LoginScreen from "@/components/LoginScreen";
import SetupWizard from "@/components/SetupWizard";

// ── Auth gate wrapper ──────────────────────────────────────────────────────
export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onSuccess={() => {}} />;
  }

  return <AuthenticatedApp uid={user.uid} />;
}

// ── Authenticated app (profile + data) ────────────────────────────────────
function AuthenticatedApp({ uid }: { uid: string }) {
  const { profile, profileLoading, isNewUser, saveProfile } = useUserProfile(uid);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (isNewUser || !profile) {
    return <SetupWizard uid={uid} onComplete={saveProfile} />;
  }

  const dataPath = profile.dataPath ?? uid;
  const accounts = profile.accounts ?? ["KBC", "TEB"];
  const fixedExpenses = profile.fixedExpenses;

  return <BudgetTracker uid={uid} dataPath={dataPath} accounts={accounts} displayName={profile.displayName} fixedExpenses={fixedExpenses} />;
}

// ── Main budget tracker ────────────────────────────────────────────────────
function BudgetTracker({
  uid,
  dataPath,
  accounts,
  displayName,
  fixedExpenses,
}: {
  uid: string;
  dataPath: string;
  accounts: string[];
  displayName: string;
  fixedExpenses?: FixedExpenses;
}) {
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
  } = useBudgetData({ uid, dataPath, accounts, fixedExpenses });

  // ── Accordion state ────────────────────────────────────────────────────────────
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

  // ── Added preset state & callbacks ─────────────────────────────────────────
  const [addedTx, setAddedTx] = useState<Transaction | null>(null);
  const [addedType, setAddedType] = useState<"income" | "expense">("expense");

  useEffect(() => {
    if (addedTx) {
      const timer = setTimeout(() => {
        setAddedTx(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [addedTx]);

  const handleInstantLogPreset = useCallback(
    (preset: QuickPreset) => {
      if (navigator.vibrate) navigator.vibrate(40);
      const newTx: Omit<Transaction, "id"> = {
        amount: preset.amount,
        category: preset.category,
        desc: preset.desc || preset.label,
        account: preset.account,
      };

      let loggedTx: Transaction;
      if (preset.type === "Income") {
        loggedTx = addIncome(newTx);
        setAddedType("income");
      } else {
        loggedTx = addExpense(newTx);
        setAddedType("expense");
      }
      setAddedTx(loggedTx);
    },
    [addIncome, addExpense]
  );

  // ── Hide Balance state ───────────────────────────────────────────────────
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

      {/* User header bar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          👤 {displayName}
        </span>
        <button
          onClick={() => signOut()}
          className="text-[10px] font-black text-zinc-400 hover:text-zinc-700 uppercase tracking-widest transition-colors"
        >
          Sign Out
        </button>
      </div>

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
        accountBalances={totals.accountBalances}
        accounts={accounts}
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

      {/* Added preset toast with undo */}
      {addedTx && (
        <div className="fixed top-6 left-6 right-6 z-[100] animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="relative bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 rounded-full shadow-2xl p-2 pl-5 flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <p className="text-xs font-bold text-zinc-200 tracking-wide select-none">
                <span className="text-zinc-500 font-medium mr-1.5">Added</span>
                {addedTx.desc || addedTx.category}
              </p>
            </div>
            <div className="flex items-center gap-1.5 pr-1.5">
              <button
                onClick={() => {
                  if (addedType === "income") {
                    deleteIncome(addedTx.id);
                  } else {
                    deleteExpense(addedTx.id);
                  }
                  setAddedTx(null);
                  if (navigator.vibrate) navigator.vibrate(30);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] tracking-wider px-5 py-2.5 rounded-full shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                UNDO
              </button>
              <button
                onClick={() => setAddedTx(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-400 hover:text-zinc-200 text-xs font-black transition-all active:scale-95 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

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
        accounts={accounts}
      />

      {/* New month confirmation bottom sheet */}
      <ConfirmSheet
        open={confirmOpen}
        title="Start New Month?"
        description={`Your account balances will carry forward automatically.`}
        confirmLabel="Start New Month →"
        onConfirm={async () => { setConfirmOpen(false); await startNextMonth(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
