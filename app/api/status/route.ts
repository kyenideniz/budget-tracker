import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFixedDefinitions } from '@/lib/constants';

// Legacy default — keeps your existing widget working without any changes
const LEGACY_DATA_PATH = "kerem-efe";

export async function GET(request: NextRequest) {
  try {
    // Accept ?uid= for new users or ?dataPath= for explicit path override.
    // Falls back to the legacy "kerem-efe" path so the existing widget keeps working.
    const { searchParams } = new URL(request.url);
    const uidParam = searchParams.get("uid");

    // Resolve the data path: if a uid was passed, look up their profile to get dataPath
    let dataPath = LEGACY_DATA_PATH;
    if (uidParam) {
      try {
        const profileSnap = await getDoc(doc(db, "users", uidParam, "settings", "profile"));
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          dataPath = profileData.dataPath ?? uidParam;
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
    const currentMonth = settingsSnap.exists() ? settingsSnap.data().monthId : new Date().toISOString().slice(0, 7);

    // 2. FETCH DATA
    const monthRef = doc(db, "users", dataPath, "months", currentMonth);
    const monthSnap = await getDoc(monthRef);

    if (!monthSnap.exists()) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    const data = monthSnap.data();
    const incomeItems = data.incomeItems || [];
    const variableExpenses = data.variableExpenses || [];
    const fixedPaid = data.fixedPaid || [];
    const rollover = data.rollover || 0;
    const savings = data.savings || 0;

    // 3. DYNAMIC FIXED DEFINITIONS
    const fixedDefinitions = getFixedDefinitions(currentMonth);

    // 4. CORE MATH
    const totalIncome = incomeItems.reduce((a: number, b: { amount: number }) => a + b.amount, 0) + Number(rollover);
    const variableSpent = variableExpenses.reduce((a: number, b: { amount: number }) => a + b.amount, 0);

    const fixedCostsPaid = Object.values(fixedDefinitions)
      .flat()
      .filter((item) => fixedPaid.includes(item.id))
      .reduce((a, b) => a + b.amt, 0);

    const spendablePool = totalIncome - fixedCostsPaid;
    const percentSpent = spendablePool > 0
      ? Math.round((variableSpent / spendablePool) * 100)
      : 100;

    // 5. PER-ACCOUNT BALANCES
    // Get unique account names from transactions
    const accountNames = Array.from(new Set<string>([
      ...incomeItems.map((i: { account?: string }) => i.account).filter(Boolean),
      ...variableExpenses.map((e: { account?: string }) => e.account).filter(Boolean),
    ])) as string[];

    const accountBalances: Record<string, number> = {};
    for (const acc of accountNames) {
      const accIncome = incomeItems
        .filter((i: { account?: string; desc?: string }) => i.account === acc || i.desc?.includes(acc))
        .reduce((a: number, b: { amount: number }) => a + b.amount, 0);
      const accSpent = variableExpenses
        .filter((e: { account?: string; desc?: string }) => e.account === acc || e.desc?.includes(acc))
        .reduce((a: number, b: { amount: number }) => a + b.amount, 0);
      accountBalances[acc] = accIncome - accSpent;
    }

    // Legacy KBC/TEB compat fields (for existing widgets)
    const totalSpent = fixedCostsPaid + variableSpent;
    const availableBalance = totalIncome - totalSpent - savings;

    // First account = "primary" (KBC compat), second = "secondary" (TEB compat)
    const [primaryAcc, secondaryAcc] = accountNames;
    const primaryBalance = primaryAcc ? accountBalances[primaryAcc] : availableBalance;
    const secondaryBalance = secondaryAcc ? accountBalances[secondaryAcc] : 0;

    const remainingPercent = 100 - Math.min(percentSpent, 100);
    const totalAccountBalance = primaryBalance + secondaryBalance;
    const primaryRatio = totalAccountBalance > 0 ? primaryBalance / totalAccountBalance : 1;
    const secondaryRatio = totalAccountBalance > 0 ? secondaryBalance / totalAccountBalance : 0;

    return NextResponse.json({
      percentSpent: Math.min(percentSpent, 100),
      // Legacy fields (widget backward compat)
      kbcPercent: (remainingPercent * Math.max(primaryRatio, 0)).toFixed(2),
      tebPercent: (remainingPercent * Math.max(secondaryRatio, 0)).toFixed(2),
      kbcBalance: primaryBalance.toFixed(2),
      tebBalance: secondaryBalance.toFixed(2),
      // New generic fields
      accountBalances,
      notification: null,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}