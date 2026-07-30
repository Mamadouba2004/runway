import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid/client";
import { failure, rateLimit, tooManyRequests } from "@/lib/api/errors";

export async function POST() {
  const gate = rateLimit("create-link-token", 10, 60_000);
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  // OAuth institutions (Chase, Wells Fargo, …) send the user off to the bank and
  // back again, so they need a redirect_uri that is also registered in the Plaid
  // dashboard. Left unset, Link still works for plain-credential institutions.
  const redirectUri = process.env.PLAID_REDIRECT_URI;

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "runway-local-user" },
      client_name: "Runway",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      // Plaid defaults to 90 days and this CANNOT be changed once Transactions
      // is added to an Item — it has to be right before the first link. 730 is
      // the practical maximum; recurring detection wants >= 180 regardless.
      transactions: { days_requested: 730 },
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    return failure("link_token_create_failed", error);
  }
}
