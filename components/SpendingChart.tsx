"use client";
import { useState } from "react";
import { VARIABLE_CATEGORIES } from "@/lib/constants";
import { categoryColor } from "@/lib/utils";

interface SpendingChartProps {
  categoryTotals: Record<string, number>;
  variableTotal: number;
  hideBalance?: boolean;
}

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 58;
const STROKE = 20;

function describeArc(startAngle: number, endAngle: number) {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = CX + R * Math.cos(toRad(startAngle));
  const y1 = CY + R * Math.sin(toRad(startAngle));
  const x2 = CX + R * Math.cos(toRad(endAngle));
  const y2 = CY + R * Math.sin(toRad(endAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
}

export default function SpendingChart({
  categoryTotals,
  variableTotal,
  hideBalance = false,
}: SpendingChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const segments = VARIABLE_CATEGORIES
    .map((cat, i) => ({ cat, amount: categoryTotals[cat] || 0, color: categoryColor(i), idx: i }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (segments.length === 0) return null;

  // Build donut arcs
  let cursor = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.amount / variableTotal;
    const sweep = pct * 360;
    const arc = { ...seg, startAngle: cursor, endAngle: cursor + sweep, pct };
    cursor += sweep;
    return arc;
  });

  const hovered = hoveredIdx !== null ? arcs[hoveredIdx] : null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full bg-zinc-50 rounded-[2rem] border border-zinc-100 overflow-hidden shadow-sm outline-none"
      >
        <div className="flex justify-between items-center p-6 font-black text-zinc-800">
          <div className="text-left">
            <span>Spending Breakdown</span>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
              {hideBalance ? "***,**" : `€${variableTotal.toFixed(2)}`} variable total
            </p>
          </div>
          <span className="text-zinc-300 font-light text-2xl">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {/* Smooth CSS Grid rows height transition for the Spending Breakdown */}
      <div className={`grid transition-all duration-300 ease-in-out ${
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
      }`}>
        <div className="overflow-hidden">
          <div className="bg-zinc-50 border border-zinc-100 border-t-0 rounded-b-[2rem] px-6 pb-6 -mt-6 pt-8">
            {/* Donut Chart */}
            <div className="flex flex-col items-center mb-6 select-none">
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="overflow-visible"
              >
                {/* Background ring */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke="#e4e4e7"
                  strokeWidth={STROKE}
                />

                {/* Segments */}
                {arcs.map((arc, i) => {
                  const isHovered = hoveredIdx === i;
                  return (
                    <path
                      key={arc.cat}
                      d={describeArc(arc.startAngle, arc.endAngle)}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={isHovered ? STROKE + 4 : STROKE}
                      strokeLinecap="round"
                      style={{ transition: "stroke-width 0.15s ease, opacity 0.15s ease" }}
                      opacity={hoveredIdx !== null && !isHovered ? 0.35 : 1}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    />
                  );
                })}

                {/* Centre label */}
                <text
                  x={CX}
                  y={CY - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-black"
                  style={{ fontSize: 13, fill: hovered ? hovered.color : "#3f3f46", fontWeight: 900 }}
                >
                  {hovered ? `${(hovered.pct * 100).toFixed(0)}%` : "Split"}
                </text>
                <text
                  x={CX}
                  y={CY + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 700 }}
                >
                  {hovered ? (hideBalance ? "***" : `€${hovered.amount.toFixed(0)}`) : "by category"}
                </text>
              </svg>
            </div>

            {/* Category Bars */}
            <div className="space-y-3">
              {arcs.map((arc) => (
                <div key={arc.cat}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: arc.color }}
                      />
                      <span className="text-xs font-bold text-zinc-600">{arc.cat}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-zinc-700">
                        {hideBalance ? "***" : `€${arc.amount.toFixed(2)}`}
                      </span>
                      <span className="text-[10px] text-zinc-400 ml-1.5 select-none">
                        {(arc.pct * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Bar */}
                  <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${arc.pct * 100}%`,
                        backgroundColor: arc.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
