import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFixedDefinitions } from '@/lib/constants';

export async function GET() {
  try {
    // 1. GET ACTIVE MONTH
    const settingsRef = doc(db, "users", "kerem-efe", "settings", "activeMonth");
    const settingsSnap = await getDoc(settingsRef);
    const currentMonth = settingsSnap.exists() ? settingsSnap.data().monthId : new Date().toISOString().slice(0, 7);

    // 2. FETCH DATA
    const monthRef = doc(db, "users", "kerem-efe", "months", currentMonth);
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
    const totalIncome = incomeItems.reduce((a: any, b: any) => a + b.amount, 0) + Number(rollover);
    const variableSpent = variableExpenses.reduce((a: any, b: any) => a + b.amount, 0);

    // Calculate only what has been marked as PAID
    const fixedCostsPaid = Object.values(fixedDefinitions)
      .flat()
      .filter((item: any) => fixedPaid.includes(item.id))
      .reduce((a, b) => a + b.amt, 0);

    // SPENDABLE POOL LOGIC (Income minus Fixed Bills)
    const spendablePool = totalIncome - fixedCostsPaid;
    const percentSpent = spendablePool > 0
      ? Math.round((variableSpent / spendablePool) * 100)
      : 100;

    // 5. EXPLICIT BANK ACCOUNT BALANCES (Synchronized with client-side useBudgetData logic)
    // TEB Calculation
    const tebIncome = incomeItems
      .filter((i: any) => i.account === 'TEB' || i.desc?.includes('TEB'))
      .reduce((a: any, b: any) => a + b.amount, 0);
    const tebSpent = variableExpenses
      .filter((e: any) => e.account === 'TEB' || e.desc?.includes('TEB'))
      .reduce((a: any, b: any) => a + b.amount, 0);
    const tebAvailable = tebIncome - tebSpent;

    // Total Available (Income - Total Spent - Savings)
    const totalSpent = fixedCostsPaid + variableSpent;
    const availableBalance = totalIncome - totalSpent - savings;

    // KBC is the remaining pool of the available balance
    const kbcAvailable = availableBalance - tebAvailable;

    // 6. WIDGET RATIOS
    const totalAvailable = kbcAvailable + tebAvailable;
    const kbcRatio = totalAvailable > 0 ? kbcAvailable / totalAvailable : 0;
    const tebRatio = totalAvailable > 0 ? tebAvailable / totalAvailable : 0;
    const remainingPercent = 100 - percentSpent;

    return NextResponse.json({
      percentSpent: Math.min(percentSpent, 100),
      kbcPercent: (remainingPercent * Math.max(kbcRatio, 0)).toFixed(2),
      tebPercent: (remainingPercent * Math.max(tebRatio, 0)).toFixed(2),
      kbcBalance: kbcAvailable.toFixed(2),
      tebBalance: tebAvailable.toFixed(2),
      notification: null
    });

  } catch (error) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}