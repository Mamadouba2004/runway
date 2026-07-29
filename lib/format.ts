const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function money(n: number): string {
  return USD.format(n);
}

export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Dates are stored as YYYY-MM-DD; parse as UTC so they don't shift a day. */
export function shortDate(iso: string): string {
  const d = new Date(Date.parse(iso));
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function monthLabel(iso: string): string {
  return MONTH[new Date(Date.parse(iso)).getUTCMonth()];
}
