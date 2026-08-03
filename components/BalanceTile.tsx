"use client";

import { useState } from "react";
import { money } from "@/lib/format";

/**
 * Checking is the whole world for spending decisions. Savings is shown here
 * only as a labelled figure so it is visible without being available — it feeds
 * nothing below: not safe-to-spend, not the floor check, not the runway.
 *
 * There is deliberately no "both" view. A combined number would reintroduce
 * exactly the mental backstop this model exists to remove.
 */
export function BalanceTile({
  checkingBalance,
  savingsBalance,
  savingsMoved180d,
  institutionName,
}: {
  checkingBalance: number;
  savingsBalance: number;
  savingsMoved180d: number;
  institutionName: string | null;
}) {
  const [showSavings, setShowSavings] = useState(false);

  return (
    <div className="px-5 py-4 border-r border-[var(--rule)] min-w-[236px]">
      <div className="label">
        {institutionName ?? "Bank"} · {showSavings ? "savings" : "checking"}
      </div>

      <div
        className="mono text-[27px] font-semibold mt-1.5 tracking-[-0.01em]"
        style={showSavings ? { color: "var(--muted)" } : undefined}
      >
        {money(showSavings ? savingsBalance : checkingBalance)}
      </div>

      <div className="flex border border-[var(--rule2)] mt-2 w-fit">
        {[
          { key: false, label: "CHECKING" },
          { key: true, label: "SAVINGS" },
        ].map((o) => (
          <button
            key={String(o.key)}
            type="button"
            onClick={() => setShowSavings(o.key)}
            aria-pressed={showSavings === o.key}
            className={`btn ${showSavings === o.key ? "btn-on" : "btn-off"} px-2 py-1 text-[9px] tracking-[0.08em]`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mono text-[9.5px] text-[var(--faint)] mt-1.5 leading-relaxed">
        {showSavings ? (
          <>
            set aside — not counted below
            {savingsMoved180d > 0 && (
              <>
                <br />
                {money(savingsMoved180d)} moved in 180d
              </>
            )}
          </>
        ) : (
          "everything below is checking only"
        )}
      </div>
    </div>
  );
}
