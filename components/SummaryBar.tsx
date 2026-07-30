import { setFloor, setMode } from "@/app/actions";
import { AutoSubmitInput } from "@/components/AutoSubmitInput";
import { money, shortDate } from "@/lib/format";

type Props = {
  balance: number;
  checkingBalance: number;
  savingsBalance: number;
  depositoryCount: number;
  institutionName: string | null;
  safeToSpend: number;
  scheduled: number;
  floor: number;
  daysToPay: number | null;
  nextPayday: string | null;
  cadence: string;
  mode: "internship" | "school";
};

/**
 * Tier 1: the decision. One number leads, at a size nothing else on the page
 * competes with, and a sentence saying what it means. Everything else here is
 * supporting context and is deliberately quieter — previously four tiles shared
 * a single 27px style, so none of them led.
 */
export function SummaryBar({
  balance,
  checkingBalance,
  savingsBalance,
  depositoryCount,
  institutionName,
  safeToSpend,
  scheduled,
  floor,
  daysToPay,
  nextPayday,
  cadence,
  mode,
}: Props) {
  const under = safeToSpend < 0;
  const afterScheduled = checkingBalance - scheduled;

  return (
    <div className="border-b-2 border-[var(--rule2)]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 px-6 pt-6 pb-5">
        <div className="min-w-0">
          <div className="label">Safe to spend now</div>
          <div
            className="mono text-[44px] font-semibold leading-none tracking-[-0.02em] mt-2"
            style={{ color: under ? "var(--alert)" : "var(--pos)" }}
          >
            {money(safeToSpend)}
          </div>
          {/* The plain-language consequence, so the number needs no decoding. */}
          <p className="text-[13.5px] leading-snug mt-2.5 max-w-[54ch] text-[var(--ink)]">
            {under ? (
              <>
                You&rsquo;re <strong>{money(Math.abs(safeToSpend))} under</strong> your{" "}
                {money(floor)} floor.
              </>
            ) : (
              <>
                <strong>{money(safeToSpend)} clear</strong> of your {money(floor)} floor.
              </>
            )}{" "}
            {nextPayday && daysToPay !== null && (
              <span className="text-[var(--muted)]">
                Next deposit {shortDate(nextPayday)}
                {daysToPay === 0
                  ? " — today"
                  : `, in ${daysToPay} day${daysToPay === 1 ? "" : "s"}`}
                .
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="label">Mode</div>
          <div className="flex border border-[var(--rule2)]">
            {(["internship", "school"] as const).map((m) => (
              <form action={setMode} key={m}>
                <input type="hidden" name="mode" value={m} />
                <button
                  type="submit"
                  className={`btn ${mode === m ? "btn-on" : "btn-off"} px-3.5 py-2 text-[10px] tracking-[0.1em] uppercase`}
                >
                  {m}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>

      {/* Supporting context: the same figures as before, deliberately quiet. */}
      <div className="flex flex-wrap gap-x-9 gap-y-3 px-6 pb-5">
        <Stat
          label={`${institutionName ?? "Bank"} · ${depositoryCount} account${depositoryCount === 1 ? "" : "s"}`}
          value={money(balance)}
          note={`${money(checkingBalance)} checking · ${money(savingsBalance)} savings`}
        />
        <Stat
          label="Scheduled"
          value={money(scheduled)}
          note="active recurring, per month"
        />
        <Stat
          label="After scheduled"
          value={money(afterScheduled)}
          note="in checking"
          tone={afterScheduled < floor ? "alert" : undefined}
        />
        <div>
          <div className="label">Floor</div>
          <form action={setFloor} className="flex items-baseline gap-1 mt-1">
            <span className="mono text-[13px] text-[var(--faint)]">$</span>
            <AutoSubmitInput
              name="floor"
              defaultValue={floor.toFixed(2)}
              inputMode="decimal"
              aria-label="Floor amount"
              className="input mono text-[18px] font-semibold w-[86px] py-0"
            />
            <button type="submit" className="sr-only" tabIndex={-1}>
              Set floor
            </button>
          </form>
          <div className="mono text-[9.5px] text-[var(--faint)] mt-1">
            buffer you won&rsquo;t spend
          </div>
        </div>
        <Stat
          label="Pay schedule"
          value={nextPayday ? shortDate(nextPayday) : "—"}
          note={nextPayday ? `${cadence} · ${mode}` : "not set"}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "alert";
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className="mono text-[18px] font-semibold mt-1"
        style={tone === "alert" ? { color: "var(--alert)" } : undefined}
      >
        {value}
      </div>
      <div className="mono text-[9.5px] text-[var(--faint)] mt-1">{note}</div>
    </div>
  );
}
