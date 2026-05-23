"use client";
import { useState } from "react";
import { type UserProfile } from "@/hooks/useUserProfile";
import { type FixedItem, DEFAULT_FIXED_EXPENSES } from "@/lib/constants";

interface SetupWizardProps {
  uid: string;
  onComplete: (profile: UserProfile) => void;
}

const ACCOUNT_COLORS = [
  "bg-blue-500/10 border-blue-500/30 text-blue-600",
  "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
  "bg-violet-500/10 border-violet-500/30 text-violet-600",
  "bg-orange-500/10 border-orange-500/30 text-orange-600",
];

type Step = "name" | "accounts" | "fixed" | "legacy";
const ALL_STEPS: Step[] = ["name", "accounts", "fixed", "legacy"];

// ── Small editable fixed-item row ──────────────────────────────────────────
function FixedItemRow({
  item,
  onChange,
  onRemove,
  canRemove,
}: {
  item: FixedItem;
  onChange: (updated: FixedItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        placeholder="Name"
        className="flex-1 bg-zinc-100 rounded-xl px-3 py-2.5 text-sm text-zinc-900 font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 transition-all"
      />
      <div className="relative w-24">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-bold pointer-events-none">€</span>
        <input
          type="text"
          inputMode="decimal"
          value={item.amt === 0 ? "" : String(item.amt)}
          onChange={(e) => {
            const raw = e.target.value.replace(",", ".");
            const n = parseFloat(raw);
            onChange({ ...item, amt: isNaN(n) ? 0 : n });
          }}
          placeholder="0"
          className="w-full bg-zinc-100 rounded-xl pl-7 pr-3 py-2.5 text-sm text-zinc-900 font-bold tabular-nums outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 transition-all"
        />
      </div>
      {canRemove && (
        <button
          onClick={onRemove}
          className="w-8 h-9 flex items-center justify-center text-zinc-400 hover:text-rose-500 transition-colors text-lg rounded-xl hover:bg-rose-50 active:scale-95"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function SetupWizard({ uid, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState("");
  const [accounts, setAccounts] = useState<string[]>(["KBC"]);
  const [newAccount, setNewAccount] = useState("");

  // Fixed expenses — pre-filled with sensible defaults so the user just tweaks amounts
  const [housingItems, setHousingItems] = useState<FixedItem[]>(
    DEFAULT_FIXED_EXPENSES.housing.map((i) => ({ ...i }))
  );
  const [subItems, setSubItems] = useState<FixedItem[]>(
    DEFAULT_FIXED_EXPENSES.subscriptions.map((i) => ({ ...i }))
  );

  const [legacyChoice, setLegacyChoice] = useState<"yes" | "no" | null>(null);
  const [legacyPath, setLegacyPath] = useState("kerem-efe");
  const [saving, setSaving] = useState(false);

  // ── Account helpers ──────────────────────────────────────────────────────
  const addAccount = () => {
    const name = newAccount.trim().toUpperCase();
    if (!name || accounts.includes(name) || accounts.length >= 4) return;
    setAccounts((prev) => [...prev, name]);
    setNewAccount("");
  };
  const removeAccount = (name: string) => {
    if (accounts.length <= 1) return;
    setAccounts((prev) => prev.filter((a) => a !== name));
  };

  // ── Housing helpers ──────────────────────────────────────────────────────
  const updateHousingItem = (idx: number, updated: FixedItem) =>
    setHousingItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  const removeHousingItem = (idx: number) =>
    setHousingItems((prev) => prev.filter((_, i) => i !== idx));
  const addHousingItem = () =>
    setHousingItems((prev) => [
      ...prev,
      { id: `housing-${Date.now()}`, name: "", amt: 0 },
    ]);

  // ── Subscription helpers ─────────────────────────────────────────────────
  const updateSubItem = (idx: number, updated: FixedItem) =>
    setSubItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  const removeSubItem = (idx: number) =>
    setSubItems((prev) => prev.filter((_, i) => i !== idx));
  const addSubItem = () =>
    setSubItems((prev) => [
      ...prev,
      { id: `sub-${Date.now()}`, name: "", amt: 0 },
    ]);

  const stepIndex = ALL_STEPS.indexOf(step);

  const handleFinish = async () => {
    setSaving(true);
    const profile: UserProfile = {
      displayName: displayName.trim(),
      accounts,
      fixedExpenses: {
        housing: housingItems.filter((i) => i.name.trim()),
        subscriptions: subItems.filter((i) => i.name.trim()),
      },
      ...(legacyChoice === "yes" && legacyPath.trim()
        ? { dataPath: legacyPath.trim() }
        : {}),
    };
    onComplete(profile);
  };

  const housingTotal = housingItems.reduce((s, i) => s + i.amt, 0);
  const subTotal = subItems.reduce((s, i) => s + i.amt, 0);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-zinc-900 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-2xl">✨</span>
          </div>
          <h1 className="text-xl font-black text-zinc-900 tracking-tight">Welcome!</h1>
          <p className="text-zinc-400 text-xs font-medium mt-1">Let&apos;s set up your account</p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {ALL_STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                step === s
                  ? "w-8 bg-zinc-900"
                  : stepIndex > i
                  ? "w-4 bg-zinc-400"
                  : "w-4 bg-zinc-200"
              }`}
            />
          ))}
        </div>

        {/* ── STEP 1: Name ── */}
        {step === "name" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                Your name
              </label>
              <input
                id="setup-name"
                type="text"
                autoFocus
                placeholder="e.g. Kerem"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && displayName.trim() && setStep("accounts")}
                className="w-full bg-zinc-100 rounded-2xl px-5 py-4 text-base text-zinc-900 font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 transition-all"
              />
            </div>
            <button
              id="setup-name-next"
              onClick={() => setStep("accounts")}
              disabled={!displayName.trim()}
              className="w-full bg-zinc-900 text-white font-black text-sm rounded-2xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Bank Accounts ── */}
        {step === "accounts" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                Your bank accounts
              </label>
              <p className="text-zinc-400 text-xs mb-4">
                Add the accounts you want to track. Fixed costs are deducted from the first account.
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {accounts.map((acc, i) => (
                  <div
                    key={acc}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black ${ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}`}
                  >
                    {i === 0 && <span className="text-[9px] opacity-60">PRIMARY</span>}
                    {acc}
                    {accounts.length > 1 && (
                      <button
                        onClick={() => removeAccount(acc)}
                        className="opacity-60 hover:opacity-100 transition-opacity text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {accounts.length < 4 && (
                <div className="flex gap-2">
                  <input
                    id="setup-account-input"
                    type="text"
                    placeholder="Account name (e.g. Revolut)"
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAccount()}
                    className="flex-1 bg-zinc-100 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/20 transition-all"
                  />
                  <button
                    id="setup-account-add"
                    onClick={addAccount}
                    disabled={!newAccount.trim() || accounts.length >= 4}
                    className="bg-zinc-900 text-white text-sm font-black px-4 py-3 rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("name")}
                className="flex-1 bg-zinc-100 text-zinc-600 font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
              >
                ← Back
              </button>
              <button
                id="setup-accounts-next"
                onClick={() => setStep("fixed")}
                disabled={accounts.length === 0}
                className="flex-[2] bg-zinc-900 text-white font-black text-sm rounded-2xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Fixed Expenses ── */}
        {step === "fixed" && (
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">
                Fixed Monthly Expenses
              </label>
              <p className="text-zinc-400 text-xs mb-4">
                These are deducted automatically each month. Edit, remove, or add your own.
              </p>

              {/* Housing */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    🏠 Housing
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">
                    €{housingTotal.toFixed(2)}/mo
                  </span>
                </div>
                <div className="space-y-2">
                  {housingItems.map((item, idx) => (
                    <FixedItemRow
                      key={item.id}
                      item={item}
                      onChange={(u) => updateHousingItem(idx, u)}
                      onRemove={() => removeHousingItem(idx)}
                      canRemove={housingItems.length > 1}
                    />
                  ))}
                </div>
                <button
                  onClick={addHousingItem}
                  className="mt-2 w-full py-2 rounded-xl border-2 border-dashed border-zinc-200 text-zinc-400 text-xs font-black hover:border-zinc-400 hover:text-zinc-600 transition-all active:scale-[0.98]"
                >
                  + Add Housing Item
                </button>
              </div>

              {/* Subscriptions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    📱 Subscriptions
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400">
                    €{subTotal.toFixed(2)}/mo
                  </span>
                </div>
                <div className="space-y-2">
                  {subItems.map((item, idx) => (
                    <FixedItemRow
                      key={item.id}
                      item={item}
                      onChange={(u) => updateSubItem(idx, u)}
                      onRemove={() => removeSubItem(idx)}
                      canRemove={subItems.length > 1}
                    />
                  ))}
                </div>
                <button
                  onClick={addSubItem}
                  className="mt-2 w-full py-2 rounded-xl border-2 border-dashed border-zinc-200 text-zinc-400 text-xs font-black hover:border-zinc-400 hover:text-zinc-600 transition-all active:scale-[0.98]"
                >
                  + Add Subscription
                </button>
              </div>

              {/* Total summary */}
              <div className="mt-4 bg-zinc-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Total Fixed</span>
                <span className="text-sm font-black text-zinc-900">
                  €{(housingTotal + subTotal).toFixed(2)}<span className="text-zinc-400 font-medium text-xs">/mo</span>
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("accounts")}
                className="flex-1 bg-zinc-100 text-zinc-600 font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
              >
                ← Back
              </button>
              <button
                id="setup-fixed-next"
                onClick={() => setStep("legacy")}
                className="flex-[2] bg-zinc-900 text-white font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Existing data? ── */}
        {step === "legacy" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                Do you have existing data?
              </label>
              <p className="text-zinc-400 text-xs mb-4">
                If you were using this app before, we can link your existing data without touching it.
              </p>

              <div className="flex gap-3 mb-4">
                <button
                  id="setup-legacy-yes"
                  onClick={() => setLegacyChoice("yes")}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black border-2 transition-all ${
                    legacyChoice === "yes"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-500"
                  }`}
                >
                  Yes, link it
                </button>
                <button
                  id="setup-legacy-no"
                  onClick={() => setLegacyChoice("no")}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black border-2 transition-all ${
                    legacyChoice === "no"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-500"
                  }`}
                >
                  No, start fresh
                </button>
              </div>

              {legacyChoice === "yes" && (
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                    Your legacy data ID
                  </label>
                  <input
                    id="setup-legacy-path"
                    type="text"
                    value={legacyPath}
                    onChange={(e) => setLegacyPath(e.target.value)}
                    className="w-full bg-zinc-100 rounded-xl px-4 py-3 text-sm text-zinc-900 font-mono outline-none focus:ring-2 focus:ring-zinc-900/20 transition-all"
                  />
                  <p className="text-zinc-400 text-[10px] mt-1.5">
                    This is the ID your data was stored under. Default is &quot;kerem-efe&quot;.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("fixed")}
                className="flex-1 bg-zinc-100 text-zinc-600 font-black text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
              >
                ← Back
              </button>
              <button
                id="setup-finish"
                onClick={handleFinish}
                disabled={legacyChoice === null || saving}
                className="flex-[2] bg-zinc-900 text-white font-black text-sm rounded-2xl py-4 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving ? "Saving…" : "Finish Setup ✓"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
