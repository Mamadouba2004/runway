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
};

// Money moving between the user's own accounts is not spending. Counting it
// would double-charge the runway, and in the sandbox data it is the single
// largest "category" by volume.
export const NON_SPEND_CATEGORIES = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "BANK_FEES",
]);

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
