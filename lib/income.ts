import { transactions } from "@/lib/db/schema";

export type Paycheck = { date: string; amount: number; name: string };

export type IncomeStats = {
  /**
   * Per-paycheck figure the projection should actually use. Equals `mean` once
   * there are enough paychecks from this employer to annualise; below that it
   * falls back to observed payroll across all employers, because annualising a
   * single cheque at 26/year invents money that has never landed.
   */
  projectable: number;
  /** True when `projectable` came from the fallback rather than this source. */
  usingFallback: boolean;
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

/**
 * Plaid already classifies deposits: INCOME_SALARY and INCOME_CONTRACTOR are
 * earnings, INCOME_TAX_REFUND and INCOME_INTEREST_EARNED are not. Prefer that
 * over guessing from the description; fall back to the name only when the
 * detailed category is missing.
 */
const PAYROLL_DETAILED = new Set(["INCOME_SALARY", "INCOME_CONTRACTOR", "INCOME_WAGES"]);

export function isPayrollTxn(detailed: string | null, name: string): boolean {
  if (detailed) return PAYROLL_DETAILED.has(detailed);
  return !NOT_PAYROLL.test(name);
}

/** Name-only check, kept for callers without the detailed category to hand. */
export function isPayroll(name: string): boolean {
  return !NOT_PAYROLL.test(name);
}

/** Paychecks per year for a cadence, used to annualise a per-cheque figure. */
export function paychecksPerYear(cadence: string): number {
  return cadence === "monthly" ? 12 : 26;
}

export function incomeStats(
  txns: (typeof transactions.$inferSelect)[],
  sourcePattern: string | null,
  opts: {
    hourlyRate?: number | null;
    maxHoursPerWeek?: number | null;
    windowDays?: number;
    cadence?: string;
  } = {}
): IncomeStats {
  const cutoff = new Date(Date.now() - (opts.windowDays ?? 365) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const matches = txns
    .filter((t) => t.personalFinanceCategoryPrimary === "INCOME")
    .filter((t) => Number(t.amount) > 0)
    .filter((t) => isPayrollTxn(t.personalFinanceCategoryDetailed, t.name))
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

  // Below this, one unusual cheque moves the annualised figure by thousands.
  const MIN_SAMPLE_TO_ANNUALISE = 3;
  const perYear = paychecksPerYear(opts.cadence ?? "biweekly");

  // Fallback only when THIS source has produced nothing at all. Blending other
  // employers was worse than a small sample: it averaged a live $990.26 job
  // against a work-study job that had already ended, and produced $218.81.
  // One paycheck from the current employer is the best available estimate of
  // the next one from that employer; the honest problem with n=1 is confidence,
  // not the point estimate, so that is surfaced rather than silently corrected.
  const RECENT_EMPLOYMENT_DAYS = 90;
  const recentWindow = new Date(Date.now() - RECENT_EMPLOYMENT_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const recentPayroll = txns
    .filter((t) => t.personalFinanceCategoryPrimary === "INCOME")
    .filter((t) => Number(t.amount) > 0)
    .filter((t) => isPayrollTxn(t.personalFinanceCategoryDetailed, t.name))
    .filter((t) => t.date >= recentWindow);
  const fallbackPerPaycheck =
    recentPayroll.length > 0
      ? (recentPayroll.reduce((s, t) => s + Number(t.amount), 0) /
          (RECENT_EMPLOYMENT_DAYS / 30)) *
        (12 / perYear)
      : 0;

  const useFallback = count === 0;

  return {
    projectable: useFallback ? fallbackPerPaycheck : mean,
    usingFallback: useFallback,
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
