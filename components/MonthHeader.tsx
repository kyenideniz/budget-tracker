"use client";

interface MonthHeaderProps {
  viewingMonth: string;
  activeMonth: string;
  isViewingHistory: boolean;
  loading: boolean;
  onNewMonth: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReturnToLive: () => void;
}

function monthLabel(monthId: string) {
  if (!monthId) return "Loading...";
  return new Date(monthId + "-01").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

export default function MonthHeader({
  viewingMonth,
  activeMonth,
  isViewingHistory,
  loading,
  onNewMonth,
  onPrevMonth,
  onNextMonth,
  onReturnToLive,
}: MonthHeaderProps) {
  const canGoNext = viewingMonth < activeMonth;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center">
        {/* Prev arrow */}
        <button
          onClick={onPrevMonth}
          disabled={loading || !viewingMonth}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 active:scale-90 transition-all disabled:opacity-30 text-lg"
          aria-label="Previous month"
        >
          ‹
        </button>

        {/* Month label + badge */}
        <div className="text-center flex-1 mx-2">
          <h2 className="font-black text-2xl text-zinc-800 tracking-tight leading-tight">
            {monthLabel(viewingMonth)}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Fiscal Period
            </p>
            {isViewingHistory && (
              <button
                onClick={onReturnToLive}
                className="text-[9px] font-black text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider hover:bg-blue-100 transition-colors"
              >
                ● LIVE
              </button>
            )}
          </div>
        </div>

        {/* Next arrow — only shows when in history */}
        {canGoNext ? (
          <button
            onClick={onNextMonth}
            disabled={loading}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 active:scale-90 transition-all disabled:opacity-30 text-lg"
            aria-label="Next month"
          >
            ›
          </button>
        ) : (
          /* New Month button when on active month */
          <button
            onClick={onNewMonth}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform disabled:opacity-40"
          >
            New +
          </button>
        )}
      </div>

      {/* History banner */}
      {isViewingHistory && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2 flex items-center justify-between">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
            Viewing history — read only
          </p>
          <button
            onClick={onReturnToLive}
            className="text-[10px] font-black text-amber-700 underline underline-offset-2"
          >
            Return to {monthLabel(activeMonth)}
          </button>
        </div>
      )}
    </div>
  );
}
