import { transactions } from "@/lib/db/schema";

export type Paycheck = { date: string; amount: number; name: string };

export type IncomeStats = {
  /** Paychecks matching this mode's source, most recent first. */
  paychecks: Paycheck[];
  count: number;
  mean: number;
  min: number;
  max: number;
  /** Median gap in days between consecutive paychecks; 0 when unknown. */
  medianGapDays: number;
  /** Hours x rate ceiling per paycheck, when both are configured. */
  cap: number | null;
  /**
   * How much to trust `mean`. One paycheck is a data point, not an average,
   * and the UI should not draw a spread band around it.
   */
  confidence: "none" | "low" | "medium" | "high";
};

/**
 * Not every INCOME row is a paycheck. Interest, tax refunds and brokerage
 * transfers all land in Plaid's INCOME category and would drag a naive average
 * badly — this account has $1,657 of tax refunds and $0.04 of interest sitting
 * in there.
 */
const NOT_PAYROLL = /interest|tax ?ref|treas 310|nysttaxrfd|fid bkg|moneyline/i;

export function isPayroll(name: string): boolean {
  return !NOT_PAYROLL.test(name);
}

export function incomeStats(
  txns: (typeof transactions.$inferSelect)[],
  sourcePattern: string | null,
  opts: { hourlyRate?: number | null; maxHoursPerWeek?: number | null; windowDays?: number } = {}
): IncomeStats {
  const cutoff = new Date(Date.now() - (opts.windowDays ?? 365) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const matches = txns
    .filter((t) => t.personalFinanceCategoryPrimary === "INCOME")
    .filter((t) => Number(t.amount) > 0)
    .filter((t) => isPayroll(t.name))
    .filter((t) => t.date >= cutoff)
    .filter((t) =>
      sourcePattern ? t.name.toLowerCase().includes(sourcePattern.toLowerCase()) : true
    )
    .map((t) => ({ date: t.date, amount: Number(t.amount), name: t.name }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const amounts = matches.map((m) => m.amount);
  const count = amounts.length;
  const mean = count > 0 ? amounts.reduce((s, a) => s + a, 0) / count : 0;

  const ascending = [...matches].reverse();
  const gaps: number[] = [];
  for (let i = 1; i < ascending.length; i++) {
    const g = Math.round(
      (Date.parse(ascending[i].date) - Date.parse(ascending[i - 1].date)) / 86_400_000
    );
    if (g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);

  const rate = opts.hourlyRate ?? null;
  const hours = opts.maxHoursPerWeek ?? null;

  return {
    paychecks: matches,
    count,
    mean,
    min: count > 0 ? Math.min(...amounts) : 0,
    max: count > 0 ? Math.max(...amounts) : 0,
    medianGapDays: gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0,
    // Biweekly means two weeks of hours per cheque.
    cap: rate !== null && hours !== null ? rate * hours * 2 : null,
    confidence: count === 0 ? "none" : count === 1 ? "low" : count < 5 ? "medium" : "high",
  };
}

/** Dates of the next `n` paychecks, from a biweekly anchor or a day-of-month. */
export function upcomingPaydays(
  from: string,
  cadence: string,
  anchorDate: string | null,
  dayOfMonth: number | null,
  n: number
): string[] {
  const out: string[] = [];
  const start = Date.parse(from);

  if (cadence === "biweekly" && anchorDate) {
    let t = Date.parse(anchorDate);
    // Walk the 14-day cycle forward until it passes `from`.
    while (t <= start) t += 14 * 86_400_000;
    for (let i = 0; i < n; i++) {
      out.push(new Date(t).toISOString().slice(0, 10));
      t += 14 * 86_400_000;
    }
    return out;
  }

  if (dayOfMonth) {
    const d = new Date(start);
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth();
    for (let i = 0; i < n; i++) {
      let next = Date.UTC(y, m, dayOfMonth);
      if (next <= start) {
        m += 1;
        next = Date.UTC(y, m, dayOfMonth);
      }
      out.push(new Date(next).toISOString().slice(0, 10));
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }
  return out;
}
