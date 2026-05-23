export interface FixedItem {
  id: string;
  name: string;
  amt: number;
}

export interface FixedExpenses {
  housing: FixedItem[];
  subscriptions: FixedItem[];
}

export interface QuickPreset {
  id: string;
  label: string;
  amount: number;
  category: string;
  account: Account;
  type: "Expense" | "Income";
  desc?: string;
}

/** Default fixed expenses (used for legacy users with no custom config). */
export const DEFAULT_FIXED_EXPENSES: FixedExpenses = {
  housing: [
    { id: "rent", name: "Rent", amt: 773 },
    { id: "bills", name: "Bills", amt: 164 },
  ],
  subscriptions: [
    { id: "phone", name: "Phone", amt: 59.99 },
    { id: "icloud", name: "iCloud", amt: 2.99 },
    { id: "amazon", name: "Amazon", amt: 2.99 },
  ],
};

/**
 * Returns fixed expense definitions for the given month.
 * If the user has custom fixedExpenses in their profile, those are used.
 * Otherwise falls back to the hardcoded legacy defaults.
 * Insurance (quarterly) is always appended to subscriptions automatically.
 */
export function getFixedDefinitions(
  monthId: string,
  fixedExpenses?: FixedExpenses
): Record<string, FixedItem[]> {
  const monthIndex = new Date(monthId + "-01").getMonth();
  const isInsuranceMonth = [0, 3, 6, 9].includes(monthIndex);

  const housing = fixedExpenses?.housing ?? DEFAULT_FIXED_EXPENSES.housing;
  const subscriptions = fixedExpenses?.subscriptions ?? DEFAULT_FIXED_EXPENSES.subscriptions;

  // Insurance is always quarterly — add it unless the user has already defined it
  const hasInsurance = subscriptions.some((s) => s.id === "insurance");
  const extraSubs: FixedItem[] =
    isInsuranceMonth && !hasInsurance
      ? [{ id: "insurance", name: "Insurance", amt: 29.97 }]
      : [];

  return {
    Housing: housing,
    Subscriptions: [...subscriptions, ...extraSubs],
  };
}

export const VARIABLE_CATEGORIES = [
  "Groceries",
  "Eating Out",
  "Coffee",
  "Transport",
  "Travel",
  "Fun",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Blocked", "Famiris", "KYK", "Other"] as const;

export type Account = string;

/** Generates a collision-free ID for new transactions. */
export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
