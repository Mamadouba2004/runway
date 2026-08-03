import type { transactions } from "@/lib/db/schema";
import { isPayroll } from "@/lib/income";

type Txn = typeof transactions.$inferSelect;

/**
 * Chase writes these as "Online Transfer to SAV ...8117". Matching on the
 * description rather than the account id keeps this working if the savings
 * account is ever un-linked.
 */
export function isTransferToSavings(name: string): boolean {
  return /online transfer to sav|transfer to sav\b/i.test(name);
}

/** Round-ups are not saving. Below this they are noise in the rate. */
const MIN_MEANINGFUL_TRANSFER = 20;

export type SetAside = {
  /** Fraction of each deposit treated as spoken-for. */
  rate: number;
  /** Rate implied by transfers that actually happened. */
  observedRate: number | null;
  /** Money already committed to savings but not yet moved out of checking. */
  pending: number;
  /** Deposits in the current pay period that the rate was applied to. */
  depositsThisPeriod: number;
  /** Transfers already made this period, which reduce what is still pending. */
  transferredThisPeriod: number;
  periodStart: string;
};

/**
 * The core of the model: a deposit is partly spoken-for the moment it lands,
 * before any transfer posts. Anything already moved this period reduces what
 * remains outstanding, so the figure does not double-count.
 */
export function computeSetAside(
  txns: Txn[],
  setRate: number,
  basis: "set" | "observed",
  periodStart: string,
  observedWindowDays = 180
): SetAside {
  const windowStart = new Date(Date.now() - observedWindowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const depositsIn = (from: string) =>
    txns
      .filter((t) => t.date >= from)
      .filter((t) => t.personalFinanceCategoryPrimary === "INCOME")
      .filter((t) => Number(t.amount) > 0)
      .filter((t) => isPayroll(t.name));

  const transfersIn = (from: string, minAmount = 0) =>
    txns
      .filter((t) => t.date >= from)
      .filter((t) => Number(t.amount) < 0)
      .filter((t) => isTransferToSavings(t.name))
      .filter((t) => Math.abs(Number(t.amount)) >= minAmount);

  const windowDeposits = depositsIn(windowStart).reduce((s, t) => s + Number(t.amount), 0);
  const windowTransfers = transfersIn(windowStart, MIN_MEANINGFUL_TRANSFER).reduce(
    (s, t) => s + Math.abs(Number(t.amount)),
    0
  );

  const observedRate =
    windowDeposits > 0 ? Math.min(windowTransfers / windowDeposits, 1) : null;

  const rate = basis === "observed" && observedRate !== null ? observedRate : setRate;

  const depositsThisPeriod = depositsIn(periodStart).reduce(
    (s, t) => s + Number(t.amount),
    0
  );
  const transferredThisPeriod = transfersIn(periodStart).reduce(
    (s, t) => s + Math.abs(Number(t.amount)),
    0
  );

  // Never negative: moving more than the rate requires does not create
  // spendable money, it just means this period's obligation is met.
  const pending = Math.max(0, depositsThisPeriod * rate - transferredThisPeriod);

  return {
    rate,
    observedRate,
    pending,
    depositsThisPeriod,
    transferredThisPeriod,
    periodStart,
  };
}
