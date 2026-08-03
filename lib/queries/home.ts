import { asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  categoryCaps,
  people,
  plaidItems,
  subscriptions,
  transactions,
  transfers,
} from "@/lib/db/schema";
import { getIncomeModes, getSettings, type Mode } from "@/lib/db/config";
import {
  categoryColor,
  categoryName,
  isPersonTransfer,
  isSpendCategory,
  monthlyEquivalent,
} from "@/lib/categories";
import { incomeStats, upcomingPaydays } from "@/lib/income";
import { computeSetAside, isTransferToSavings } from "@/lib/savings";
import {
  addDays,
  daysBetween,
  firstBreach,
  lowestPoint,
  project,
  projectBand,
  reconstructHistory,
  trailingDailyBurn,
  toISODate,
  type DayPoint,
  type RecurringCharge,
} from "@/lib/runway";

export type Subscription = {
  name: string;
  amount: number; // negative (outflow), as actually charged
  monthlyAmount: number; // negative, normalised to per-month
  dayOfMonth: number;
  frequency: string;
  status: string;
  isActive: boolean;
};

export async function getHomeData() {
  const [settingsRow, modes, items] = await Promise.all([
    getSettings(),
    getIncomeModes(),
    db.select().from(plaidItems),
  ]);

  const connected = items.length > 0;
  const mode = (settingsRow.mode as Mode) ?? "internship";
  const floor = Number(settingsRow.floorAmount);
  const income = modes.find((m) => m.mode === mode);

  const [acctRows, txnRows, capRows, peopleRows, transferRows, subRows] =
    await Promise.all([
      db.select().from(accounts),
      db.select().from(transactions).orderBy(asc(transactions.date)),
      db.select().from(categoryCaps),
      db.select().from(people).orderBy(asc(people.id)),
      db.select().from(transfers).orderBy(asc(transfers.date)),
      db.select().from(subscriptions).orderBy(desc(subscriptions.averageAmount)),
    ]);

  const today = toISODate(new Date());

  // Only depository accounts hold spendable cash; credit/loan/investment
  // balances would badly distort the figures below.
  const depository = acctRows.filter((a) => a.type === "depository");
  const sumOf = (rows: typeof depository) =>
    rows.reduce((s, a) => s + Number(a.currentBalance ?? 0), 0);

  // Two different questions, deliberately on two different bases:
  //  - `balance` (combined) drives the runway. Chase auto-transfers between
  //    checking and savings for overdraft protection, so for "will I survive"
  //    they are one pool.
  //  - `safeToSpend` uses checking alone. "What can I spend right now" should
  //    not quietly hand you the savings account.
  const checkingBalance = sumOf(depository.filter((a) => a.subtype === "checking"));
  const savingsBalance = sumOf(depository.filter((a) => a.subtype !== "checking"));
  const balance = checkingBalance + savingsBalance;

  const subs: Subscription[] = subRows
    .filter((s) => !isPersonTransfer(s.name))
    .map((s) => ({
      name: s.name,
      amount: -Number(s.averageAmount),
      dayOfMonth: new Date(
        Date.parse(s.predictedNextDate ?? s.lastDate ?? today)
      ).getUTCDate(),
      frequency: s.frequency,
      status: s.status,
      isActive: s.isActive,
      monthlyAmount: -monthlyEquivalent(Number(s.averageAmount), s.frequency),
    }));

  // Normalised to per-month so an annual renewal is not billed twelve times.
  const scheduled = subs
    .filter((s) => s.isActive)
    .reduce((sum, x) => sum + Math.abs(x.monthlyAmount), 0);

  // --- Runway series ------------------------------------------------------
  // Savings is deliberately absent from every figure below. The runway models
  // checking alone, so transfers out to savings read as real outflows rather
  // than cancelling against a savings balance that is no longer counted.
  const checkingAccountIds = new Set(
    depository.filter((a) => a.subtype === "checking").map((a) => a.id)
  );
  const checkingTxns = txnRows.filter((t) => checkingAccountIds.has(t.accountId));

  const history = reconstructHistory(
    checkingBalance,
    checkingTxns.map((t) => ({ date: t.date, amount: Number(t.amount) }))
  );

  const charges: RecurringCharge[] = subs
    .filter((s) => s.isActive)
    .map((s) => ({ amount: s.monthlyAmount, dayOfMonth: s.dayOfMonth, label: s.name }));

  // Paychecks are no longer a day-of-month charge: both jobs pay biweekly, so
  // they come through as explicit dates instead.

  const anchor: DayPoint =
    history.length > 0
      ? history[history.length - 1]
      : { date: today, balance, recorded: true };

  // Burn is measured over 180 days: long enough to smooth a heavy month,
  // short enough to reflect current habits rather than two-year-old ones.
  const BURN_WINDOW_DAYS = 180;
  const burnStart = addDays(today, -BURN_WINDOW_DAYS);
  const dailyBurn = trailingDailyBurn(
    txnRows.map((t) => ({
      date: t.date,
      amount: Number(t.amount),
      name: t.name,
      isSpend: isSpendCategory(t.personalFinanceCategoryPrimary),
    })),
    burnStart,
    BURN_WINDOW_DAYS,
    subs.filter((s) => s.isActive).map((s) => s.name)
  );

  // Income, isolated to this mode's employer. A blended average over every
  // INCOME row would mix a job that ended in 2025 with tax refunds and $0.01
  // interest payments.
  const stats = incomeStats(txnRows, income?.sourcePattern ?? null, {
    hourlyRate: income?.hourlyRate ? Number(income.hourlyRate) : null,
    maxHoursPerWeek: income?.maxHoursPerWeek ? Number(income.maxHoursPerWeek) : null,
    windowDays: 365,
    cadence: income?.cadence ?? "biweekly",
  });

  // A manual override wins; otherwise project from what actually landed.
  const perPaycheck =
    income?.amountPerPaycheck !== null && income?.amountPerPaycheck !== undefined
      ? Number(income.amountPerPaycheck)
      : stats.projectable;

  const paydayDates = upcomingPaydays(
    anchor.date,
    income?.cadence ?? "biweekly",
    income?.payAnchorDate ?? null,
    income?.payDayOfMonth ?? null,
    14
  );

  const future = project(
    anchor,
    charges,
    180,
    dailyBurn,
    paydayDates.map((date) => ({ date, amount: perPaycheck }))
  );

  // Only draw a spread where there is a real spread to draw. One paycheck is a
  // data point, not a distribution.
  const band =
    stats.count >= 2
      ? projectBand(anchor, charges, 180, dailyBurn, paydayDates, stats.min, stats.max)
      : null;
  const series = [...history, ...future];
  const low = lowestPoint(future);
  const breach = firstBreach(future, floor);

  // --- Category limits ----------------------------------------------------
  const capByCategory = new Map(capRows.map((c) => [c.category, Number(c.capAmount)]));
  const spendByCategory = new Map<string, number>();

  // Caps are monthly, so only compare against the trailing 30 days.
  const windowStart = addDays(today, -30);
  for (const t of txnRows) {
    const primary = t.personalFinanceCategoryPrimary;
    if (!isSpendCategory(primary) || !primary) continue;
    if (t.date < windowStart) continue;
    const amt = Number(t.amount);
    if (amt >= 0) continue; // income, not spend
    spendByCategory.set(primary, (spendByCategory.get(primary) ?? 0) + -amt);
  }

  const categoryKeys = new Set([...spendByCategory.keys(), ...capByCategory.keys()]);
  const categories = [...categoryKeys]
    .map((key) => {
      const spent = spendByCategory.get(key) ?? null;
      const cap = capByCategory.get(key) ?? null;
      return {
        key,
        name: categoryName(key),
        color: categoryColor(key),
        cap,
        spent,
        pct: cap && spent !== null ? Math.min(spent / cap, 1) : null,
        over: cap !== null && spent !== null && spent > cap,
      };
    })
    .sort((a, b) => (b.spent ?? 0) - (a.spent ?? 0));

  // --- People -------------------------------------------------------------
  const peopleWithTransfers = peopleRows.map((p) => {
    const theirs = transferRows.filter((t) => t.personId === p.id);
    const sent = theirs
      .filter((t) => t.direction === "sent")
      .reduce((s, t) => s + Number(t.amount), 0);
    const received = theirs
      .filter((t) => t.direction === "received")
      .reduce((s, t) => s + Number(t.amount), 0);
    return {
      id: p.id,
      name: p.name,
      note: p.note,
      owed: sent - received,
      sent,
      received,
      imported: p.note === "from Zelle",
      transfers: theirs
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => ({
          id: t.id,
          date: t.date,
          amount: Number(t.amount),
          direction: t.direction,
          note: t.note,
        })),
    };
  })
    // The section is "money sent to people you support", so rank by net sent.
    // People who only ever sent money in sort to the bottom.
    .sort((a, b) => b.owed - a.owed);

  // The pay period runs from the previous payday; deposits landing in it are
  // what the set-aside rate applies to.
  const periodStart =
    [...paydayDates]
      .map((d) => d)
      .filter((d) => d <= today)
      .pop() ??
    upcomingPaydays(addDays(today, -60), income?.cadence ?? "biweekly", income?.payAnchorDate ?? null, income?.payDayOfMonth ?? null, 6)
      .filter((d) => d <= today)
      .pop() ??
    addDays(today, -14);

  const setAside = computeSetAside(
    txnRows,
    Number(settingsRow.savingsSetAsideRate),
    settingsRow.setAsideBasis === "observed" ? "observed" : "set",
    periodStart
  );

  const nextPayday = upcomingPaydays(
    today,
    income?.cadence ?? "biweekly",
    income?.payAnchorDate ?? null,
    income?.payDayOfMonth ?? null,
    1
  )[0] ?? null;
  const daysToPay = nextPayday ? daysBetween(today, nextPayday) : null;

  return {
    connected,
    mode,
    floor,
    balance,
    checkingBalance,
    savingsBalance,
    depositoryCount: depository.length,
    institutionName: items[0]?.institutionName ?? null,
    lastSyncedAt: items[0]?.lastSyncedAt?.toISOString() ?? null,
    safeToSpend: checkingBalance - scheduled - floor - setAside.pending,
    setAside,
    savingsMoved180d: txnRows
      .filter((t) => Number(t.amount) < 0 && isTransferToSavings(t.name))
      .filter((t) => t.date >= addDays(today, -180))
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
    scheduled,
    daysToPay,
    incomeAmount: perPaycheck,
    incomeStats: stats,
    incomeOverride: income?.amountPerPaycheck !== null && income?.amountPerPaycheck !== undefined,
    cadence: income?.cadence ?? "biweekly",
    nextPayday,
    payAnchorDate: income?.payAnchorDate ?? null,
    hourlyRate: income?.hourlyRate ? Number(income.hourlyRate) : null,
    maxHoursPerWeek: income?.maxHoursPerWeek ? Number(income.maxHoursPerWeek) : null,
    paydayDates,
    band,
    series,
    lastRecordedDate: history.length > 0 ? history[history.length - 1].date : null,
    firstRecordedDate: history.length > 0 ? history[0].date : null,
    low,
    breach,
    dailyBurn,
    monthlyBurn: dailyBurn * 30,
    observedMonthlyIncome:
      (stats.projectable * (income?.cadence === "monthly" ? 12 : 26)) / 12,
    categories,
    subscriptions: subs,
    subscriptionTotal: scheduled,
    people: peopleWithTransfers,
    transactionCount: txnRows.length,
  };
}

