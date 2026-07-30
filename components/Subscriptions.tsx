import type { Subscription } from "@/lib/queries/home";
import { money } from "@/lib/format";

type Props = {
  subscriptions: Subscription[];
  total: number;
  incomeAmount: number | null;
};

export function Subscriptions({ subscriptions, total, incomeAmount }: Props) {
  const share = incomeAmount && incomeAmount > 0 ? total / incomeAmount : null;
  const heavy = share !== null && share > 0.3;

  return (
    <div className="px-5 py-4 border-r border-[var(--rule)]">
      <h2 className="h-sec">Subscriptions</h2>

      <div className="flex items-end gap-3 mt-2.5">
        <div className="mono text-[34px] font-semibold leading-none tracking-[-0.02em]">
          {money(total)}
        </div>
        <div className="mono text-[11px] text-[var(--muted)] pb-0.5 leading-tight">
          fixed
          <br />
          per month
        </div>
      </div>

      {share !== null && (
        <div
          className="mt-3 px-3.5 py-3"
          style={{
            background: heavy ? "var(--alert-soft)" : "var(--caution-soft)",
            borderLeft: `4px solid ${heavy ? "var(--alert)" : "var(--caution)"}`,
          }}
        >
          <div
            className="mono text-[21px] font-semibold"
            style={{ color: heavy ? "var(--alert)" : "var(--caution)" }}
          >
            {Math.round(share * 100)}%
          </div>
          <div className="text-[12.5px] leading-snug mt-1 text-[var(--ink)]">
            of one {money(incomeAmount!)} paycheck goes to fixed recurring charges.
          </div>
        </div>
      )}

      <div className="flex justify-between pt-3.5 pb-2 mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)] border-b-2 border-[var(--rule2)]">
        <span>Fixed</span>
        <span>Billing day</span>
      </div>

      {subscriptions.length === 0 && (
        <p className="mono text-[10.5px] text-[var(--faint)] mt-3 leading-relaxed">
          No recurring streams detected yet.
        </p>
      )}

      {subscriptions.map((s) => {
        const monthly = s.frequency === "MONTHLY";
        const unknown = s.frequency === "UNKNOWN";
        return (
        <div
          key={`${s.name}-${s.dayOfMonth}-${s.amount}`}
          className="grid grid-cols-[1fr_auto] gap-2.5 py-2 border-b border-[var(--rule)]"
          style={
            monthly
              ? undefined
              : // Non-monthly cadences get an inset rule and a tint so they do
                // not read as part of the recurring monthly drain.
                {
                  borderLeft: `3px solid ${unknown ? "var(--caution)" : "var(--c-school)"}`,
                  paddingLeft: 9,
                  background: "var(--panel)",
                }
          }
        >
          <div className="min-w-0">
            <div className="text-[13px] truncate" title={s.name}>
              {s.name}
            </div>
            <div className="text-[13px]">
              {!s.isActive && (
                <span className="mono text-[9px] tracking-[0.1em] uppercase text-[var(--faint)]">
                  {" "}
                  inactive
                </span>
              )}
              {s.status === "EARLY_DETECTION" && (
                <span className="mono text-[9px] tracking-[0.1em] uppercase text-[var(--caution)]">
                  {" "}
                  unconfirmed
                </span>
              )}
            </div>
            <div
              className="mono text-[10px] mt-0.5"
              style={{ color: monthly ? "var(--faint)" : unknown ? "var(--caution)" : "var(--c-school)" }}
            >
              {s.frequency.toLowerCase().replace("_", "-")} · day {s.dayOfMonth}
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-[13px]">{money(Math.abs(s.amount))}</div>
            {!monthly && (
              <div className="mono text-[9.5px] text-[var(--faint)] mt-0.5">
                {unknown
                  ? "cadence unknown"
                  : `≈ ${money(Math.abs(s.monthlyAmount))}/mo`}
              </div>
            )}
          </div>
        </div>
        );
      })}

      <div className="mono text-[10px] text-[var(--faint)] mt-3 leading-relaxed">
        Detected by Plaid’s recurring-transactions endpoint. Only active streams count
        against the runway, and non-monthly cadences are converted to a monthly
        equivalent rather than charged in full every month.
      </div>
    </div>
  );
}
