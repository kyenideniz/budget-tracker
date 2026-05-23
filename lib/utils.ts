/** Formats a number as a Euro currency string, e.g. €1,234.56 */
export function formatCurrency(value: number): string {
  return `€${value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Formats a number compactly for tight spaces, e.g. €1.2K */
export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `€${(value / 1000).toFixed(1)}K`;
  }
  return `€${value.toFixed(0)}`;
}

/** Clamps a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Returns a CSS hsl color string for a category index, cycling through a pleasant palette. */
const PALETTE = [
  "210 80% 60%",   // blue
  "160 60% 50%",   // teal
  "280 60% 65%",   // purple
  "35 90% 58%",    // amber
  "350 70% 60%",   // rose
  "190 70% 52%",   // cyan
  "120 40% 55%",   // muted green
];

export function categoryColor(index: number): string {
  return `hsl(${PALETTE[index % PALETTE.length]})`;
}
