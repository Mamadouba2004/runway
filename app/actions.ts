"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  categoryCaps,
  incomeModes,
  people,
  settings,
  transfers,
} from "@/lib/db/schema";
import { getSettings } from "@/lib/db/config";

function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function setMode(formData: FormData) {
  const mode = formData.get("mode");
  if (mode !== "internship" && mode !== "school") return;

  await getSettings(); // ensure the row exists
  await db.update(settings).set({ mode }).where(eq(settings.id, 1));
  revalidatePath("/");
}

export async function setFloor(formData: FormData) {
  const amount = parseMoney(formData.get("floor"));
  if (amount === null || amount < 0) return;

  await getSettings();
  await db
    .update(settings)
    .set({ floorAmount: amount.toFixed(2) })
    .where(eq(settings.id, 1));
  revalidatePath("/");
}

export async function setSavingsRate(formData: FormData) {
  const raw = formData.get("rate");
  const basis = formData.get("basis");

  if (typeof basis === "string" && (basis === "set" || basis === "observed")) {
    await getSettings();
    await db.update(settings).set({ setAsideBasis: basis }).where(eq(settings.id, 1));
  }

  if (typeof raw === "string" && raw.trim()) {
    // Accept "35" or "0.35" — a percent field that rejects the percent is rude.
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) {
      const rate = n > 1 ? n / 100 : n;
      if (rate >= 0 && rate <= 1) {
        await getSettings();
        await db
          .update(settings)
          .set({ savingsSetAsideRate: rate.toFixed(4) })
          .where(eq(settings.id, 1));
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/profile");
}

export async function setCap(formData: FormData) {
  const category = formData.get("category");
  const amount = parseMoney(formData.get("cap"));
  if (typeof category !== "string" || !category || amount === null || amount < 0) return;

  await db
    .insert(categoryCaps)
    .values({ category, capAmount: amount.toFixed(2) })
    .onConflictDoUpdate({
      target: categoryCaps.category,
      set: { capAmount: sql`excluded.cap_amount` },
    });
  revalidatePath("/");
}

export async function setIncome(formData: FormData) {
  const mode = formData.get("mode");
  const raw = formData.get("amount");
  if (mode !== "internship" && mode !== "school") return;

  // Empty clears the override and hands the projection back to the observed
  // average, which is the point of having an override at all.
  const cleared = typeof raw === "string" && raw.trim() === "";
  const amount = parseMoney(raw);
  if (!cleared && (amount === null || amount < 0)) return;

  await db
    .update(incomeModes)
    .set({ amountPerPaycheck: cleared ? null : amount!.toFixed(2) })
    .where(eq(incomeModes.mode, mode));
  revalidatePath("/");
  revalidatePath("/profile");
}

/** Pay schedule: cadence plus whichever anchor that cadence needs. */
export async function setPaySchedule(formData: FormData) {
  const mode = formData.get("mode");
  const cadence = formData.get("cadence");
  const anchor = formData.get("payAnchorDate");
  const dom = formData.get("payDayOfMonth");
  if (mode !== "internship" && mode !== "school") return;
  if (cadence !== "biweekly" && cadence !== "monthly") return;

  const dayOfMonth = typeof dom === "string" && dom.trim() ? Number(dom) : null;
  if (dayOfMonth !== null && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
    return;
  }

  await db
    .update(incomeModes)
    .set({
      cadence,
      payAnchorDate:
        cadence === "biweekly" && typeof anchor === "string" && anchor ? anchor : null,
      payDayOfMonth: cadence === "monthly" ? dayOfMonth : null,
    })
    .where(eq(incomeModes.mode, mode));
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function setHourly(formData: FormData) {
  const mode = formData.get("mode");
  const rate = parseMoney(formData.get("hourlyRate"));
  const hours = parseMoney(formData.get("maxHoursPerWeek"));
  if (mode !== "internship" && mode !== "school") return;

  await db
    .update(incomeModes)
    .set({
      hourlyRate: rate !== null && rate >= 0 ? rate.toFixed(2) : null,
      maxHoursPerWeek: hours !== null && hours >= 0 ? hours.toFixed(2) : null,
    })
    .where(eq(incomeModes.mode, mode));
  revalidatePath("/");
  revalidatePath("/profile");
}

/** Which employer's deposits count as this mode's paycheck. */
export async function setIncomeSource(formData: FormData) {
  const mode = formData.get("mode");
  const pattern = formData.get("sourcePattern");
  if (mode !== "internship" && mode !== "school") return;

  await db
    .update(incomeModes)
    .set({
      sourcePattern:
        typeof pattern === "string" && pattern.trim() ? pattern.trim() : null,
    })
    .where(eq(incomeModes.mode, mode));
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function addPerson(formData: FormData) {
  const name = formData.get("name");
  const note = formData.get("note");
  if (typeof name !== "string" || !name.trim()) return;

  await db.insert(people).values({
    name: name.trim(),
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  revalidatePath("/");
}

export async function addTransfer(formData: FormData) {
  const personId = Number(formData.get("personId"));
  const amount = parseMoney(formData.get("amount"));
  const date = formData.get("date");
  const direction = formData.get("direction");
  const note = formData.get("note");

  if (!Number.isInteger(personId) || amount === null || amount <= 0) return;
  if (typeof date !== "string" || !date) return;
  if (direction !== "sent" && direction !== "received") return;

  await db.insert(transfers).values({
    personId,
    direction,
    amount: amount.toFixed(2),
    date,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  revalidatePath("/");
}
