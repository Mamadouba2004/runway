// Spending categories, keyed by Plaid's personal_finance_category.primary.
// Plaid marks the legacy `category` array deprecated and recommends
// personal_finance_category, so that is what we key on.
//
// Zelle transfers are deliberately NOT a spending category; they are
// tracked separately in the People section so they don't distort caps
// or the runway projection.

type CategoryMeta = { name: string; color: string };

const CATEGORIES: Record<string, CategoryMeta> = {
  FOOD_AND_DRINK: { name: "Food & drink", color: "var(--c-food)" },
  TRANSPORTATION: { name: "Transport", color: "var(--c-transport)" },
  GENERAL_MERCHANDISE: { name: "Shopping", color: "var(--c-shop)" },
  RENT_AND_UTILITIES: { name: "Rent & utilities", color: "var(--c-subs)" },
  TRAVEL: { name: "Travel", color: "var(--c-school)" },
  PERSONAL_CARE: { name: "Personal care", color: "var(--c-bnpl)" },
  ENTERTAINMENT: { name: "Entertainment", color: "var(--c-subs)" },
  GENERAL_SERVICES: { name: "Services", color: "var(--c-transport)" },
  MEDICAL: { name: "Medical", color: "var(--c-shop)" },
  EDUCATION: { name: "Education", color: "var(--c-school)" },
  LOAN_PAYMENTS: { name: "Loan payments", color: "var(--c-bnpl)" },
  // Present in real Chase data; absent from the sandbox fixture set.
  GOVERNMENT_AND_NON_PROFIT: { name: "Government & donations", color: "var(--c-school)" },
  HOME_IMPROVEMENT: { name: "Home", color: "var(--c-shop)" },
  OTHER: { name: "Uncategorized", color: "var(--c-transport)" },
};

// Money moving between the user's own accounts is not spending. Counting it
// would double-charge the runway, and in the sandbox data it is the single
// largest "category" by volume.
export const NON_SPEND_CATEGORIES = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "BANK_FEES",
  // Paychecks and deposits are the opposite of spending — counting them as a
  // category would put a $0.00 "Income" row next to the real spend rows.
  "INCOME",
]);

/**
 * Zelle and friends move money to people, not merchants. Plaid's recurring
 * detection legitimately flags a standing Zelle as a monthly stream, but
 * counting it as a subscription would both mislabel it and pull it into the
 * runway projection — the exact distortion the People section exists to avoid.
 */
export function isPersonTransfer(description: string): boolean {
  return /\b(zelle|venmo|cash ?app|paypal)\b/i.test(description);
}

/**
 * Plaid reports the stream's own cadence, but the Subscriptions total and the
 * runway both need a per-month figure. Charging an annual $17.41 renewal every
 * month overstated the fixed load by $15.96/mo here.
 */
const PER_MONTH: Record<string, number> = {
  WEEKLY: 4.33,
  BIWEEKLY: 2.17,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
};

export function monthlyEquivalent(amount: number, frequency: string): number {
  // UNKNOWN keeps its face value: assuming a cadence we were not given would
  // be inventing data. It is flagged in the UI instead.
  return amount * (PER_MONTH[frequency] ?? 1);
}

export function isMonthlyCadence(frequency: string): boolean {
  return frequency === "MONTHLY";
}

export function isSpendCategory(primary: string | null): boolean {
  if (!primary) return false;
  return !NON_SPEND_CATEGORIES.has(primary);
}

export function categoryName(primary: string): string {
  return (
    CATEGORIES[primary]?.name ??
    primary
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function categoryColor(primary: string): string {
  return CATEGORIES[primary]?.color ?? "var(--c-transport)";
}
