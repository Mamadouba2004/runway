import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { incomeModes, settings } from "@/lib/db/schema";

export type Mode = "internship" | "school";

// Seeded on first read so the app has a working configuration without a
// separate migration step. These are the user's own numbers, not anything
// inferred from Plaid — sandbox has no paycheck stream to detect.
const DEFAULT_INCOME: Record<Mode, { amountPerPaycheck: string; payDayOfMonth: number }> = {
  internship: { amountPerPaycheck: "990.26", payDayOfMonth: 22 },
  // Work-study average, standing in until real numbers replace it.
  school: { amountPerPaycheck: "130.02", payDayOfMonth: 22 },
};

export async function getSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;

  const [created] = await db
    .insert(settings)
    .values({ id: 1, mode: "internship", floorAmount: "100.00" })
    .onConflictDoNothing()
    .returning();

  return created ?? (await db.select().from(settings).where(eq(settings.id, 1)))[0];
}

export async function getIncomeModes() {
  const existing = await db.select().from(incomeModes);
  const missing = (Object.keys(DEFAULT_INCOME) as Mode[]).filter(
    (m) => !existing.some((r) => r.mode === m)
  );

  if (missing.length > 0) {
    await db
      .insert(incomeModes)
      .values(missing.map((m) => ({ mode: m, ...DEFAULT_INCOME[m] })))
      .onConflictDoNothing();
    return db.select().from(incomeModes);
  }

  return existing;
}
