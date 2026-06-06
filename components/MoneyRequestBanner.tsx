"use client";

interface MoneyRequestBannerProps {
  requests: Array<{
    id: string;
    requesterName: string;
    amount: number;
    description: string;
  }>;
  onSettle: (requestId: string) => void;
}

export default function MoneyRequestBanner({
  requests,
  onSettle,
}: MoneyRequestBannerProps) {
  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top duration-500">
      {requests.map((req) => (
        <div
          key={req.id}
          className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-2xl p-4 shadow-sm transition-all duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            {/* Left: indicator + content */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Pulsing amber dot */}
              <span className="flex h-2.5 w-2.5 mt-1 flex-shrink-0 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-zinc-900 leading-snug">
                  💸 {req.requesterName} requested €{req.amount.toFixed(2)}
                </p>
                {req.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {req.description}
                  </p>
                )}
              </div>
            </div>

            {/* Settle button */}
            <button
              onClick={() => onSettle(req.id)}
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 active:scale-[0.97] text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md hover:shadow-amber-300/30 transition-all"
            >
              Mark as Paid ✓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
