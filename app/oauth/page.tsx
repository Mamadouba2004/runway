"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  usePlaidLink,
  type PlaidLinkOnExit,
  type PlaidLinkOnSuccess,
} from "react-plaid-link";
import { LINK_TOKEN_STORAGE_KEY } from "@/lib/plaid/oauth";
import { refMessage } from "@/lib/client-errors";

// Where the bank sends the user back to. Link is re-created here with the
// original link_token plus `receivedRedirectUri`, which carries the oauth_state_id
// Plaid appended to the URL — that is what lets Link resume rather than restart.
export default function OAuthReturnPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(LINK_TOKEN_STORAGE_KEY);

    if (!stored) {
      setError(
        "No link_token found for this OAuth session. Start the connection again from the home page."
      );
      return;
    }

    setLinkToken(stored);
    setReceivedRedirectUri(window.location.href);
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token) => {
      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(refMessage("Could not link that account.", data));
        return;
      }

      window.localStorage.removeItem(LINK_TOKEN_STORAGE_KEY);
      router.replace("/");
    },
    [router]
  );

  const onExit = useCallback<PlaidLinkOnExit>(
    (err) => {
      if (err) {
        setError(`${err.error_code}: ${err.display_message ?? err.error_message}`);
        return;
      }
      router.replace("/");
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess,
    onExit,
  });

  // Re-open Link as soon as it is ready; the user should not have to click again.
  useEffect(() => {
    if (ready && linkToken && receivedRedirectUri) open();
  }, [ready, linkToken, receivedRedirectUri, open]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-zinc-400">Finishing bank connection…</p>
      {error && <p className="max-w-md text-sm text-red-500">{error}</p>}
    </div>
  );
}
