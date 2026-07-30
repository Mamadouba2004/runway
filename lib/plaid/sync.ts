import { eq, inArray, sql } from "drizzle-orm";
import type { Transaction } from "plaid";
import { db } from "@/lib/db";
import { accounts, plaidItems, subscriptions, transactions } from "@/lib/db/schema";
import { plaidClient } from "@/lib/plaid/client";
import { upsertAccounts } from "@/lib/plaid/items";
import { plaidAmountToBalanceDelta } from "@/lib/plaid/amount";
import { decryptSecret } from "@/lib/crypto";
import { importZelleTransfers } from "@/lib/people/zelle";

export type SyncResult = {
  itemId: string;
  added: number;
  modified: number;
  removed: number;
};

// /transactions/sync is cursor-based: each call returns only what changed
// since the last cursor, capped at `count` per page. A null cursor means
// "never synced" and pulls the Item's full history, one page at a time.
export async function syncTransactionsForItem(item: typeof plaidItems.$inferSelect): Promise<SyncResult> {
  const accessToken = decryptSecret(item.accessToken);
  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  const totals = { added: 0, modified: 0, removed: 0 };

  while (hasMore) {
    const { data } = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    await upsertAccounts(item.id, data.accounts);

    if (data.added.length > 0 || data.modified.length > 0) {
      await upsertTransactions(item.id, [...data.added, ...data.modified]);
    }

    if (data.removed.length > 0) {
      const removedIds = data.removed
        .map((r) => r.transaction_id)
        .filter((id): id is string => id !== null);
      if (removedIds.length > 0) {
        await db.delete(transactions).where(inArray(transactions.plaidTransactionId, removedIds));
      }
    }

    totals.added += data.added.length;
    totals.modified += data.modified.length;
    totals.removed += data.removed.length;

    cursor = data.next_cursor;
    hasMore = data.has_more;

    await db.update(plaidItems).set({ cursor }).where(eq(plaidItems.id, item.id));
  }

  await refreshSubscriptions(item);
  // Zelle counterparties come from the transactions we just wrote, so this
  // runs after the pages are in rather than as a separate manual step.
  await importZelleTransfers();

  return { itemId: item.itemId, ...totals };
}

/**
 * Plaid's recurring endpoint is rate-limited, so it is pulled here on the sync
 * cadence rather than on every page render.
 */
async function refreshSubscriptions(item: typeof plaidItems.$inferSelect) {
  const { data } = await plaidClient.transactionsRecurringGet({
    access_token: decryptSecret(item.accessToken),
  });

  if (data.outflow_streams.length === 0) return;

  await db
    .insert(subscriptions)
    .values(
      data.outflow_streams.map((s) => ({
        itemId: item.id,
        streamId: s.stream_id,
        // merchant_name comes back as "" rather than null, so ?? would not
        // fall through — use a truthiness check.
        name: s.merchant_name || s.description,
        averageAmount: Math.abs(s.average_amount.amount ?? 0).toFixed(2),
        frequency: String(s.frequency),
        status: String(s.status),
        isActive: s.is_active,
        predictedNextDate: s.predicted_next_date ?? null,
        lastDate: s.last_date,
      }))
    )
    .onConflictDoUpdate({
      target: subscriptions.streamId,
      set: {
        name: sql`excluded.name`,
        averageAmount: sql`excluded.average_amount`,
        frequency: sql`excluded.frequency`,
        status: sql`excluded.status`,
        isActive: sql`excluded.is_active`,
        predictedNextDate: sql`excluded.predicted_next_date`,
        lastDate: sql`excluded.last_date`,
      },
    });
}

async function upsertTransactions(itemPk: number, plaidTransactions: Transaction[]) {
  const accountRows = await db
    .select({ id: accounts.id, plaidAccountId: accounts.plaidAccountId })
    .from(accounts)
    .where(eq(accounts.itemId, itemPk));

  const accountIdByPlaidId = new Map(accountRows.map((a) => [a.plaidAccountId, a.id]));

  const rows = plaidTransactions
    .map((t) => {
      const accountId = accountIdByPlaidId.get(t.account_id);
      if (!accountId) return null; // account not yet synced this pass — skip, next sync catches it

      return {
        accountId,
        plaidTransactionId: t.transaction_id,
        amount: plaidAmountToBalanceDelta(t.amount).toString(),
        isoCurrencyCode: t.iso_currency_code,
        date: t.date,
        authorizedDate: t.authorized_date,
        name: t.name,
        merchantName: t.merchant_name ?? null,
        pending: t.pending,
        paymentChannel: t.payment_channel,
        personalFinanceCategoryPrimary: t.personal_finance_category?.primary ?? null,
        personalFinanceCategoryDetailed: t.personal_finance_category?.detailed ?? null,
        updatedAt: new Date(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;

  await db
    .insert(transactions)
    .values(rows)
    .onConflictDoUpdate({
      target: transactions.plaidTransactionId,
      set: {
        amount: sql`excluded.amount`,
        isoCurrencyCode: sql`excluded.iso_currency_code`,
        date: sql`excluded.date`,
        authorizedDate: sql`excluded.authorized_date`,
        name: sql`excluded.name`,
        merchantName: sql`excluded.merchant_name`,
        pending: sql`excluded.pending`,
        paymentChannel: sql`excluded.payment_channel`,
        personalFinanceCategoryPrimary: sql`excluded.pfc_primary`,
        personalFinanceCategoryDetailed: sql`excluded.pfc_detailed`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

export async function syncAllItems(): Promise<SyncResult[]> {
  const items = await db.select().from(plaidItems);
  const results: SyncResult[] = [];
  for (const item of items) {
    results.push(await syncTransactionsForItem(item));
  }
  return results;
}
