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
  const amount = parseMoney(formData.get("amount"));
  if ((mode !== "internship" && mode !== "school") || amount === null || amount < 0) return;

  await db
    .update(incomeModes)
    .set({ amountPerPaycheck: amount.toFixed(2) })
    .where(eq(incomeModes.mode, mode));
  revalidatePath("/");
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
