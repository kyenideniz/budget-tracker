export interface FixedItem {
  id: string;
  name: string;
  amt: number;
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


/** Returns fixed expense definitions. Insurance is only in Q1 months (Jan/Apr/Jul/Oct). */
export function getFixedDefinitions(monthId: string): Record<string, FixedItem[]> {
  const monthIndex = new Date(monthId + "-01").getMonth();
  return {
    Housing: [
      { id: "rent", name: "Rent", amt: 773 },
      { id: "bills", name: "Bills", amt: 164 },
    ],
    Subscriptions: [
      { id: "phone", name: "Phone", amt: 59.99 },
      { id: "icloud", name: "iCloud", amt: 2.99 },
      { id: "amazon", name: "Amazon", amt: 2.99 },
      ...([0, 3, 6, 9].includes(monthIndex)
        ? [{ id: "insurance", name: "Insurance", amt: 29.97 }]
        : []),
    ],
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

export type Account = "KBC" | "TEB";

/** Generates a collision-free ID for new transactions. */
export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
