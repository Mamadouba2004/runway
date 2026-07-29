import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

export type LinkedAccount = {
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
};

function toLinkedAccount(row: typeof accounts.$inferSelect): LinkedAccount {
  return { name: row.name, mask: row.mask, type: row.type, subtype: row.subtype };
}

export async function accountsForItem(itemPk: number): Promise<LinkedAccount[]> {
  const rows = await db.select().from(accounts).where(eq(accounts.itemId, itemPk));
  return rows.map(toLinkedAccount);
}

// Single-user app — "connected accounts" means every account across every
// linked Item, not scoped to one bank.
export async function allAccounts(): Promise<LinkedAccount[]> {
  const rows = await db.select().from(accounts);
  return rows.map(toLinkedAccount);
}
