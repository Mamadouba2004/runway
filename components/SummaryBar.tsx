import { setFloor, setMode } from "@/app/actions";
import { BalanceTile } from "@/components/BalanceTile";
import { SafeToSpendTile } from "@/components/SafeToSpendTile";
import { AutoSubmitInput } from "@/components/AutoSubmitInput";
import { money } from "@/lib/format";
import type { SafeToSpend } from "@/lib/safe-to-spend";

type Props = {
  checkingBalance: number;
  savingsBalance: number;
  institutionName: string | null;
  lastRecordedDate: string | null;
  sts: SafeToSpend;
  setAsidePending: number;
  setAsideRate: number;
  savingsMoved180d: number;
  scheduled: number;
  floor: number;
  daysToPay: number | null;
  nextPayday: string | null;
  cadence: string;
  mode: "internship" | "school";
};

const cell = "px-5 py-4 border-r border-[var(--rule)]";
const figure = "mono text-[27px] font-semibold mt-1.5 tracking-[-0.01em]";

export function SummaryBar({
  checkingBalance,
  savingsBalance,
  institutionName,
  lastRecordedDate,
  sts,
  setAsidePending,
  setAsideRate,
  savingsMoved180d,
  scheduled,
  floor,
  daysToPay,
  nextPayday,
  cadence,
  mode,
}: Props) {
  return (
    <div className="flex items-stretch border-b-2 border-[var(--rule2)] flex-wrap">
      <BalanceTile
        checkingBalance={checkingBalance}
        savingsBalance={savingsBalance}
        savingsMoved180d={savingsMoved180d}
        institutionName={institutionName}
      />

      <SafeToSpendTile sts={sts} setAsideRate={setAsideRate} daysToPay={daysToPay} />

      <div className={`${cell} min-w-[178px]`}>
        <div className="label">Next deposit</div>
        <div className={figure}>{daysToPay !== null ? `${daysToPay}d` : "—"}</div>
        <div className="mono text-[9.5px] text-[var(--faint)] mt-1">
          {nextPayday ? `${nextPayday} · ${cadence}` : "no pay schedule set"}
        </div>
      </div>

      <FloorTile sts={sts} />

      <div className="flex-1 px-5 py-3.5 flex items-center justify-end gap-3">
        <div className="label">Mode</div>
        <div className="flex border border-[var(--rule2)]">
          {(["internship", "school"] as const).map((m) => (
            <form action={setMode} key={m}>
              <input type="hidden" name="mode" value={m} />
              <button
                type="submit"
                className={`btn ${mode === m ? "btn-on" : "btn-off"} px-4 py-2.5 text-[10.5px] tracking-[0.1em] min-h-[38px] uppercase`}
              >
                {m}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The floor is the number the whole safety-buffer idea rests on, so this shows
 * how it is being used rather than just its value: what is left after the
 * scheduled charges clear, measured against the floor, with an explicit
 * over/under state and a bar for the margin.
 */
function FloorTile({ sts }: { sts: SafeToSpend }) {
  // Reads the same computed value as the headline. These previously diverged by
  // exactly the set-aside term.
  const { beforeFloor, floor, shortfall, amount } = sts;
  const under = !sts.floorIntact;
  const coverage = floor > 0 ? Math.max(0, Math.min(beforeFloor / floor, 1)) : 1;

  return (
    <div className={`${cell} min-w-[232px]`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">Floor</span>
        <form action={setFloor} className="flex items-baseline gap-0.5">
          <span className="mono text-[10px] text-[var(--faint)]">$</span>
          <AutoSubmitInput
            name="floor"
            defaultValue={floor.toFixed(2)}
            inputMode="decimal"
            aria-label="Floor amount"
            className="input mono text-[10.5px] w-[62px] py-0.5"
          />
          <button type="submit" className="sr-only" tabIndex={-1}>
            Set floor
          </button>
        </form>
      </div>

      {/* A signed margin is arithmetic. What matters is whether the buffer is
          intact, so the state leads and the gap sits underneath. */}
      <div
        className="mono text-[22px] font-semibold mt-1.5 tracking-[-0.01em]"
        style={{ color: under ? "var(--alert)" : "var(--pos)" }}
      >
        {under ? "Below floor" : "Intact"}
      </div>

      <div className="h-1.5 bg-[var(--panel)] relative overflow-hidden mt-2">
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{
            width: `${coverage * 100}%`,
            background: under ? "var(--alert)" : "var(--pos)",
          }}
        />
      </div>

      <div className="mono text-[9.5px] text-[var(--faint)] mt-1.5 leading-relaxed">
        {under
          ? `${money(shortfall)} short of the ${money(floor)} buffer`
          : `${money(amount)} clear of the ${money(floor)} buffer`}
        <br />
        {money(beforeFloor)} left after scheduled + set-aside
      </div>
    </div>
  );
}

