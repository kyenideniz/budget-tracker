import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

    // 3. DEFINITIONS
    const fixedDefinitions = {
      Housing: [
        { id: 'rent', amt: 773 },
        { id: 'bills', amt: 164 }
      ],
      Subscriptions: [
        { id: 'phone', amt: 59.99 },
        { id: 'icloud', amt: 2.99 },
        { id: 'amazon', amt: 2.99 }
      ]
    };

    // 4. CORE MATH
    const totalIncome = incomeItems.reduce((a: any, b: any) => a + b.amount, 0) + Number(rollover);
    const variableSpent = variableExpenses.reduce((a: any, b: any) => a + b.amount, 0);

    // Calculate only what has been marked as PAID
    const fixedCostsPaid = Object.values(fixedDefinitions).flat()
      .filter(item => fixedPaid.includes(item.id))
      .reduce((a, b) => a + b.amt, 0);

    // SPENDABLE POOL LOGIC (Income minus Fixed Bills)
    const spendablePool = totalIncome - fixedCostsPaid;
    const percentSpent = spendablePool > 0
      ? Math.round((variableSpent / spendablePool) * 100)
      : 100;

    // 5. EXPLICIT BANK ACCOUNT BALANCES
    // TEB Calculation
    const tebIncome = incomeItems.filter((i: any) => i.account === 'TEB' || i.desc?.includes('TEB')).reduce((a: any, b: any) => a + b.amount, 0);
    const tebSpent = variableExpenses.filter((e: any) => e.account === 'TEB').reduce((a: any, b: any) => a + b.amount, 0);
    const tebAvailable = tebIncome - tebSpent;

    // KBC Calculation (Income - Variable Spent - Fixed Bills - Savings)
    const kbcIncome = incomeItems.filter((i: any) => i.account === 'KBC' || i.desc?.includes('KBC')).reduce((a: any, b: any) => a + b.amount, 0) + Number(rollover);
    const kbcVariableSpent = variableExpenses.filter((e: any) => e.account === 'KBC').reduce((a: any, b: any) => a + b.amount, 0);

    // This explicitly reduces KBC balance by your fixed bills if they are PAID
    const kbcAvailable = kbcIncome - kbcVariableSpent - fixedCostsPaid - savings;

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
