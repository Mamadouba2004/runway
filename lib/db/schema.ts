import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

// Not yet implemented: subscriptions (read live from Plaid's
// /transactions/recurring/get instead of a local table), milestones.

// One row per Plaid Item (one bank login connection). `cursor` drives
// /transactions/sync — null means "never synced, pull full history".
export const plaidItems = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  // Plaid pushes SYNC_UPDATES_AVAILABLE here when Chase has new data.
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => plaidItems.id, { onDelete: "cascade" }),
  plaidAccountId: text("plaid_account_id").notNull().unique(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  mask: text("mask"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
  isoCurrencyCode: text("iso_currency_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  plaidTransactionId: text("plaid_transaction_id").notNull().unique(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  isoCurrencyCode: text("iso_currency_code"),
  // For pending transactions this is when it occurred; for posted, when it
  // settled. `authorizedDate` is when the user actually made the purchase.
  date: date("date").notNull(),
  authorizedDate: date("authorized_date"),
  name: text("name").notNull(),
  merchantName: text("merchant_name"),
  pending: boolean("pending").notNull().default(false),
  paymentChannel: text("payment_channel"),
  personalFinanceCategoryPrimary: text("pfc_primary"),
  personalFinanceCategoryDetailed: text("pfc_detailed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Cached from Plaid's /transactions/recurring/get during sync. Read live on
// every page render and Plaid rate-limits (429) almost immediately, so the
// streams are persisted here and refreshed on the same cadence as transactions.
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => plaidItems.id, { onDelete: "cascade" }),
  streamId: text("stream_id").notNull().unique(),
  name: text("name").notNull(),
  averageAmount: numeric("average_amount", { precision: 14, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(),
  status: text("status").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  predictedNextDate: date("predicted_next_date"),
  lastDate: date("last_date"),
});

// --- User configuration -----------------------------------------------------
// These are deliberately NOT derived from Plaid. The floor and the pay schedule
// are things the user decides; waiting for Plaid to reveal them would leave the
// summary bar empty forever (sandbox has no paycheck stream at all).

// Single-row table. `id` is pinned to 1 so upserts stay trivial.
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  mode: text("mode").notNull().default("internship"),
  floorAmount: numeric("floor_amount", { precision: 14, scale: 2 })
    .notNull()
    .default("100.00"),
  // Fraction of every deposit treated as spoken-for the moment it lands,
  // before any transfer actually posts. Simple Bank's Goals worked this way.
  savingsSetAsideRate: numeric("savings_set_aside_rate", { precision: 5, scale: 4 })
    .notNull()
    .default("0.3500"),
  // "set" uses the rate above; "observed" derives it from detected transfers.
  setAsideBasis: text("set_aside_basis").notNull().default("set"),
});

// Income is per-mode because the employer changes with the mode: work-study
// during school, a research-foundation stipend during the internship. A single
// blended average across all INCOME rows would mix a job that ended 16 months
// ago with the current one, plus tax refunds and interest.
export const incomeModes = pgTable("income_modes", {
  mode: text("mode").primaryKey(),
  // Manual override. Null means "use the observed average for this source".
  amountPerPaycheck: numeric("amount_per_paycheck", { precision: 14, scale: 2 }),
  // "biweekly" anchors on payAnchorDate; "monthly" on payDayOfMonth.
  cadence: text("cadence").notNull().default("biweekly"),
  payAnchorDate: date("pay_anchor_date"),
  payDayOfMonth: integer("pay_day_of_month"),
  // Substring matched against the transaction description to isolate this
  // mode's paychecks from every other kind of deposit.
  sourcePattern: text("source_pattern"),
  hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }),
  maxHoursPerWeek: numeric("max_hours_per_week", { precision: 5, scale: 2 }),
});

export const categoryCaps = pgTable("category_caps", {
  // Plaid personal_finance_category.primary, e.g. FOOD_AND_DRINK.
  category: text("category").primaryKey(),
  capAmount: numeric("cap_amount", { precision: 14, scale: 2 }).notNull(),
});

// --- People ----------------------------------------------------------------
// Seeded from real Zelle transactions (Chase does surface them, contrary to an
// earlier assumption here), with manual entry kept for anything that does not
// parse to a clean name. Kept out of spending categories so they don't distort
// caps or the runway.

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  // Set when the row was imported from a Plaid transaction rather than typed
  // in. Unique, so re-running the Zelle import is idempotent. Null for manual
  // entries, which is why it is nullable rather than part of the key.
  sourceTransactionId: text("source_transaction_id").unique(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  // "sent" = money went to them, "received" = money came from them.
  direction: text("direction").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
