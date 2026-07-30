import type { Subscription } from "@/lib/queries/home";
import { money } from "@/lib/format";

type Props = {
  subscriptions: Subscription[];
  total: number;
  incomeAmount: number | null;
};

export function Subscriptions({ subscriptions, total, incomeAmount }: Props) {
  // Inactive streams are history, not a commitment. They were rendering with
  // the same row weight as live ones, which made the list read longer and more
  // expensive than it actually is.
  const active = subscriptions.filter((s) => s.isActive);
  const inactive = subscriptions.filter((s) => !s.isActive);

  const share = incomeAmount && incomeAmount > 0 ? total / incomeAmount : null;
  const heavy = share !== null && share > 0.3;

  return (
    <div>
      {share !== null && (
        <div
          className="px-3.5 py-2.5 mb-3"
          style={{
            background: heavy ? "var(--alert-soft)" : "var(--caution-soft)",
            borderLeft: `4px solid ${heavy ? "var(--alert)" : "var(--caution)"}`,
          }}
        >
          <span
            className="mono text-[15px] font-semibold"
            style={{ color: heavy ? "var(--alert)" : "var(--caution)" }}
          >
            {Math.round(share * 100)}%
          </span>
          <span className="text-[12.5px] ml-2 text-[var(--ink)]">
            of one {money(incomeAmount!)} paycheck
          </span>
        </div>
      )}

      {active.length === 0 && (
        <p className="mono text-[10.5px] text-[var(--faint)] leading-relaxed">
          No active recurring streams detected.
        </p>
      )}

      {active.map((s) => (
        <Row key={`${s.name}-${s.dayOfMonth}-${s.amount}`} s={s} />
      ))}

      {inactive.length > 0 && (
        <details className="mt-3">
          <summary className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)] cursor-pointer">
            {inactive.length} inactive · not counted
          </summary>
          <div className="mt-1 opacity-60">
            {inactive.map((s) => (
              <Row key={`${s.name}-${s.dayOfMonth}-${s.amount}`} s={s} />
            ))}
          </div>
        </details>
      )}

      <p className="mono text-[9.5px] text-[var(--faint)] mt-3 leading-relaxed">
        From Plaid&rsquo;s recurring-transactions endpoint. Non-monthly cadences are
        converted to a monthly equivalent rather than charged in full each month.
      </p>
    </div>
  );
}

function Row({ s }: { s: Subscription }) {
  const monthly = s.frequency === "MONTHLY";
  const unknown = s.frequency === "UNKNOWN";

  return (
    <div
      className="grid grid-cols-[1fr_auto] gap-3 py-2 border-b border-[var(--rule)]"
      style={
        monthly
          ? undefined
          : {
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
        <div
          className="mono text-[9.5px] mt-0.5"
          style={{
            color: monthly ? "var(--faint)" : unknown ? "var(--caution)" : "var(--c-school)",
          }}
        >
          {s.frequency.toLowerCase().replace("_", "-")} · day {s.dayOfMonth}
          {s.status === "EARLY_DETECTION" && " · unconfirmed"}
        </div>
      </div>
      <div className="text-right">
        <div className="mono text-[13px]">{money(Math.abs(s.amount))}</div>
        {!monthly && (
          <div className="mono text-[9px] text-[var(--faint)] mt-0.5">
            {unknown ? "cadence unknown" : `≈ ${money(Math.abs(s.monthlyAmount))}/mo`}
          </div>
        )}
      </div>
    </div>
  );
}
