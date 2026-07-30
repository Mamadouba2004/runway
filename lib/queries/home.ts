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
} from "@/lib/categories";
import {
  addDays,
  daysUntilDayOfMonth,
  firstBreach,
  lowestPoint,
  project,
  reconstructHistory,
  trailingDailyBurn,
  toISODate,
  type DayPoint,
  type RecurringCharge,
} from "@/lib/runway";

export type Subscription = {
  name: string;
  amount: number; // negative (outflow)
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
    }));

  const scheduled = subs
    .filter((s) => s.isActive)
    .reduce((sum, x) => sum + Math.abs(x.amount), 0);

  // --- Runway series ------------------------------------------------------
  const history = reconstructHistory(
    balance,
    txnRows.map((t) => ({ date: t.date, amount: Number(t.amount) }))
  );

  const charges: RecurringCharge[] = subs
    .filter((s) => s.isActive)
    .map((s) => ({ amount: s.amount, dayOfMonth: s.dayOfMonth, label: s.name }));

  if (income) {
    charges.push({
      amount: Number(income.amountPerPaycheck),
      dayOfMonth: income.payDayOfMonth,
      label: `${mode} paycheck`,
    });
  }

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

  // What actually landed as income over the same window, for comparison
  // against the configured paycheck figure.
  const observedIncome =
    txnRows
      .filter((t) => t.date >= burnStart && t.personalFinanceCategoryPrimary === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0) / (BURN_WINDOW_DAYS / 30);

  const future = project(anchor, charges, 180, dailyBurn);
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

  const daysToPay = income ? daysUntilDayOfMonth(today, income.payDayOfMonth) : null;

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
    safeToSpend: checkingBalance - scheduled - floor,
    scheduled,
    daysToPay,
    incomeAmount: income ? Number(income.amountPerPaycheck) : null,
    payDayOfMonth: income?.payDayOfMonth ?? null,
    series,
    lastRecordedDate: history.length > 0 ? history[history.length - 1].date : null,
    firstRecordedDate: history.length > 0 ? history[0].date : null,
    low,
    breach,
    dailyBurn,
    monthlyBurn: dailyBurn * 30,
    observedMonthlyIncome: observedIncome,
    categories,
    subscriptions: subs,
    subscriptionTotal: scheduled,
    people: peopleWithTransfers,
    transactionCount: txnRows.length,
  };
}

