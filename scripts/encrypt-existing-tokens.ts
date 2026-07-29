/**
 * One-time migration: encrypt any Plaid access tokens still stored as
 * plaintext. Idempotent — rows already in v1 format are skipped, so it is safe
 * to re-run.
 *
 *   npx tsx scripts/encrypt-existing-tokens.ts
 */
import postgres from "postgres";
import { encryptSecret, isEncrypted, selfTest } from "../lib/crypto";

async function main() {
  if (!selfTest()) throw new Error("crypto self-test failed — aborting.");
  console.log("crypto self-test: ok");

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const rows = await sql<{ id: number; access_token: string }[]>`
    select id, access_token from plaid_items
  `;

  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isEncrypted(row.access_token)) {
      skipped++;
      continue;
    }
    await sql`
      update plaid_items
      set access_token = ${encryptSecret(row.access_token)}
      where id = ${row.id}
    `;
    encrypted++;
  }

  console.log(`rows: ${rows.length} · encrypted: ${encrypted} · already encrypted: ${skipped}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
