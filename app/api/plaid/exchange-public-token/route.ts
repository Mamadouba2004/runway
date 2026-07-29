import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid/client";
import { persistNewItem } from "@/lib/plaid/items";
import { accountsForItem } from "@/lib/plaid/accounts";
import { failure, rateLimit, tooManyRequests } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  const gate = rateLimit("exchange-public-token", 10, 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  let public_token: unknown;
  try {
    ({ public_token } = await request.json());
  } catch {
    // A non-JSON body is a client mistake, not a server fault.
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof public_token !== "string" || !public_token.startsWith("public-")) {
    return NextResponse.json({ error: "invalid_public_token" }, { status: 400 });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    const item = await persistNewItem(exchange.data.access_token, exchange.data.item_id);

    return NextResponse.json({
      item_id: item.itemId,
      accounts: await accountsForItem(item.id),
    });
  } catch (error) {
    return failure("exchange_failed", error);
  }
}
