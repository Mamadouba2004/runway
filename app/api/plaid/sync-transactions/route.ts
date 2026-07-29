import { syncAllItems } from "@/lib/plaid/sync";
import { failure, rateLimit, tooManyRequests } from "@/lib/api/errors";
import { NextResponse } from "next/server";

export async function POST() {
  // /transactions/sync and /transactions/recurring/get both count against
  // Plaid's quota, and recurring rate-limited us once already at render time.
  const gate = rateLimit("sync-transactions", 4, 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  try {
    return NextResponse.json({ results: await syncAllItems() });
  } catch (error) {
    return failure("sync_failed", error);
  }
}
