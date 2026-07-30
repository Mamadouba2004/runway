import { setFloor, setMode } from "@/app/actions";
import { BalanceTile } from "@/components/BalanceTile";
import { AutoSubmitInput } from "@/components/AutoSubmitInput";
import { money } from "@/lib/format";

type Props = {
  checkingBalance: number;
  savingsBalance: number;
  depositoryCount: number;
  institutionName: string | null;
  lastRecordedDate: string | null;
  safeToSpend: number;
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
  depositoryCount,
  institutionName,
  lastRecordedDate,
  safeToSpend,
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
        depositoryCount={depositoryCount}
        institutionName={institutionName}
      />

      <div className={`${cell} min-w-[238px]`}>
        <div className="label">Safe to spend now</div>
        <div
          className={figure}
          style={{ color: safeToSpend < 0 ? "var(--alert)" : "var(--ink)" }}
        >
          {money(safeToSpend)}
        </div>
        <div className="mono text-[9.5px] text-[var(--faint)] mt-1">
          checking − {money(scheduled)} scheduled − {money(floor)} floor
        </div>
      </div>

      <div className={`${cell} min-w-[178px]`}>
        <div className="label">Next deposit</div>
        <div className={figure}>{daysToPay !== null ? `${daysToPay}d` : "—"}</div>
        <div className="mono text-[9.5px] text-[var(--faint)] mt-1">
          {nextPayday ? `${nextPayday} · ${cadence}` : "no pay schedule set"}
        </div>
      </div>

      <FloorTile checkingBalance={checkingBalance} floor={floor} scheduled={scheduled} />

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
function FloorTile({
  checkingBalance,
  floor,
  scheduled,
}: {
  checkingBalance: number;
  floor: number;
  scheduled: number;
}) {
  // Measured against checking, matching "safe to spend". Using the combined
  // balance here would have the two tiles disagree about the same question.
  const afterScheduled = checkingBalance - scheduled;
  const margin = afterScheduled - floor;
  const under = margin < 0;

  // How much of the floor the projected balance still covers.
  const coverage = floor > 0 ? Math.max(0, Math.min(afterScheduled / floor, 1)) : 1;

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

      <div
        className={figure}
        style={{ color: under ? "var(--alert)" : "var(--pos)" }}
      >
        {under ? `−${money(Math.abs(margin))}` : `+${money(margin)}`}
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

      <div className="mono text-[9.5px] text-[var(--faint)] mt-1.5">
        {under
          ? `${money(afterScheduled)} in checking after scheduled — under floor`
          : `${money(afterScheduled)} in checking after scheduled — above floor`}
      </div>
    </div>
  );
}

