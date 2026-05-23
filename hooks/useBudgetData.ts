"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { getFixedDefinitions, newId, type Account, type QuickPreset } from "@/lib/constants";

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

const USER_ID = "kerem-efe";

function docRef(path: string) {
  return doc(db, "users", USER_ID, ...path.split("/"));
}

function offsetMonth(monthId: string, delta: number): string {
  const d = new Date(monthId + "-02");
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function useBudgetData() {
  // ── Month state ────────────────────────────────────────────────────────────
  const [activeMonth, setActiveMonth] = useState<string>("");   // Firestore setting
  const [viewingMonth, setViewingMonth] = useState<string>(""); // what we're showing

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

  // Track unsubscribes for cleanup
  const unsubSettings = useRef<(() => void) | null>(null);

  const isViewingHistory = activeMonth !== "" && viewingMonth !== "" && viewingMonth !== activeMonth;

  // ── Active month init ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchActiveMonth = async () => {
      try {
        const ref = docRef("settings/activeMonth");
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
  }, []);

  // ── Settings listeners (budget limits + presets) ───────────────────────────
  useEffect(() => {
    if (!activeMonth) return;

    // Listen to budgetLimits
    const unsubLimits = onSnapshot(
      docRef("settings/budgetLimits"),
      (snap) => { if (snap.exists()) setBudgetLimitsState(snap.data() as Record<string, number>); },
      (e) => console.error("Budget limits sync error", e)
    );

    // Listen to quickPresets
    const unsubPresets = onSnapshot(
      docRef("settings/quickPresets"),
      (snap) => { if (snap.exists()) setPresets((snap.data().items as QuickPreset[]) || []); },
      (e) => console.error("Presets sync error", e)
    );

    unsubSettings.current = () => { unsubLimits(); unsubPresets(); };
    return () => { unsubLimits(); unsubPresets(); };
  }, [activeMonth]);

  // ── Real-time month data sync ──────────────────────────────────────────────
  useEffect(() => {
    if (!viewingMonth) return;
    setLoading(true);
    const unsub = onSnapshot(
      docRef(`months/${viewingMonth}`),
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
  }, [viewingMonth]);

  // ── Sync helper (blocked in history mode) ─────────────────────────────────
  const sync = useCallback(
    (updates: Partial<MonthData>) => {
      if (isViewingHistory) return Promise.resolve();
      return setDoc(docRef(`months/${viewingMonth}`), updates, { merge: true }).catch(
        (e) => { setError("Save failed. Check your connection."); console.error(e); }
      );
    },
    [viewingMonth, isViewingHistory]
  );

  // ── Derived calculations ───────────────────────────────────────────────────
  const fixedDefinitions = useMemo(
    () => getFixedDefinitions(viewingMonth),
    [viewingMonth]
  );

  const totals = useMemo(() => {
    const rolloverTotal =
      incomeItems
        .filter((i) => i.desc === "KBC Rollover" || i.desc === "TEB Rollover")
        .reduce((a, b) => a + b.amount, 0) + Number(rollover);

    const totalIncome = incomeItems.reduce((a, b) => a + b.amount, 0) + Number(rollover);

    const paidFixedTotal = Object.values(fixedDefinitions)
      .flat()
      .filter((item) => fixedPaid.includes(item.id))
      .reduce((a, b) => a + b.amt, 0);

    const variableTotal = variableExpenses.reduce((a, b) => a + b.amount, 0);
    const totalSpent = paidFixedTotal + variableTotal;
    const availableBalance = totalIncome - totalSpent - savings;

    const tebIncome = incomeItems
      .filter((i) => i.account === "TEB" || i.desc?.includes("TEB"))
      .reduce((a, b) => a + b.amount, 0);
    const tebSpent = variableExpenses
      .filter((e) => e.account === "TEB" || e.desc?.includes("TEB"))
      .reduce((a, b) => a + b.amount, 0);
    const tebAvailable = tebIncome - tebSpent;
    const kbcAvailable = availableBalance - tebAvailable;

    return { rolloverTotal, totalIncome, paidFixedTotal, variableTotal, totalSpent, availableBalance, tebAvailable, kbcAvailable };
  }, [incomeItems, variableExpenses, fixedPaid, fixedDefinitions, rollover, savings]);

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
    // Don't allow navigating past the active month
    setViewingMonth((m) => {
      const next = offsetMonth(m, 1);
      return next <= activeMonth ? next : m;
    });
  }, [activeMonth]);

  const returnToLive = useCallback(() => {
    setViewingMonth(activeMonth);
  }, [activeMonth]);

  // ── Start next month (no confirm — handled by ConfirmSheet) ───────────────
  const startNextMonth = useCallback(async () => {
    const nextId = offsetMonth(activeMonth, 1);
    const { kbcAvailable, tebAvailable } = totals;
    const nextMonthData: MonthData = {
      fixedPaid: ["amazon", "icloud"],
      incomeItems: [
        { id: newId(), amount: kbcAvailable > 0 ? kbcAvailable : 0, category: "Other", desc: "KBC Rollover", account: "KBC" },
        { id: newId(), amount: tebAvailable > 0 ? tebAvailable : 0, category: "Other", desc: "TEB Rollover", account: "TEB" },
      ],
      variableExpenses: [],
      savings: 0,
      rollover: 0,
    };
    await setDoc(docRef(`months/${nextId}`), nextMonthData);
    await setDoc(docRef("settings/activeMonth"), { monthId: nextId });
    setActiveMonth(nextId);
    setViewingMonth(nextId);
  }, [activeMonth, totals]);

  // ── CRUD actions ───────────────────────────────────────────────────────────
  const addIncome = useCallback(
    (item: Omit<Transaction, "id">) => {
      const updated = [...incomeItems, { ...item, id: newId() }];
      setIncomeItems(updated);
      return sync({ incomeItems: updated });
    },
    [incomeItems, sync]
  );

  const addExpense = useCallback(
    (item: Omit<Transaction, "id">) => {
      const updated = [...variableExpenses, { ...item, id: newId() }];
      setVariableExpenses(updated);
      return sync({ variableExpenses: updated });
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
      return setDoc(docRef("settings/budgetLimits"), updated, { merge: true }).catch(
        (e) => console.error("Failed to save budget limit", e)
      );
    },
    [budgetLimits]
  );

  const removeBudgetLimit = useCallback(
    (category: string) => {
      const updated = { ...budgetLimits };
      delete updated[category];
      setBudgetLimitsState(updated);
      return setDoc(docRef("settings/budgetLimits"), updated).catch(
        (e) => console.error("Failed to remove budget limit", e)
      );
    },
    [budgetLimits]
  );

  // ── Quick presets ──────────────────────────────────────────────────────────
  const addPreset = useCallback(
    (preset: Omit<QuickPreset, "id">) => {
      const updated = [...presets, { ...preset, id: newId() }];
      setPresets(updated);
      return setDoc(docRef("settings/quickPresets"), { items: updated }).catch(
        (e) => console.error("Failed to save preset", e)
      );
    },
    [presets]
  );

  const deletePreset = useCallback(
    (id: string) => {
      const updated = presets.filter((p) => p.id !== id);
      setPresets(updated);
      return setDoc(docRef("settings/quickPresets"), { items: updated }).catch(
        (e) => console.error("Failed to delete preset", e)
      );
    },
    [presets]
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
