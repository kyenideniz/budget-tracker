import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const settingsSnap = await getDoc(doc(db, "users", "kerem-efe", "settings", "activeMonth"));

    if (!settingsSnap.exists()) {
        return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    const monthId = settingsSnap.data().monthId;
    const monthSnap = await getDoc(doc(db, "users", "kerem-efe", "months", monthId));

    if (!monthSnap.exists()) {
        return NextResponse.json({ error: "Month data not found" }, { status: 404 });
    }

    const data = monthSnap.data();
    const incomeItems = data.incomeItems || [];
    const varExpenses = data.variableExpenses || [];
    const fixedPaid = data.fixedPaid || [];
    const rollover = data.rollover || 0;
    const savings = data.savings || 0;

    // 1. Mandatory Obligations (EXCLUDED from widget budget)
    const housingTotal = 773 + 164; // Rent + Bills

    // 2. Spendable Fixed Items (Included in widget)
    const subDefs = [
      { id: 'phone', amt: 59.99 },
      { id: 'icloud', amt: 2.99 },
      { id: 'amazon', amt: 2.99 }
    ];

    // 3. MATH
    const totalIn = incomeItems.reduce((a: number, b: any) => a + b.amount, 0) + Number(rollover);

    // Budget = Money left for life after rent, bills, and savings
    const spendableBudget = totalIn - savings - housingTotal;

    // Spent = Paid subscriptions + all logs (Groceries, Fun, Travel, etc.)
    const paidSubs = subDefs
        .filter(i => fixedPaid.includes(i.id))
        .reduce((a, b) => a + b.amt, 0);

    const totalVar = varExpenses.reduce((a: number, b: any) => a + b.amount, 0);
    const lifeSpent = paidSubs + totalVar;

    const percent = spendableBudget > 0 ? Math.min((lifeSpent / spendableBudget) * 100, 100) : 0;

    return NextResponse.json({
      spent: lifeSpent.toFixed(2),
      budget: spendableBudget.toFixed(2),
      percent: percent.toFixed(0),
      label: "Spendable Power"
    });

  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}