import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { people, transactions, transfers } from "@/lib/db/schema";

/**
 * Chase writes Zelle transfers as:
 *   "Zelle payment to PARIS REID JPM99cink5go"
 *   "Zelle payment from MOHAMED FADIGA 29923267989"
 *
 * The trailing token is an opaque Chase handle that differs per transaction, so
 * leaving it in fragments one person into many. Stripping it collapsed 28
 * apparent counterparties down to 23 real ones in the imported history.
 */
export function parseZelle(
  description: string
): { direction: "sent" | "received"; name: string } | null {
  const m = description.match(/zelle\s+(?:payment|transfer)?\s*(to|from)\s+(.+)/i);
  if (!m) return null;

  const name = m[2]
    .split(/\s+/)
    .filter((token) => {
      if (token.length < 6) return true;
      const mixed = /[0-9]/.test(token) && /[A-Za-z]/.test(token);
      if (mixed && token.length >= 8) return false; // JPM99cink5go, WFCT122DRM44
      if (/^\d{6,}$/.test(token)) return false; // 29923267989
      return true;
    })
    .join(" ")
    .trim();

  if (!name) return null;
  return { direction: m[1].toLowerCase() === "to" ? "sent" : "received", name };
}

/** Case/punctuation-insensitive key so "AMINATA BAH" and "Aminata Bah" merge. */
export function canonicalName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ImportResult = {
  scanned: number;
  peopleCreated: number;
  transfersImported: number;
  skippedExisting: number;
};

/**
 * Idempotent. Every imported transfer records its source transaction id, so
 * re-running after a sync only picks up genuinely new rows and never
 * duplicates a payment.
 */
export async function importZelleTransfers(): Promise<ImportResult> {
  const txns = await db.select().from(transactions);
  const zelle = txns.filter((t) => /zelle/i.test(t.name));

  const alreadyImported = new Set(
    (
      await db
        .select({ src: transfers.sourceTransactionId })
        .from(transfers)
        .where(isNotNull(transfers.sourceTransactionId))
    ).map((r) => r.src as string)
  );

  const existingPeople = await db.select().from(people);
  const peopleByKey = new Map(existingPeople.map((p) => [canonicalName(p.name), p.id]));

  const result: ImportResult = {
    scanned: zelle.length,
    peopleCreated: 0,
    transfersImported: 0,
    skippedExisting: 0,
  };

  for (const t of zelle) {
    if (alreadyImported.has(t.plaidTransactionId)) {
      result.skippedExisting++;
      continue;
    }

    const parsed = parseZelle(t.name);
    if (!parsed) continue;

    const key = canonicalName(parsed.name);
    if (!key) continue;

    let personId = peopleByKey.get(key);
    if (!personId) {
      const [created] = await db
        .insert(people)
        .values({ name: parsed.name, note: "from Zelle" })
        .returning();
      personId = created.id;
      peopleByKey.set(key, personId);
      result.peopleCreated++;
    }

    await db
      .insert(transfers)
      .values({
        personId,
        direction: parsed.direction,
        amount: Math.abs(Number(t.amount)).toFixed(2),
        date: t.date,
        sourceTransactionId: t.plaidTransactionId,
      })
      .onConflictDoNothing();

    result.transfersImported++;
  }

  return result;
}

/** Removes only imported rows, leaving anything hand-entered untouched. */
export async function clearImportedTransfers() {
  await db.delete(transfers).where(isNotNull(transfers.sourceTransactionId));
  await db.delete(people).where(and(eq(people.note, "from Zelle")));
}
