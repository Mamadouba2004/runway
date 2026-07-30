import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { incomeModes, settings } from "@/lib/db/schema";

export type Mode = "internship" | "school";

// Seeded on first read so the app has a working configuration without a
// separate migration step. These are the user's own numbers, not anything
// inferred from Plaid — sandbox has no paycheck stream to detect.
// Seeded from what the imported history actually shows: both jobs pay
// biweekly, and each mode has its own employer. `amountPerPaycheck` is null so
// the projection uses the observed average for that source until overridden.
const DEFAULT_INCOME: Record<Mode, typeof incomeModes.$inferInsert> = {
  internship: {
    mode: "internship",
    amountPerPaycheck: null,
    cadence: "biweekly",
    payAnchorDate: "2026-08-04",
    sourcePattern: "RESEARCH FOUNDAT",
    hourlyRate: "22.00",
    maxHoursPerWeek: "34.00",
  },
  school: {
    mode: "school",
    amountPerPaycheck: null,
    cadence: "biweekly",
    payAnchorDate: "2026-08-04",
    sourcePattern: "WORK STUDY",
    hourlyRate: "22.00",
    maxHoursPerWeek: "34.00",
  },
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
      .values(missing.map((m) => DEFAULT_INCOME[m]))
      .onConflictDoNothing();
    return db.select().from(incomeModes);
  }

  return existing;
}
