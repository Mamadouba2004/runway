import { NextRequest, NextResponse } from "next/server";
import { syncAllItems } from "@/lib/plaid/sync";
import { failure, rateLimit, tooManyRequests } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  // /transactions/sync, /transactions/recurring/get and /transactions/refresh
  // all count against Plaid's quota, and recurring rate-limited us once already.
  const gate = rateLimit("sync-transactions", 4, 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  // Only an explicit "Sync now" asks Plaid to re-query Chase; background syncs
  // read whatever Plaid already has.
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    return NextResponse.json({ results: await syncAllItems({ forceRefresh }) });
  } catch (error) {
    return failure("sync_failed", error);
  }
}
