import { CountryCode, type AccountBase } from "plaid";
import { db } from "@/lib/db";
import { accounts, plaidItems } from "@/lib/db/schema";
import { plaidClient } from "@/lib/plaid/client";
import { sql } from "drizzle-orm";

// Runs right after /item/public_token/exchange. Looks up the institution name
// (Link's onSuccess metadata carries it too, but re-fetching server-side means
// this works the same whether Link ran normally or resumed via /oauth) and
// stores the Item + its accounts.
export async function persistNewItem(accessToken: string, itemId: string) {
  const { data: itemData } = await plaidClient.itemGet({ access_token: accessToken });

  let institutionName: string | null = null;
  const institutionId = itemData.item.institution_id ?? null;

  if (institutionId) {
    const { data: institution } = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });
    institutionName = institution.institution.name;
  }

  const [item] = await db
    .insert(plaidItems)
    .values({ itemId, accessToken, institutionId, institutionName })
    .returning();

  const { data: accountsData } = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  await upsertAccounts(item.id, accountsData.accounts);

  return item;
}

export async function upsertAccounts(itemPk: number, plaidAccounts: AccountBase[]) {
  if (plaidAccounts.length === 0) return;

  await db
    .insert(accounts)
    .values(
      plaidAccounts.map((account) => ({
        itemId: itemPk,
        plaidAccountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? null,
        mask: account.mask ?? null,
        type: String(account.type),
        subtype: account.subtype ? String(account.subtype) : null,
        currentBalance: account.balances.current?.toString() ?? null,
        availableBalance: account.balances.available?.toString() ?? null,
        isoCurrencyCode: account.balances.iso_currency_code ?? null,
      }))
    )
    .onConflictDoUpdate({
      target: accounts.plaidAccountId,
      set: {
        name: sql`excluded.name`,
        officialName: sql`excluded.official_name`,
        mask: sql`excluded.mask`,
        type: sql`excluded.type`,
        subtype: sql`excluded.subtype`,
        currentBalance: sql`excluded.current_balance`,
        availableBalance: sql`excluded.available_balance`,
        isoCurrencyCode: sql`excluded.iso_currency_code`,
      },
    });
}
