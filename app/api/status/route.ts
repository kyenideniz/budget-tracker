import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const SETTINGS_STR = "users/kerem-efe/settings/activeMonth";

export async function GET() {
  try {
    const settingsRef = doc(db, SETTINGS_STR);
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) return NextResponse.json({ error: "No settings" }, { status: 404 });

    const { monthId, lastNotifiedLevel = 0 } = settingsSnap.data();

    const monthRef = doc(db, `users/kerem-efe/months/${monthId}`);
    const monthSnap = await getDoc(monthRef);
    if (!monthSnap.exists()) return NextResponse.json({ error: "No month data" });

    const data = monthSnap.data();

    // 1. Initial Balances (from Income & Rollover)
    const income = data.incomeItems || [];
    let kbcTotal = income.filter((i:any) => i.desc?.includes("KBC") || i.account === "KBC").reduce((a:number, b:any) => a + b.amount, 0);
    let tebTotal = income.filter((i:any) => i.desc?.includes("TEB") || i.account === "TEB").reduce((a:number, b:any) => a + b.amount, 0);

    // Add any unassigned income/rollover to KBC by default
    const unassignedIncome = income.filter((i:any) => !i.desc?.includes("KBC") && !i.desc?.includes("TEB") && !i.account).reduce((a:number, b:any) => a + b.amount, 0);
    kbcTotal += unassignedIncome + Number(data.rollover || 0);

    let spendableBudget = kbcTotal + tebTotal - (data.savings || 0) - (773 + 164);
    if (spendableBudget <= 0) spendableBudget = kbcTotal + tebTotal;

    // 2. Subtract Variable Expenses
    const expenses = data.variableExpenses || [];
    let totalSpent = 0;
    expenses.forEach((e:any) => {
      totalSpent += e.amount;
      if (e.account === "TEB" || e.desc?.includes("TEB")) tebTotal -= e.amount;
      else kbcTotal -= e.amount;
    });

    const percentSpent = spendableBudget > 0 ? Math.min(Math.floor((totalSpent / spendableBudget) * 100), 100) : 0;

    // 3. Split-Bar Calculations (Ratio of actual remaining pool)
    const actualRemainingPool = Math.max(kbcTotal + tebTotal, 1);
    const kbcRatio = Math.max(kbcTotal / actualRemainingPool, 0);
    const tebRatio = Math.max(tebTotal / actualRemainingPool, 0);

    // KBC and TEB bars take up whatever % of the progress bar is NOT spent yet
    const remainingPercent = 100 - percentSpent;
    const kbcPercent = remainingPercent * kbcRatio;
    const tebPercent = remainingPercent * tebRatio;

    // 4. Notification Logic
    let currentLevel = 0;
    if (percentSpent >= 90) currentLevel = 3;
    else if (percentSpent >= 75) currentLevel = 2;
    else if (percentSpent >= 50) currentLevel = 1;

    if (percentSpent < 5 && lastNotifiedLevel > 0) {
        await updateDoc(settingsRef, { lastNotifiedLevel: 0 });
    }

    let notification = null;
    if (currentLevel > lastNotifiedLevel) {
        notification = {
            level: currentLevel,
            title: currentLevel === 3 ? "Danger Zone! 🚩" : "Budget Update ⚠️",
            body: `${percentSpent}% used. KBC: €${kbcTotal.toFixed(0)}, TEB: €${tebTotal.toFixed(0)}`
        };
    }

    return NextResponse.json({
      percentSpent,
      kbcPercent: kbcPercent.toFixed(2),
      tebPercent: tebPercent.toFixed(2),
      kbcBalance: kbcTotal.toFixed(2),
      tebBalance: tebTotal.toFixed(2),
      notification
    });
  } catch (e) {
    return NextResponse.json({ error: "Fail" }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const { level } = await request.json();
        const settingsRef = doc(db, SETTINGS_STR);
        await updateDoc(settingsRef, { lastNotifiedLevel: level });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}