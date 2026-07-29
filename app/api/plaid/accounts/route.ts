import { NextResponse } from "next/server";
import { allAccounts } from "@/lib/plaid/accounts";
import { failure } from "@/lib/api/errors";

// The OAuth flow navigates away and back, so connection state cannot live in
// component state alone — the page re-mounts and has to ask the server again.
export async function GET() {
  try {
    const accounts = await allAccounts();
    return NextResponse.json({ accounts: accounts.length > 0 ? accounts : null });
  } catch (error) {
    return failure("accounts_read_failed", error);
  }
}
