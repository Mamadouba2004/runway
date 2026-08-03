import { money } from "@/lib/format";

type Props = {
  safeToSpend: number;
  checkingBalance: number;
  scheduled: number;
  floor: number;
  setAsidePending: number;
  setAsideRate: number;
  daysToPay: number | null;
};

/**
 * A negative safe-to-spend is arithmetic, not a decision. YNAB can show a red
 * negative because it pairs it with a "cover this from another category"
 * action; with no such mechanic here the number can only be felt, not acted on.
 *
 * So this resolves to a state instead, and leads with a daily allowance —
 * "$18/day for 8 days" is something you can hold in your head at a checkout in
 * a way "$142" is not.
 */
export function SafeToSpendTile({
  safeToSpend,
  checkingBalance,
  scheduled,
  floor,
  setAsidePending,
  setAsideRate,
  daysToPay,
}: Props) {
  const days = daysToPay && daysToPay > 0 ? daysToPay : 1;
  const spendable = Math.max(0, safeToSpend);
  const perDay = spendable / days;
  const shortfall = safeToSpend < 0 ? Math.abs(safeToSpend) : 0;

  const state: "clear" | "tight" | "empty" =
    spendable <= 0 ? "empty" : perDay < 5 ? "tight" : "clear";

  const tone =
    state === "empty" ? "var(--alert)" : state === "tight" ? "var(--caution)" : "var(--pos)";

  return (
    <div className="px-5 py-4 border-r border-[var(--rule)] min-w-[262px]">
      <div className="label">Safe to spend</div>

      {state === "empty" ? (
        <>
          <div
            className="mono text-[22px] font-semibold mt-1.5 tracking-[-0.01em]"
            style={{ color: tone }}
          >
            Nothing left
          </div>
          <div className="text-[12.5px] mt-1.5 leading-snug text-[var(--ink)]">
            {daysToPay !== null
              ? `Next deposit in ${daysToPay} day${daysToPay === 1 ? "" : "s"}.`
              : "No deposit scheduled."}
          </div>
        </>
      ) : (
        <>
          <div
            className="mono text-[27px] font-semibold mt-1.5 tracking-[-0.01em]"
            style={{ color: tone }}
          >
            {money(perDay)}
            <span className="text-[13px] font-normal text-[var(--muted)]">/day</span>
          </div>
          <div className="text-[12.5px] mt-1 text-[var(--ink)]">
            {money(spendable)} over {days} day{days === 1 ? "" : "s"}
          </div>
        </>
      )}

      {/* The shortfall stays, but quietly — it is context, not the headline. */}
      <div className="mono text-[9.5px] text-[var(--faint)] mt-2 leading-relaxed">
        {shortfall > 0 && (
          <>
            {money(shortfall)} short of covering scheduled + floor
            <br />
          </>
        )}
        {money(checkingBalance)} checking − {money(scheduled)} scheduled −{" "}
        {money(floor)} floor
        {setAsidePending > 0 && (
          <>
            {" "}
            − {money(setAsidePending)} set aside ({Math.round(setAsideRate * 100)}%)
          </>
        )}
      </div>
    </div>
  );
}
