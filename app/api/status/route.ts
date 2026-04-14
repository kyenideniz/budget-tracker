import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const settingsRef = doc(db, "users", "kerem-efe", "settings", "activeMonth");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) return NextResponse.json({ error: "No settings" }, { status: 404 });

    const { monthId, lastNotifiedLevel = 0 } = settingsSnap.data();
    const monthSnap = await getDoc(doc(db, "users", "kerem-efe", "months", monthId));

    if (!monthSnap.exists()) return NextResponse.json({ error: "No data" });

    const data = monthSnap.data();
    const totalIn = (data.incomeItems || []).reduce((a: number, b: any) => a + b.amount, 0) + Number(data.rollover || 0);
    const totalVar = (data.variableExpenses || []).reduce((a: number, b: any) => a + b.amount, 0);

    // Logic: If income is low (mid-month), use totalIn as budget to avoid negative numbers
    const housingTotal = 773 + 164;
    let spendableBudget = totalIn - (data.savings || 0) - housingTotal;

    if (spendableBudget <= 0) spendableBudget = totalIn; // Fallback for mid-month tracking

    const percent = spendableBudget > 0 ? Math.floor((totalVar / spendableBudget) * 100) : 0;
    const remaining = spendableBudget - totalVar;

    // --- NOTIFICATION BRAIN ---
    let notification = null;
    let newLevel = lastNotifiedLevel;

    // Determine current "Level" (1=50%, 2=75%, 3=90%, 4=Danger)
    let currentLevel = 0;
    if (percent >= 90 || remaining <= 50) currentLevel = 3;
    else if (percent >= 75 || remaining <= 100) currentLevel = 2;
    else if (percent >= 50) currentLevel = 1;

    // Only notify if we moved UP a level
    if (currentLevel > lastNotifiedLevel) {
        newLevel = currentLevel;
        notification = {
            title: currentLevel === 3 ? "Danger Zone! 🚩" : "Budget Update ⚠️",
            body: currentLevel === 3 ? `You've used ${percent}%! Only €${remaining.toFixed(2)} left.` : `You've used ${percent}% of your flexible budget.`
        };
        // Update Firebase so we don't notify this level again
        await updateDoc(settingsRef, { lastNotifiedLevel: newLevel });
    }

    // Reset logic: If percent is low (new month/new income), reset level to 0
    if (percent < 5 && lastNotifiedLevel > 0) {
        await updateDoc(settingsRef, { lastNotifiedLevel: 0 });
    }

    return NextResponse.json({
      spent: totalVar.toFixed(2),
      budget: spendableBudget.toFixed(2),
      percent: percent.toString(),
      notification: notification // Widget will only fire if this exists
    });

  } catch (error) {
    return NextResponse.json({ error: "Fail" }, { status: 500 });
  }
}