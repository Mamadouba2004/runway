// Balance-runway projection math.
//
// Amounts follow the Runway convention throughout (see lib/plaid/amount.ts):
// spending is negative, income is positive, so a point is just the running
// balance and every event is added to it.

export type IncomeMode = "internship" | "school";

export type DayPoint = {
  date: string; // YYYY-MM-DD
  balance: number;
  /** false once we leave recorded history and start projecting. */
  recorded: boolean;
};

export type RecurringCharge = {
  /** Negative for outflow, positive for inflow. */
  amount: number;
  dayOfMonth: number;
  label: string;
};

const DAY_MS = 86_400_000;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return toISODate(new Date(Date.parse(iso) + n * DAY_MS));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/**
 * Walk recorded transactions backwards from the known current balance to
 * recover the daily balance across the period we actually have data for.
 *
 * Plaid gives us today's balance and a list of transactions, not a historical
 * balance series — so the only honest way to draw the past is to unwind.
 */
export function reconstructHistory(
  currentBalance: number,
  txns: { date: string; amount: number }[]
): DayPoint[] {
  if (txns.length === 0) return [];

  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  const byDay = new Map<string, number>();
  for (const t of sorted) {
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  }

  const start = sorted[0].date;
  const end = sorted[sorted.length - 1].date;

  // Walk forward from an opening balance derived by unwinding the total.
  const net = sorted.reduce((s, t) => s + t.amount, 0);
  let running = currentBalance - net;

  const points: DayPoint[] = [];
  for (let iso = start; daysBetween(iso, end) >= 0; iso = addDays(iso, 1)) {
    running += byDay.get(iso) ?? 0;
    points.push({ date: iso, balance: running, recorded: true });
  }
  return points;
}

/**
 * Project forward from the last known balance.
 *
 * Two components, deliberately kept separate:
 *   - `charges` are dated events (subscriptions, the paycheck) applied on their
 *     day of the month, so the sawtooth around payday stays visible.
 *   - `dailyBurn` is the trailing average of everything else — the variable
 *     spending that never shows up as a named recurring stream but is most of
 *     where the money actually goes. Positive number, subtracted each day.
 *
 * Modelling only `charges` produced a line that climbed ~5x faster than the
 * account ever has, because groceries and takeout simply were not in it.
 */
export function project(
  from: DayPoint,
  charges: RecurringCharge[],
  days: number,
  dailyBurn = 0,
  /** Explicit payday dates with amounts — biweekly cannot be a day-of-month. */
  paydays: { date: string; amount: number }[] = []
): DayPoint[] {
  const payByDate = new Map(paydays.map((p) => [p.date, p.amount]));
  const points: DayPoint[] = [];
  let running = from.balance;

  for (let i = 1; i <= days; i++) {
    const iso = addDays(from.date, i);
    const dom = new Date(Date.parse(iso)).getUTCDate();

    running -= dailyBurn;
    for (const c of charges) {
      if (c.dayOfMonth === dom) running += c.amount;
    }
    running += payByDate.get(iso) ?? 0;

    points.push({ date: iso, balance: running, recorded: false });
  }
  return points;
}

export type Band = { date: string; low: number; high: number };

/**
 * Paychecks are not identical, so a single line overstates certainty. Running
 * the same projection at the observed low and high paycheck gives the range the
 * balance plausibly occupies, drawn as a band rather than implied precision.
 */
export function projectBand(
  from: DayPoint,
  charges: RecurringCharge[],
  days: number,
  dailyBurn: number,
  paydayDates: string[],
  lowAmount: number,
  highAmount: number
): Band[] {
  const low = project(from, charges, days, dailyBurn, paydayDates.map((date) => ({ date, amount: lowAmount })));
  const high = project(from, charges, days, dailyBurn, paydayDates.map((date) => ({ date, amount: highAmount })));
  return low.map((p, i) => ({ date: p.date, low: p.balance, high: high[i].balance }));
}

/**
 * Average daily spend over a trailing window, excluding anything already
 * modelled as a recurring charge — otherwise Netflix gets counted twice, once
 * as a dated charge and again inside the average.
 */
export function trailingDailyBurn(
  txns: { date: string; amount: number; name: string; isSpend: boolean }[],
  windowStart: string,
  windowDays: number,
  recurringNames: string[]
): number {
  const known = recurringNames.map((n) => n.toLowerCase());

  const variable = txns.filter((t) => {
    if (!t.isSpend || t.amount >= 0 || t.date < windowStart) return false;
    const name = t.name.toLowerCase();
    return !known.some((r) => r.length > 3 && name.includes(r));
  });

  const total = variable.reduce((s, t) => s + Math.abs(t.amount), 0);
  return windowDays > 0 ? total / windowDays : 0;
}

export function lowestPoint(points: DayPoint[]): DayPoint | null {
  if (points.length === 0) return null;
  return points.reduce((lo, p) => (p.balance < lo.balance ? p : lo));
}

/** First day the projection drops below the floor, if it ever does. */
export function firstBreach(points: DayPoint[], floor: number): DayPoint | null {
  return points.find((p) => p.balance < floor) ?? null;
}

/** Days until the next occurrence of `dayOfMonth`, counting from `today`. */
export function daysUntilDayOfMonth(today: string, dayOfMonth: number): number {
  const d = new Date(Date.parse(today));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();

  let next = new Date(Date.UTC(y, m, dayOfMonth));
  if (next.getTime() <= d.getTime()) next = new Date(Date.UTC(y, m + 1, dayOfMonth));

  return daysBetween(today, toISODate(next));
}
