import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFixedDefinitions, type FixedExpenses } from '@/lib/constants';

// Legacy default — keeps your existing widget working without any changes
const LEGACY_DATA_PATH = "kerem-efe";

export async function GET(request: NextRequest) {
  try {
    // Accept ?uid= for new users or ?dataPath= for explicit path override.
    // Falls back to the legacy "kerem-efe" path so the existing widget keeps working.
    const { searchParams } = new URL(request.url);
    const uidParam = searchParams.get("uid");

    // Resolve the data path and load the user profile (for fixedExpenses + accounts)
    let dataPath = LEGACY_DATA_PATH;
    let profileAccounts: string[] | null = null;
    let profileFixedExpenses: FixedExpenses | undefined = undefined;
    let displayName: string = "Budget";

    if (uidParam) {
      try {
        const profileSnap = await getDoc(doc(db, "users", uidParam, "settings", "profile"));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          dataPath = profileData.dataPath ?? uidParam;
          displayName = profileData.displayName ?? "Budget";
          profileAccounts = profileData.accounts ?? null;
          profileFixedExpenses = profileData.fixedExpenses ?? undefined;
        } else {
          dataPath = uidParam;
        }
      } catch {
        dataPath = uidParam;
      }
    }

    // 1. GET ACTIVE MONTH
    const settingsRef = doc(db, "users", dataPath, "settings", "activeMonth");
    const settingsSnap = await getDoc(settingsRef);
    const currentMonth = settingsSnap.exists()
      ? settingsSnap.data().monthId
      : new Date().toISOString().slice(0, 7);

    // 2. FETCH MONTH DATA
    const monthRef = doc(db, "users", dataPath, "months", currentMonth);
    const monthSnap = await getDoc(monthRef);

    if (!monthSnap.exists()) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    const data = monthSnap.data();
    const incomeItems: { amount: number; account?: string; desc?: string }[] = data.incomeItems || [];
    const variableExpenses: { amount: number; account?: string; desc?: string }[] = data.variableExpenses || [];
    const fixedPaid: string[] = data.fixedPaid || [];
    const rollover: number = data.rollover || 0;
    const savings: number = data.savings || 0;

    // 3. FIXED DEFINITIONS — use per-user config if available, else legacy defaults
    const fixedDefinitions = getFixedDefinitions(currentMonth, profileFixedExpenses);

    // 4. CORE MATH
    const totalIncome =
      incomeItems.reduce((a, b) => a + b.amount, 0) + Number(rollover);
    const variableSpent =
      variableExpenses.reduce((a, b) => a + b.amount, 0);

    const paidFixedTotal = Object.values(fixedDefinitions)
      .flat()
      .filter((item) => fixedPaid.includes(item.id))
      .reduce((a, b) => a + b.amt, 0);

    const totalSpent = paidFixedTotal + variableSpent;
    const availableBalance = totalIncome - totalSpent - savings;

    const spendablePool = totalIncome - paidFixedTotal;
    const percentSpent =
      spendablePool > 0 ? Math.round((variableSpent / spendablePool) * 100) : 100;

    // 5. PER-ACCOUNT BALANCES (matching the UI logic exactly)
    // Determine account order: prefer profile-defined order, fall back to transaction-derived
    const txAccountNames = Array.from(
      new Set<string>([
        ...incomeItems.map((i) => i.account).filter((a): a is string => Boolean(a)),
        ...variableExpenses.map((e) => e.account).filter((a): a is string => Boolean(a)),
      ])
    );
    const accountNames: string[] =
      profileAccounts && profileAccounts.length > 0 ? profileAccounts : txAccountNames;

    const accountBalances: Record<string, number> = {};
    for (const acc of accountNames) {
      const accIncome = incomeItems
        .filter((i) => i.account === acc || i.desc?.includes(acc))
        .reduce((a, b) => a + b.amount, 0);
      const accSpent = variableExpenses
        .filter((e) => e.account === acc || e.desc?.includes(acc))
        .reduce((a, b) => a + b.amount, 0);
      accountBalances[acc] = accIncome - accSpent;
    }

    // ── BUG FIX: Deduct paid fixed costs + savings from primary account ──────
    // Mirrors the exact same logic as useBudgetData.ts so widget and UI are in sync.
    if (accountNames.length > 0) {
      accountBalances[accountNames[0]] =
        (accountBalances[accountNames[0]] ?? 0) - paidFixedTotal - savings;
    }

    // 6. LEGACY COMPAT FIELDS (for existing widgets that use kbcBalance / tebBalance)
    const [primaryAcc, secondaryAcc] = accountNames;
    const primaryBalance = primaryAcc != null ? (accountBalances[primaryAcc] ?? 0) : availableBalance;
    const secondaryBalance = secondaryAcc != null ? (accountBalances[secondaryAcc] ?? 0) : 0;

    const remainingPercent = 100 - Math.min(percentSpent, 100);
    const totalAccountBalance = primaryBalance + secondaryBalance;
    const primaryRatio = totalAccountBalance > 0 ? primaryBalance / totalAccountBalance : 1;
    const secondaryRatio = totalAccountBalance > 0 ? secondaryBalance / totalAccountBalance : 0;

    return NextResponse.json({
      // Summary
      availableBalance: availableBalance.toFixed(2),
      percentSpent: Math.min(percentSpent, 100),
      month: currentMonth,
      // Per-account balances (correct, fixed-costs-included)
      accountBalances,
      accountNames,
      // Legacy fields (backward compat for old widget)
      kbcPercent: (remainingPercent * Math.max(primaryRatio, 0)).toFixed(2),
      tebPercent: (remainingPercent * Math.max(secondaryRatio, 0)).toFixed(2),
      kbcBalance: primaryBalance.toFixed(2),
      tebBalance: secondaryBalance.toFixed(2),
      displayName,
      notification: null,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}