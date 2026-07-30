"use client";

import { useState } from "react";
import { money } from "@/lib/format";

type View = "both" | "checking" | "savings";

/**
 * Both accounts by default, with a toggle to look at one at a time. Client
 * state rather than a server round-trip — this only changes what is displayed,
 * not what anything is calculated from.
 */
export function BalanceTile({
  checkingBalance,
  savingsBalance,
  depositoryCount,
  institutionName,
}: {
  checkingBalance: number;
  savingsBalance: number;
  depositoryCount: number;
  institutionName: string | null;
}) {
  const [view, setView] = useState<View>("both");

  const shown =
    view === "checking"
      ? checkingBalance
      : view === "savings"
        ? savingsBalance
        : checkingBalance + savingsBalance;

  const options: { key: View; label: string }[] = [
    { key: "both", label: "BOTH" },
    { key: "checking", label: "CHECKING" },
    { key: "savings", label: "SAVINGS" },
  ];

  return (
    <div className="px-5 py-4 border-r border-[var(--rule)] min-w-[252px]">
      <div className="label">
        {institutionName ?? "Bank"} ·{" "}
        {view === "both"
          ? `${depositoryCount} account${depositoryCount === 1 ? "" : "s"}`
          : view}
      </div>

      <div className="mono text-[27px] font-semibold mt-1.5 tracking-[-0.01em]">
        {money(shown)}
      </div>

      <div className="flex border border-[var(--rule2)] mt-2 w-fit">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setView(o.key)}
            aria-pressed={view === o.key}
            className={`btn ${view === o.key ? "btn-on" : "btn-off"} px-2 py-1 text-[9px] tracking-[0.08em]`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mono text-[9.5px] text-[var(--faint)] mt-1.5">
        {view === "both"
          ? `${money(checkingBalance)} checking · ${money(savingsBalance)} savings`
          : view === "checking"
            ? "spendable — what safe-to-spend uses"
            : "held back — still counts toward the runway"}
      </div>
    </div>
  );
}
