"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type State = "idle" | "syncing" | "error";

export function SyncNowButton({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [added, setAdded] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  // Relative time depends on Date.now(), which differs between the server
  // render and hydration. Compute it only on the client so the two agree.
  const [relativeLabel, setRelativeLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!lastSyncedAt) return;
    const update = () => setRelativeLabel(relative(lastSyncedAt));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [lastSyncedAt]);

  async function run() {
    setState("syncing");
    setAdded(null);
    try {
      const res = await fetch("/api/plaid/sync-transactions?refresh=1", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const total = (data.results ?? []).reduce(
        (s: number, r: { added: number; modified: number }) => s + r.added + r.modified,
        0
      );
      setAdded(total);
      setState("idle");
      // Pull the freshly written rows into the server-rendered view.
      startTransition(() => router.refresh());
    } catch {
      setState("error");
    }
  }

  const busy = state === "syncing" || pending;

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="btn btn-on px-3 py-1.5 text-[10px] tracking-[0.1em] uppercase disabled:opacity-45"
      >
        {busy ? "Syncing…" : "Sync now"}
      </button>
      <span className="mono text-[9.5px] text-[var(--faint)]">
        {state === "error"
          ? "sync failed"
          : added !== null
            ? `${added} new · just now`
            : lastSyncedAt
              ? relativeLabel
                ? `synced ${relativeLabel}`
                : "synced"
              : "never synced"}
      </span>
    </div>
  );
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
