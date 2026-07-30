"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnExit,
  type PlaidLinkOnSuccess,
} from "react-plaid-link";
import type { LinkedAccount } from "@/lib/plaid/accounts";
import { LINK_TOKEN_STORAGE_KEY } from "@/lib/plaid/oauth";
import { refMessage } from "@/lib/client-errors";
import { ConnectedAccounts } from "@/components/ConnectedAccounts";

export function PlaidLinkButton({ env }: { env: "sandbox" | "production" }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // An OAuth hand-off leaves and re-enters the app, so the source of truth for
  // "is something connected" is the server, not state we held before leaving.
  useEffect(() => {
    fetch("/api/plaid/accounts")
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {
        /* not connected yet — fall through to the connect button */
      });
  }, []);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(refMessage("", data).trim());
        return data;
      })
      .then((data) => {
        setLinkToken(data.link_token);
        // /oauth needs this exact token to resume the flow after the bank redirect.
        window.localStorage.setItem(LINK_TOKEN_STORAGE_KEY, data.link_token);
      })
      .catch((e) => setError(`Could not initialize Plaid Link. ${e.message}`.trim()));
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token) => {
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

    setAccounts(data.accounts);
  }, []);

  const onExit = useCallback<PlaidLinkOnExit>((err) => {
    if (err) setError(`${err.error_code}: ${err.display_message ?? err.error_message}`);
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess, onExit });

  if (accounts) return <ConnectedAccounts accounts={accounts} env={env} />;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => open()}
        disabled={!ready}
        className="btn btn-on px-5 py-3 text-[10.5px] tracking-[0.1em] uppercase min-h-[38px] disabled:opacity-45"
      >
        {env === "production"
          ? "Connect your bank"
          : "Connect a bank account (sandbox)"}
      </button>
      {error && <p className="max-w-md text-sm text-red-500">{error}</p>}
    </div>
  );
}
