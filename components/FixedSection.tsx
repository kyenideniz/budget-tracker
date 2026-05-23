"use client";
import { type FixedItem } from "@/lib/constants";

interface FixedSectionProps {
  fixedDefinitions: Record<string, FixedItem[]>;
  fixedPaid: string[];
  expanded: string | null;
  onToggle: (cat: string) => void;
  onTogglePaid: (itemId: string) => void;
}

export default function FixedSection({
  fixedDefinitions,
  fixedPaid,
  expanded,
  onToggle,
  onTogglePaid,
}: FixedSectionProps) {
  return (
    <>
      {Object.entries(fixedDefinitions).map(([cat, items]) => {
        const catTotal = items.reduce((a, b) => a + b.amt, 0);
        const paidCount = items.filter((i) => fixedPaid.includes(i.id)).length;
        const allPaid = paidCount === items.length;

        return (
          <div
            key={cat}
            className="bg-zinc-50 rounded-[2rem] border border-zinc-100 overflow-hidden shadow-sm mb-3"
          >
            <button
              onClick={() => onToggle(cat)}
              className="w-full flex justify-between p-6 font-black text-zinc-800 items-center"
            >
              <div className="text-left">
                <span>{cat}</span>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                  €{catTotal.toFixed(2)} •{" "}
                  <span className={allPaid ? "text-emerald-500" : "text-zinc-400"}>
                    {paidCount}/{items.length} paid
                  </span>
                </p>
              </div>
              <span className="text-zinc-300 font-light text-2xl">
                {expanded === cat ? "−" : "+"}
              </span>
            </button>

            <div className={`grid transition-all duration-300 ease-in-out ${
              expanded === cat ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}>
              <div className="overflow-hidden">
                <div className="px-6 pb-6 space-y-4 pt-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-left">
                      <div>
                        <p className="text-sm font-bold text-zinc-600">{item.name}</p>
                        <p className="text-[10px] font-bold text-zinc-400">€{item.amt}</p>
                      </div>
                      <button
                        onClick={() => onTogglePaid(item.id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-colors ${
                          fixedPaid.includes(item.id)
                            ? "bg-emerald-500 text-white"
                            : "bg-zinc-200 text-zinc-400"
                        }`}
                      >
                        {fixedPaid.includes(item.id) ? "PAID ✓" : "PAY"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
