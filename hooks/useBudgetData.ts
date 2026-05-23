"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getFixedDefinitions, newId, type Account, type QuickPreset, type FixedExpenses } from "@/lib/constants";

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  desc?: string;
  account?: Account;
}

export interface MonthData {
  incomeItems: Transaction[];
  variableExpenses: Transaction[];
  fixedPaid: string[];
  savings: number;
  rollover: number;
}

interface UseBudgetDataOptions {
  uid: string;
  /** Firestore path segment: data lives at users/{dataPath}/... */
  dataPath: string;
  /** Ordered list of account names this user has configured */
  accounts: string[];
  /** Per-user fixed expense definitions (housing + subscriptions). */
  fixedExpenses?: FixedExpenses;
}

function docRef(dataPath: string, path: string) {
  return doc(db, "users", dataPath, ...path.split("/"));
}

function offsetMonth(monthId: string, delta: number): string {
  const d = new Date(monthId + "-02");
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function useBudgetData({ uid, dataPath, accounts, fixedExpenses }: UseBudgetDataOptions) {
  // ── Month state ────────────────────────────────────────────────────────────
  const [activeMonth, setActiveMonth] = useState<string>("");
  const [viewingMonth, setViewingMonth] = useState<string>("");

  // ── Month data ─────────────────────────────────────────────────────────────
  const [incomeItems, setIncomeItems] = useState<Transaction[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<Transaction[]>([]);
  const [fixedPaid, setFixedPaid] = useState<string[]>([]);
  const [savings, setSavings] = useState<number>(0);
  const [rollover, setRollover] = useState<number>(0);

  // ── Settings ──────────────────────────────────────────────────────────────
  const [budgetLimits, setBudgetLimitsState] = useState<Record<string, number>>({});
  const [presets, setPresets] = useState<QuickPreset[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubSettings = useRef<(() => void) | null>(null);

  const isViewingHistory = activeMonth !== "" && viewingMonth !== "" && viewingMonth !== activeMonth;

  // ── Active month init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!dataPath) return;
    setLoading(true);

    const fetchActiveMonth = async () => {
      try {
        const ref = docRef(dataPath, "settings/activeMonth");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const m = snap.data().monthId;
          setActiveMonth(m);
          setViewingMonth(m);
        } else {
          const initialMonth = new Date().toISOString().slice(0, 7);
          setActiveMonth(initialMonth);
          setViewingMonth(initialMonth);
          await setDoc(ref, { monthId: initialMonth });
        }
      } catch (e) {
        setError("Failed to load active month.");
        console.error(e);
      }
    };
    fetchActiveMonth();
  }, [dataPath]);

  // ── Settings listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeMonth || !dataPath) return;

    const unsubLimits = onSnapshot(
      docRef(dataPath, "settings/budgetLimits"),
      (snap) => { if (snap.exists()) setBudgetLimitsState(snap.data() as Record<string, number>); },
      (e) => console.error("Budget limits sync error", e)
    );

    const unsubPresets = onSnapshot(
      docRef(dataPath, "settings/quickPresets"),
      (snap) => { if (snap.exists()) setPresets((snap.data().items as QuickPreset[]) || []); },
      (e) => console.error("Presets sync error", e)
    );

    unsubSettings.current = () => { unsubLimits(); unsubPresets(); };
    return () => { unsubLimits(); unsubPresets(); };
  }, [activeMonth, dataPath]);

  // ── Real-time month data sync ──────────────────────────────────────────────
  useEffect(() => {
    if (!viewingMonth || !dataPath) return;
    setLoading(true);
    const unsub = onSnapshot(
      docRef(dataPath, `months/${viewingMonth}`),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as MonthData;
          setIncomeItems(data.incomeItems || []);
          setVariableExpenses(data.variableExpenses || []);
          setFixedPaid(data.fixedPaid || []);
          setSavings(data.savings || 0);
          setRollover(data.rollover || 0);
        } else {
          setIncomeItems([]);
          setVariableExpenses([]);
          setFixedPaid([]);
          setSavings(0);
          setRollover(0);
        }
        setLoading(false);
      },
      (e) => {
        setError("Sync error. Check your connection.");
        setLoading(false);
        console.error(e);
      }
    );
    return () => unsub();
  }, [viewingMonth, dataPath]);

  // ── Sync helper ───────────────────────────────────────────────────────────
  const sync = useCallback(
    (updates: Partial<MonthData>) => {
      if (isViewingHistory || !dataPath) return Promise.resolve();
      return setDoc(docRef(dataPath, `months/${viewingMonth}`), updates, { merge: true }).catch(
        (e) => { setError("Save failed. Check your connection."); console.error(e); }
      );
    },
    [viewingMonth, isViewingHistory, dataPath]
  );

  // ── Derived calculations ───────────────────────────────────────────────────
  const fixedDefinitions = useMemo(
    () => getFixedDefinitions(viewingMonth, fixedExpenses),
    [viewingMonth, fixedExpenses]
  );

  const totals = useMemo(() => {
    const rolloverTotal =
      incomeItems
        .filter((i) => accounts.some(acc => i.desc === `${acc} Rollover`))
        .reduce((a, b) => a + b.amount, 0) + Number(rollover);

    const totalIncome = incomeItems.reduce((a, b) => a + b.amount, 0) + Number(rollover);

    const paidFixedTotal = Object.values(fixedDefinitions)
      .flat()
      .filter((item) => fixedPaid.includes(item.id))
      .reduce((a, b) => a + b.amt, 0);

    const variableTotal = variableExpenses.reduce((a, b) => a + b.amount, 0);
    const totalSpent = paidFixedTotal + variableTotal;
    const availableBalance = totalIncome - totalSpent - savings;

    // Dynamic per-account balances (variable expenses only first)
    const accountBalances: Record<string, number> = {};
    for (const acc of accounts) {
      const accIncome = incomeItems
        .filter((i) => i.account === acc || i.desc?.includes(acc))
        .reduce((a, b) => a + b.amount, 0);
      const accSpent = variableExpenses
        .filter((e) => e.account === acc || e.desc?.includes(acc))
        .reduce((a, b) => a + b.amount, 0);
      accountBalances[acc] = accIncome - accSpent;
    }

    // ── BUG FIX: Deduct paid fixed expenses from the primary account ──────
    // Fixed expenses (rent, bills, subscriptions) are not tagged to a specific
    // account, so we attribute them all to the first/primary account.
    // This makes sum(accountBalances) == availableBalance.
    if (accounts.length > 0) {
      accountBalances[accounts[0]] = (accountBalances[accounts[0]] ?? 0) - paidFixedTotal - savings;
    }

    // Legacy compat: expose kbcAvailable / tebAvailable for components that still use them
    const kbcAvailable = accountBalances[accounts[0]] ?? availableBalance;
    const tebAvailable = accounts.length > 1 ? (accountBalances[accounts[1]] ?? 0) : 0;

    return {
      rolloverTotal,
      totalIncome,
      paidFixedTotal,
      variableTotal,
      totalSpent,
      availableBalance,
      accountBalances,
      kbcAvailable,
      tebAvailable,
    };
  }, [incomeItems, variableExpenses, fixedPaid, fixedDefinitions, rollover, savings, accounts]);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const exp of variableExpenses) {
      map[exp.category] = (map[exp.category] || 0) + exp.amount;
    }
    return map;
  }, [variableExpenses]);

  // ── Month navigation ───────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setViewingMonth((m) => offsetMonth(m, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewingMonth((m) => {
      const next = offsetMonth(m, 1);
      return next <= activeMonth ? next : m;
    });
  }, [activeMonth]);

  const returnToLive = useCallback(() => {
    setViewingMonth(activeMonth);
  }, [activeMonth]);

  // ── Start next month ───────────────────────────────────────────────────────
  const startNextMonth = useCallback(async () => {
    const nextId = offsetMonth(activeMonth, 1);
    const { accountBalances } = totals;

    // Create rollover income items for each account
    const rolloverItems: Transaction[] = accounts.map((acc) => ({
      id: newId(),
      amount: (accountBalances[acc] ?? 0) > 0 ? (accountBalances[acc] ?? 0) : 0,
      category: "Other",
      desc: `${acc} Rollover`,
      account: acc,
    }));

    const nextMonthData: MonthData = {
      fixedPaid: ["amazon", "icloud"],
      incomeItems: rolloverItems,
      variableExpenses: [],
      savings: 0,
      rollover: 0,
    };
    await setDoc(docRef(dataPath, `months/${nextId}`), nextMonthData);
    await setDoc(docRef(dataPath, "settings/activeMonth"), { monthId: nextId });
    setActiveMonth(nextId);
    setViewingMonth(nextId);
  }, [activeMonth, totals, accounts, dataPath]);

  // ── CRUD actions ───────────────────────────────────────────────────────────
  const addIncome = useCallback(
    (item: Omit<Transaction, "id">) => {
      const generatedTx = { ...item, id: newId() };
      const updated = [...incomeItems, generatedTx];
      setIncomeItems(updated);
      sync({ incomeItems: updated });
      return generatedTx;
    },
    [incomeItems, sync]
  );

  const addExpense = useCallback(
    (item: Omit<Transaction, "id">) => {
      const generatedTx = { ...item, id: newId() };
      const updated = [...variableExpenses, generatedTx];
      setVariableExpenses(updated);
      sync({ variableExpenses: updated });
      return generatedTx;
    },
    [variableExpenses, sync]
  );

  const deleteIncome = useCallback(
    (id: string) => {
      const updated = incomeItems.filter((i) => i.id !== id);
      setIncomeItems(updated);
      return sync({ incomeItems: updated });
    },
    [incomeItems, sync]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      const updated = variableExpenses.filter((e) => e.id !== id);
      setVariableExpenses(updated);
      return sync({ variableExpenses: updated });
    },
    [variableExpenses, sync]
  );

  const undoDeleteIncome = useCallback(
    (tx: Transaction) => {
      const updated = [...incomeItems, tx];
      setIncomeItems(updated);
      return sync({ incomeItems: updated });
    },
    [incomeItems, sync]
  );

  const undoDeleteExpense = useCallback(
    (tx: Transaction) => {
      const updated = [...variableExpenses, tx];
      setVariableExpenses(updated);
      return sync({ variableExpenses: updated });
    },
    [variableExpenses, sync]
  );

  const editIncome = useCallback(
    (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      const updated = incomeItems.map((i) => (i.id === id ? { ...i, ...patch } : i));
      setIncomeItems(updated);
      return sync({ incomeItems: updated });
    },
    [incomeItems, sync]
  );

  const editExpense = useCallback(
    (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      const updated = variableExpenses.map((e) => (e.id === id ? { ...e, ...patch } : e));
      setVariableExpenses(updated);
      return sync({ variableExpenses: updated });
    },
    [variableExpenses, sync]
  );

  const toggleFixedPaid = useCallback(
    (itemId: string) => {
      const updated = fixedPaid.includes(itemId)
        ? fixedPaid.filter((x) => x !== itemId)
        : [...fixedPaid, itemId];
      setFixedPaid(updated);
      return sync({ fixedPaid: updated });
    },
    [fixedPaid, sync]
  );

  const updateSavings = useCallback(
    (val: number) => {
      const max = totals.availableBalance + savings;
      const clamped = Math.max(0, Math.min(val, max));
      setSavings(clamped);
      return sync({ savings: clamped });
    },
    [sync, totals.availableBalance, savings]
  );

  // ── Budget limits ──────────────────────────────────────────────────────────
  const setBudgetLimit = useCallback(
    (category: string, limit: number) => {
      const updated = { ...budgetLimits, [category]: limit };
      setBudgetLimitsState(updated);
      return setDoc(docRef(dataPath, "settings/budgetLimits"), updated, { merge: true }).catch(
        (e) => console.error("Failed to save budget limit", e)
      );
    },
    [budgetLimits, dataPath]
  );

  const removeBudgetLimit = useCallback(
    (category: string) => {
      const updated = { ...budgetLimits };
      delete updated[category];
      setBudgetLimitsState(updated);
      return setDoc(docRef(dataPath, "settings/budgetLimits"), updated).catch(
        (e) => console.error("Failed to remove budget limit", e)
      );
    },
    [budgetLimits, dataPath]
  );

  // ── Quick presets ──────────────────────────────────────────────────────────
  const addPreset = useCallback(
    (preset: Omit<QuickPreset, "id">) => {
      const updated = [...presets, { ...preset, id: newId() }];
      setPresets(updated);
      return setDoc(docRef(dataPath, "settings/quickPresets"), { items: updated }).catch(
        (e) => console.error("Failed to save preset", e)
      );
    },
    [presets, dataPath]
  );

  const deletePreset = useCallback(
    (id: string) => {
      const updated = presets.filter((p) => p.id !== id);
      setPresets(updated);
      return setDoc(docRef(dataPath, "settings/quickPresets"), { items: updated }).catch(
        (e) => console.error("Failed to delete preset", e)
      );
    },
    [presets, dataPath]
  );

  return {
    // State
    viewingMonth,
    activeMonth,
    isViewingHistory,
    incomeItems,
    variableExpenses,
    fixedPaid,
    savings,
    rollover,
    loading,
    error,
    // Settings
    budgetLimits,
    presets,
    // Derived
    fixedDefinitions,
    totals,
    categoryTotals,
    // Month nav
    goToPrevMonth,
    goToNextMonth,
    returnToLive,
    // Actions
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
  };
}
