import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// We'll use a direct string path to keep TypeScript happy
const SETTINGS_STR = "users/kerem-efe/settings/activeMonth";

export async function GET() {
  try {
    const settingsRef = doc(db, SETTINGS_STR);
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) return NextResponse.json({ error: "No settings" }, { status: 404 });

    const { monthId, lastNotifiedLevel = 0 } = settingsSnap.data();

    // Using string template for the month path too
    const monthRef = doc(db, `users/kerem-efe/months/${monthId}`);
    const monthSnap = await getDoc(monthRef);

    if (!monthSnap.exists()) return NextResponse.json({ error: "No month data" });

    const data = monthSnap.data();
    const totalIn = (data.incomeItems || []).reduce((a: number, b: any) => a + b.amount, 0) + Number(data.rollover || 0);
    const totalVar = (data.variableExpenses || []).reduce((a: number, b: any) => a + b.amount, 0);

    const housingTotal = 773 + 164;
    let spendableBudget = totalIn - (data.savings || 0) - housingTotal;

    if (spendableBudget <= 0) spendableBudget = totalIn;

    const percent = spendableBudget > 0 ? Math.floor((totalVar / spendableBudget) * 100) : 0;
    const remaining = spendableBudget - totalVar;

    let currentLevel = 0;
    if (percent >= 90 || remaining <= 50) currentLevel = 3;
    else if (percent >= 75 || remaining <= 100) currentLevel = 2;
    else if (percent >= 50) currentLevel = 1;

    if (percent < 5 && lastNotifiedLevel > 0) {
        await updateDoc(settingsRef, { lastNotifiedLevel: 0 });
    }

    let notification = null;
    if (currentLevel > lastNotifiedLevel) {
        notification = {
            level: currentLevel,
            title: currentLevel === 3 ? "Danger Zone! 🚩" : "Budget Update ⚠️",
            body: currentLevel === 3 ? `You've used ${percent}%! €${remaining.toFixed(2)} left.` : `You've used ${percent}% of your flexible budget.`
        };
    }

    return NextResponse.json({
      spent: totalVar.toFixed(2),
      budget: spendableBudget.toFixed(2),
      percent: percent.toString(),
      notification: notification
    });
  } catch (e) {
    console.error(e);
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