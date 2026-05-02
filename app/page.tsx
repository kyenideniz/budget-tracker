"use client";
import React, { useState, useEffect, ChangeEvent } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';

// 1. STRICT TYPE DEFINITIONS
interface Transaction {
  id: number;
  amount: number;
  category: string;
  desc?: string;
  account?: 'KBC' | 'TEB';
}

interface FixedItem {
  id: string;
  name: string;
  amt: number;
}

interface MonthData {
  incomeItems: Transaction[];
  variableExpenses: Transaction[];
  fixedPaid: string[];
  savings: number;
  rollover: number;
}

export default function BudgetTracker() {
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [incomeItems, setIncomeItems] = useState<Transaction[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<Transaction[]>([]);
  const [fixedPaid, setFixedPaid] = useState<string[]>([]);
  const [savings, setSavings] = useState<number>(0);
  const [rollover, setRollover] = useState<number>(0);

  const [inputType, setInputType] = useState<'Expense' | 'Income'>('Expense');
  const [account, setAccount] = useState<'KBC' | 'TEB'>('KBC');
  const [newItem, setNewItem] = useState({ amount: "", category: "Groceries", desc: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  // 2. FISCAL MONTH LOGIC
  useEffect(() => {
    const fetchActiveMonth = async () => {
      const settingsRef = doc(db, "users", "kerem-efe", "settings", "activeMonth");
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        setCurrentMonth(settingsSnap.data().monthId);
      } else {
        const initialMonth = new Date().toISOString().slice(0, 7);
        setCurrentMonth(initialMonth);
        await setDoc(settingsRef, { monthId: initialMonth });
      }
    };
    fetchActiveMonth();
  }, []);

  // 3. DATA SYNCING
  useEffect(() => {
    if (!currentMonth) return;
    const unsub = onSnapshot(doc(db, "users", "kerem-efe", "months", currentMonth), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MonthData;
        setIncomeItems(data.incomeItems || []);
        setVariableExpenses(data.variableExpenses || []);
        setFixedPaid(data.fixedPaid || []);
        setSavings(data.savings || 0);
        setRollover(data.rollover || 0);
      }
    });
    return () => unsub();
  }, [currentMonth]);

  const sync = (updates: Partial<MonthData>) =>
    setDoc(doc(db, "users", "kerem-efe", "months", currentMonth), updates, { merge: true });

  // 4. DEFINITIONS & MATH
  const fixedDefinitions: Record<string, FixedItem[]> = {
    Housing: [{ id: 'rent', name: 'Rent', amt: 773 }, { id: 'bills', name: 'Bills', amt: 164 }],
    Subscriptions: [
      { id: 'phone', name: 'Phone', amt: 59.99 },
      { id: 'icloud', name: 'iCloud', amt: 2.99 },
      { id: 'amazon', name: 'Amazon', amt: 2.99 },
      ...([0, 3, 6, 9].includes(new Date(currentMonth + "-01").getMonth()) ? [{ id: 'insurance', name: 'Insurance', amt: 29.97 }] : [])
    ]
  };

  const variableCategories = ['Groceries', 'Eating Out', 'Coffee', 'Transport', 'Travel', 'Fun', 'Other'];

  const totalIncome = incomeItems.reduce((a, b) => a + b.amount, 0) + Number(rollover);
  const paidFixedTotal = Object.values(fixedDefinitions).flat()
    .filter((item) => fixedPaid.includes(item.id))
    .reduce((a, b) => a + b.amt, 0);
  const totalSpent = paidFixedTotal + variableExpenses.reduce((a, b) => a + b.amount, 0);
  const availableBalance = totalIncome - totalSpent - savings;

  // Split calculations
  const tebIncome = incomeItems.filter(i => i.account === 'TEB').reduce((a, b) => a + b.amount, 0);
  const tebSpent = variableExpenses.filter(e => e.account === 'TEB').reduce((a, b) => a + b.amount, 0);
  const tebAvailable = tebIncome - tebSpent;
  const kbcAvailable = availableBalance - tebAvailable;

  // 5. ACTIONS
  const startNextMonth = async () => {
    if (!window.confirm("Start new month? KBC and TEB leftovers will carry separately.")) return;

    const date = new Date(currentMonth + "-02");
    date.setMonth(date.getMonth() + 1);
    const nextId = date.toISOString().slice(0, 7);

    const nextMonthData: MonthData = {
      fixedPaid: ['amazon', 'icloud'],
      incomeItems: [
        { id: Date.now(), amount: kbcAvailable > 0 ? kbcAvailable : 0, category: 'Other', desc: 'KBC Rollover', account: 'KBC' },
        { id: Date.now() + 1, amount: tebAvailable > 0 ? tebAvailable : 0, category: 'Other', desc: 'TEB Rollover', account: 'TEB' }
      ],
      variableExpenses: [],
      savings: 0,
      rollover: 0
    };

    await setDoc(doc(db, "users", "kerem-efe", "months", nextId), nextMonthData);
    await setDoc(doc(db, "users", "kerem-efe", "settings", "activeMonth"), { monthId: nextId });
    setCurrentMonth(nextId);
  };

  const handleAdd = async () => {
    const val = parseFloat(newItem.amount);
    if (isNaN(val)) return;

    const newTransaction: Transaction = {
      amount: val,
      category: newItem.category,
      desc: newItem.desc,
      account: account,
      id: Date.now()
    };

    if (inputType === 'Income') {
        const updated = [...incomeItems, newTransaction];
        setIncomeItems(updated);
        sync({ incomeItems: updated });
    } else {
        const updated = [...variableExpenses, newTransaction];
        setVariableExpenses(updated);
        sync({ variableExpenses: updated });
    }
    setNewItem({ amount: "", category: inputType === 'Income' ? "Other" : "Groceries", desc: "" });
  };

  const deleteExpense = (id: number) => {
    const updated = variableExpenses.filter(e => e.id !== id);
    setVariableExpenses(updated);
    sync({ variableExpenses: updated });
  };

  return (
    <main className="max-w-md mx-auto min-h-screen bg-white p-6 pb-64 font-sans">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 text-left">
        <div>
            <h2 className="font-black text-2xl text-zinc-800 tracking-tight">
              {currentMonth ? new Date(currentMonth + "-01").toLocaleString('default', { month: 'long', year: 'numeric' }) : "Loading..."}
            </h2>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fiscal Period</p>
        </div>
        <button onClick={startNextMonth} className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">
          New Month +
        </button>
      </div>

      {/* BALANCE CARD */}
      <div className="bg-zinc-900 rounded-[3rem] p-10 shadow-2xl mb-8 text-white text-center">
        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Available Balance</span>
        <h1 className="text-6xl font-black mt-2 mb-3 tracking-tighter">€{availableBalance.toFixed(2)}</h1>

        <div className="flex justify-center gap-3 mb-6">
            <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-black tracking-widest text-blue-400">KBC €{kbcAvailable.toFixed(2)}</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-black tracking-widest text-emerald-400">TEB €{tebAvailable.toFixed(2)}</span>
            </div>
        </div>

        <div className="flex justify-between text-[10px] font-bold text-zinc-400 border-t border-zinc-800 pt-6">
          <span className="text-emerald-400">IN €{totalIncome.toFixed(0)}</span>
          <span className="text-rose-400">OUT €{totalSpent.toFixed(0)}</span>
          <span className="text-blue-400">SAVED €{savings.toFixed(0)}</span>
        </div>
      </div>

      {/* FUNDS MANAGEMENT */}
      <section className="bg-zinc-50 rounded-[2rem] p-6 mb-6 border border-zinc-100 grid grid-cols-2 gap-4">
          <div className="text-center">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Carried Forward</p>
              <p className="text-lg font-black text-zinc-800">€{rollover.toFixed(2)}</p>
          </div>
          <div className="text-center border-l border-zinc-200">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Set to Savings</p>
              <input
                type="number"
                value={savings || ""}
                placeholder="0"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSavings(val);
                  sync({savings: val});
                }}
                className="w-20 bg-transparent text-center font-black text-lg text-blue-600 outline-none"
              />
          </div>
      </section>

      {/* SECTIONS: Fixed + Variable */}
      <div className="space-y-3">
        {/* Fixed Sections */}
        {Object.keys(fixedDefinitions).map(cat => (
          <div key={cat} className="bg-zinc-50 rounded-[2rem] border border-zinc-100 overflow-hidden shadow-sm">
            <button onClick={() => setExpanded(expanded === cat ? null : cat)} className="w-full flex justify-between p-6 font-black text-zinc-800 items-center">
              <span>{cat}</span>
              <span className="text-zinc-300 font-light text-2xl">{expanded === cat ? '−' : '+'}</span>
            </button>
            {expanded === cat && (
              <div className="px-6 pb-6 space-y-4">
                {fixedDefinitions[cat].map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-left">
                    <div>
                        <p className="text-sm font-bold text-zinc-600">{item.name}</p>
                        <p className="text-[10px] font-bold text-zinc-400">€{item.amt}</p>
                    </div>
                    <button onClick={() => {
                        const up = fixedPaid.includes(item.id) ? fixedPaid.filter(x => x !== item.id) : [...fixedPaid, item.id];
                        setFixedPaid(up);
                        sync({fixedPaid: up});
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black transition-colors ${fixedPaid.includes(item.id) ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-400'}`}>
                      {fixedPaid.includes(item.id) ? 'PAID ✓' : 'PAY'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Variable Sections (RESTORED) */}
        {variableCategories.map(cat => (
          <div key={cat} className="bg-white rounded-[2rem] border border-zinc-100 overflow-hidden shadow-sm">
            <button onClick={() => setExpanded(expanded === cat ? null : cat)} className="w-full flex justify-between p-6 font-black text-zinc-800 items-center">
              <div className="text-left">
                  <p>{cat}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    €{variableExpenses.filter(e => e.category === cat).reduce((a, b) => a + b.amount, 0).toFixed(2)} Total
                  </p>
              </div>
              <span className="text-zinc-300 font-light text-2xl">{expanded === cat ? '−' : '+'}</span>
            </button>
            {expanded === cat && (
              <div className="px-6 pb-6 space-y-2 border-t border-zinc-50 pt-4 bg-zinc-50/30">
                {variableExpenses.filter(e => e.category === cat).map((exp) => (
                  <div key={exp.id} className="flex justify-between items-center text-left">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                           <p className="text-sm font-bold text-zinc-700">{exp.desc || 'Expense'}</p>
                           {exp.account && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${exp.account === 'KBC' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>{exp.account}</span>}
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium italic">€{exp.amount.toFixed(2)}</p>
                    </div>
                    <button onClick={() => deleteExpense(exp.id)} className="text-[10px] text-zinc-300 font-bold hover:text-rose-500 p-2">DELETE</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* DOCK */}
      <div className="fixed bottom-10 left-6 right-6 bg-zinc-900/95 backdrop-blur-xl rounded-[2.5rem] p-4 shadow-2xl z-50">
        <div className="flex justify-between items-center mb-4">
          <div className="bg-zinc-800 p-1 rounded-full flex gap-1">
            {(['Expense', 'Income'] as const).map(t => (
              <button key={t} onClick={() => setInputType(t)}
                className={`px-5 py-2 rounded-full text-[10px] font-black transition-all ${inputType === t ? 'bg-white text-zinc-900 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="bg-zinc-800 p-1 rounded-full flex gap-1">
            {(['KBC', 'TEB'] as const).map(a => (
              <button key={a} onClick={() => setAccount(a)}
                className={`px-4 py-2 rounded-full text-[10px] font-black transition-all ${account === a ? (a === 'KBC' ? 'bg-blue-600 text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg') : 'text-zinc-500 hover:text-zinc-300'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            placeholder="€"
            className="w-1/3 bg-zinc-800 rounded-2xl p-4 text-white font-black outline-none"
            value={newItem.amount}
            onChange={(e) => setNewItem({...newItem, amount: e.target.value})}
          />
          <select
            className="flex-1 bg-zinc-800 rounded-2xl p-4 text-white font-bold outline-none appearance-none text-center"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          >
            {inputType === 'Expense'
              ? variableCategories.map(c => <option key={c} value={c}>{c}</option>)
              : ['Blocked', 'Famiris', 'KYK', 'Other'].map(c => <option key={c} value={c}>{c}</option>)
            }
          </select>
          <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500 w-14 h-14 rounded-2xl text-white text-3xl font-light transition-transform active:scale-95">+</button>
        </div>

        <input
          placeholder="Add description..."
          className="w-full mt-2 bg-zinc-800 rounded-xl p-3 text-xs text-white outline-none border border-zinc-700"
          value={newItem.desc}
          onChange={(e) => setNewItem({...newItem, desc: e.target.value})}
        />
      </div>
    </main>
  );
}