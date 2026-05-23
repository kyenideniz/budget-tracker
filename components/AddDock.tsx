"use client";
import { useState, useImperativeHandle, forwardRef, useRef, useEffect } from "react";
import { VARIABLE_CATEGORIES, INCOME_CATEGORIES, type Account, type QuickPreset } from "@/lib/constants";
import { type Transaction } from "@/hooks/useBudgetData";
import QuickPresets from "@/components/QuickPresets";

export interface AddDockHandle {
  fillFrom: (preset: QuickPreset) => void;
}

interface AddDockProps {
  onAdd: (item: Omit<Transaction, "id">, type: "Income" | "Expense") => void;
  onSavePreset: (preset: Omit<QuickPreset, "id">) => void;
  onDeletePreset: (id: string) => void;
  presets: QuickPreset[];
  availableBalance: number;
  loading?: boolean;
  disabled?: boolean;
  pastTransactions?: Transaction[];
  categoryTotals?: Record<string, number>;
  budgetLimits?: Record<string, number>;
  onInstantLogPreset?: (preset: QuickPreset) => void;
  /** User's configured bank account names */
  accounts?: string[];
}

const AddDock = forwardRef<AddDockHandle, AddDockProps>(function AddDock(
  {
    onAdd,
    onSavePreset,
    onDeletePreset,
    presets,
    availableBalance,
    loading,
    disabled,
    pastTransactions = [],
    categoryTotals = {},
    budgetLimits = {},
    onInstantLogPreset,
    accounts = ["KBC", "TEB"],
  },
  ref
) {
  const [inputType, setInputType] = useState<"Expense" | "Income">("Expense");
  const [account, setAccount] = useState<string>(accounts[0] ?? "KBC");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [desc, setDesc] = useState("");

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const categoryPickerRef = useRef<HTMLDivElement | null>(null);

  const categories: readonly string[] = inputType === "Expense" ? VARIABLE_CATEGORIES : INCOME_CATEGORIES;
  const amountVal = parseFloat(amount.replace(",", "."));
  const hasAmount = !isNaN(amountVal) && amountVal > 0;

  // Live balance preview
  const balanceAfter = hasAmount
    ? inputType === "Expense"
      ? availableBalance - amountVal
      : availableBalance + amountVal
    : null;

  // Budget warning
  const exceedsBudget =
    inputType === "Expense" &&
    hasAmount &&
    budgetLimits[category] !== undefined &&
    (categoryTotals[category] || 0) + amountVal > budgetLimits[category];

  const wasOverBudget = useRef(false);
  useEffect(() => {
    if (exceedsBudget && !wasOverBudget.current) {
      if (navigator.vibrate) navigator.vibrate(30);
      wasOverBudget.current = true;
    } else if (!exceedsBudget) {
      wasOverBudget.current = false;
    }
  }, [exceedsBudget]);

  // Smart Description Autofill & Auto-Categorization (dynamic matching with exact priority & keyword fallback)
  useEffect(() => {
    const trimmedDesc = desc.trim().toLowerCase();
    if (trimmedDesc.length < 1) return;

    // Combine transactions and presets for a broader historical search scope
    const allHistoricalItems = [
      ...(pastTransactions || []),
      ...(presets || []).map((p) => ({
        desc: p.desc || p.label,
        category: p.category,
        account: p.account,
        type: p.type,
      })),
    ];

    // Priority 1: Find an exact case-insensitive match
    let match = allHistoricalItems.find(
      (item) => item.desc && item.desc.toLowerCase() === trimmedDesc
    );

    // Priority 2: Find a prefix startsWith match
    if (!match) {
      match = allHistoricalItems.find(
        (item) => item.desc && item.desc.toLowerCase().startsWith(trimmedDesc)
      );
    }

    // Priority 3: Smart Belgian/General keyword mapping fallback
    if (!match) {
      const groceryKeywords = ["delhaize", "carrefour", "colruyt", "albert heijn", "ah", "aldi", "lidl", "market", "supermarket", "food", "groceries"];
      const eatingOutKeywords = ["starbucks", "mcdonald", "burger king", "restaurant", "cafe", "sushi", "pizza", "uber eats", "deliveroo", "kfc", "coffee", "bakery", "dunkin"];
      const transportKeywords = ["dott", "uber", "bolt", "sncb", "nmbs", "mivb", "stib", "tec", "delijn", "gas", "fuel", "parking", "train", "taxi"];
      const travelKeywords = ["hotel", "airbnb", "booking", "flight", "ryanair", "brussels airlines"];
      const funKeywords = ["cinema", "netflix", "spotify", "bar", "pub", "concert", "ticket", "game", "movie"];

      if (groceryKeywords.some(kw => trimmedDesc.includes(kw) || kw.startsWith(trimmedDesc))) {
        setInputType("Expense");
        setCategory("Groceries");
        return;
      }
      if (eatingOutKeywords.some(kw => trimmedDesc.includes(kw) || kw.startsWith(trimmedDesc))) {
        setInputType("Expense");
        setCategory("Eating Out");
        return;
      }
      if (transportKeywords.some(kw => trimmedDesc.includes(kw) || kw.startsWith(trimmedDesc))) {
        setInputType("Expense");
        setCategory("Transport");
        return;
      }
      if (travelKeywords.some(kw => trimmedDesc.includes(kw) || kw.startsWith(trimmedDesc))) {
        setInputType("Expense");
        setCategory("Travel");
        return;
      }
      if (funKeywords.some(kw => trimmedDesc.includes(kw) || kw.startsWith(trimmedDesc))) {
        setInputType("Expense");
        setCategory("Fun");
        return;
      }
    }

    if (match) {
      const isExpense =
        "type" in match
          ? match.type === "Expense"
          : (VARIABLE_CATEGORIES as readonly string[]).includes(match.category);

      setInputType(isExpense ? "Expense" : "Income");
      setCategory(match.category);
      if (match.account) {
        setAccount(match.account);
      }
    }
  }, [desc, pastTransactions, presets]);

  // Expose fillFrom via ref so parent can trigger preset fill
  useImperativeHandle(ref, () => ({
    fillFrom(preset: QuickPreset) {
      setInputType(preset.type);
      setAccount(preset.account);
      setAmount(String(preset.amount));
      setCategory(preset.category);
      setDesc(preset.desc || "");
      setIsCollapsed(false); // expand when filled
    },
  }));

  // Track scroll to collapse dock (with guard ref to block collapse when category list is open)
  const showDropdownRef = useRef(showDropdown);
  useEffect(() => {
    showDropdownRef.current = showDropdown;
  }, [showDropdown]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      if (showDropdownRef.current) return; // Skip collapsing if category picker is active

      // Prevent collapse when keyboard opens (auto-scroll) or while user is typing in any input
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const currentScrollY = window.scrollY;
      // Scroll down -> collapse
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsCollapsed(true);
      }
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Swipe up on dock card to expand it
  const dockTouchStartY = useRef<number | null>(null);
  const handleDockTouchStart = (e: React.TouchEvent) => {
    dockTouchStartY.current = e.touches[0].clientY;
  };
  const handleDockTouchMove = (e: React.TouchEvent) => {
    if (dockTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const diffY = dockTouchStartY.current - currentY;
    if (isCollapsed && diffY > 50) {
      setIsCollapsed(false);
      dockTouchStartY.current = null;
      if (navigator.vibrate) navigator.vibrate(30);
    }
  };
  const handleDockTouchEnd = () => {
    dockTouchStartY.current = null;
  };

  // Category Picker swipe gesture variables
  const isSwipingCategory = useRef(false);
  const swipeStartY = useRef<number | null>(null);
  const swipeStartIndex = useRef<number>(0);

  const handleCategoryClick = () => {
    if (isSwipingCategory.current) return;
    setShowDropdown((prev) => !prev);
  };

  // Bind Native non-passive touch listeners directly to bypass React synthetic event delegation order
  // Dependencies are set to re-register the event listeners whenever category picker mounts/unmounts or category changes
  useEffect(() => {
    const element = categoryPickerRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      swipeStartY.current = e.touches[0].clientY;
      swipeStartIndex.current = categories.indexOf(category);
      isSwipingCategory.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (swipeStartY.current === null) return;

      // Forcefully block the main app background scroll
      if (e.cancelable) {
        e.preventDefault();
      }

      const currentY = e.touches[0].clientY;
      const diffY = swipeStartY.current - currentY;

      if (Math.abs(diffY) > 10) {
        isSwipingCategory.current = true;
      }

      // 30px swipe represents one item change
      const step = Math.round(diffY / 30);
      let newIndex = swipeStartIndex.current + step;
      newIndex = Math.max(0, Math.min(categories.length - 1, newIndex));

      const nextCat = categories[newIndex];
      if (nextCat !== category) {
        setCategory(nextCat);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    };

    const handleTouchEnd = () => {
      swipeStartY.current = null;
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isCollapsed, category, categories]);

  const handleAdd = () => {
    if (!hasAmount || disabled) return;
    onAdd({ amount: amountVal, category, desc, account }, inputType);
    if (navigator.vibrate) navigator.vibrate(30);
    setAmount("");
    setDesc("");
    setCategory(inputType === "Expense" ? "Groceries" : "Other");
  };

  const handleTypeSwitch = (t: "Expense" | "Income") => {
    setInputType(t);
    setCategory(t === "Expense" ? "Groceries" : "Other");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const handleSavePreset = () => {
    if (!hasAmount) return;
    const label = desc.trim() || category;
    onSavePreset({ label, amount: amountVal, category, account, type: inputType, desc });
  };

  return (
    <div
      onTouchStart={handleDockTouchStart}
      onTouchMove={handleDockTouchMove}
      onTouchEnd={handleDockTouchEnd}
      className={`fixed bottom-10 left-6 right-6 bg-zinc-900/95 backdrop-blur-xl rounded-[2rem] shadow-2xl z-50 transition-all duration-500 ease-in-out border ${exceedsBudget
          ? "border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
          : "border-zinc-800/80"
        } ${isCollapsed ? "p-3" : "p-4"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Top Row: Presets (flex-1) + Expand Button (visible only when collapsed) */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex-1 min-w-0">
          <QuickPresets
            presets={presets}
            onSelect={(p) => {
              setInputType(p.type);
              setAccount(p.account);
              setAmount(String(p.amount));
              setCategory(p.category);
              setDesc(p.desc || "");
              setIsCollapsed(false); // auto-expand on select
            }}
            onDelete={onDeletePreset}
            onSaveCurrent={handleSavePreset}
            onInstantLog={onInstantLogPreset}
            disabled={disabled}
            isCollapsed={isCollapsed}
          />
        </div>

        {/* Sleek expand button that transitions its opacity and width */}
        <div className={`transition-all duration-500 ease-in-out overflow-hidden flex items-center ${isCollapsed ? "w-9 opacity-100 pl-1" : "w-0 opacity-0 pointer-events-none"
          }`}>
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex-shrink-0 w-9 h-9 bg-transparent flex items-center justify-center transition-all active:scale-95 outline-none"
            title="Expand"
          >
            <svg
              className="w-4 h-4 text-zinc-400 hover:text-white transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible Form Section */}
      <div className={`grid transition-all duration-500 ease-in-out ${isCollapsed ? "grid-rows-[0fr] opacity-0 pointer-events-none mt-0" : "grid-rows-[1fr] opacity-100 mt-3"
        }`}>
        {/* Dynamically allow overflow-visible when dropdown is open to prevent layout clipping */}
        <div className={showDropdown ? "overflow-visible" : "overflow-hidden"}>
          <div className="space-y-3 pt-1">
            {/* Type + Account toggles */}
            <div className="flex justify-between items-center mb-3">
              <div className="bg-zinc-800 p-1 rounded-full flex gap-1">
                {(["Expense", "Income"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTypeSwitch(t)}
                    className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${inputType === t
                      ? "bg-white text-zinc-900 shadow-lg"
                      : "text-zinc-500 hover:text-zinc-300"
                      }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="bg-zinc-800 p-1 rounded-full flex gap-1">
                {accounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAccount(a)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black transition-all ${
                      account === a
                        ? "bg-white text-zinc-900 shadow-lg"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="€"
                className="w-1/3 bg-zinc-800 rounded-2xl p-4 text-white font-black outline-none tabular-nums text-base"
                value={amount}
                onChange={(e) => {
                  let val = e.target.value;

                  // 1. Strip out any spaces or hidden characters mobile keyboards inject
                  // This strictly leaves only numbers, commas, and periods.
                  val = val.replace(/[^0-9.,]/g, '');

                  // 2. Extract only the valid pattern (numbers + max one comma/dot + numbers)
                  // By using .match() without the strict '$' at the end, it gracefully 
                  // accepts the valid part of the typing instead of rejecting the whole thing.
                  const match = val.match(/^[0-9]*[.,]?[0-9]*/);

                  if (match) {
                    setAmount(match[0]);
                  }
                }}
                onKeyDown={handleKeyDown}
              />

              {/* Custom interactive Category Picker */}
              <div className="relative flex-1">
                <div
                  ref={categoryPickerRef}
                  onClick={handleCategoryClick}
                  className="w-full bg-zinc-800 rounded-2xl p-4 text-white font-bold text-center select-none cursor-pointer flex flex-col justify-center items-center h-14 relative active:bg-zinc-700/80 transition-colors"
                >
                  <span className="text-zinc-400 font-medium select-none absolute top-1 uppercase tracking-wider text-[7px]">SWIPE ↕ / TAP</span>
                  <span className="mt-1">{category}</span>
                </div>

                {showDropdown && (
                  <>
                    {/* Invisible click-away backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

                    {/* Floating Dropdown List positioned cleanly above the selector */}
                    <div className="absolute bottom-full mb-3 left-0 right-0 max-h-64 overflow-y-auto overscroll-contain bg-zinc-900/98 backdrop-blur-2xl border border-zinc-800/85 rounded-3xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 no-scrollbar">
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-3.5 py-2 border-b border-zinc-800/60 mb-1 select-none">
                        Categories
                      </div>
                      <div className="space-y-1">
                        {categories.map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              setCategory(c);
                              setShowDropdown(false);
                              if (navigator.vibrate) navigator.vibrate(20);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-2xl text-[11px] font-black tracking-wide transition-all flex items-center justify-between active:scale-98 ${category === c
                              ? "bg-blue-600 text-white shadow-lg"
                              : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                              }`}
                          >
                            <span>{c.toUpperCase()}</span>
                            {category === c && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleAdd}
                disabled={loading || !hasAmount}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 w-14 h-14 rounded-2xl text-white text-3xl font-light transition-all active:scale-95"
              >
                +
              </button>
            </div>

            <input
              placeholder="Add description..."
              className="w-full mt-2 bg-zinc-800 rounded-2xl p-3 text-base text-white outline-none border border-zinc-700"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            {/* Balance preview */}
            {balanceAfter !== null && (
              <div className={`mt-2 text-center text-[10px] font-black tracking-wider transition-all ${balanceAfter >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}>
                AFTER: €{balanceAfter.toFixed(2)}
                {balanceAfter < 0 && " ⚠ OVERSPEND"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default AddDock;
