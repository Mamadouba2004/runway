import { setCap, setIncome } from "@/app/actions";
import { AutoSubmitInput } from "@/components/AutoSubmitInput";
import { money } from "@/lib/format";

type Category = {
  key: string;
  name: string;
  color: string;
  cap: number | null;
  spent: number | null;
  pct: number | null;
  over: boolean;
};

type Props = {
  categories: Category[];
  mode: "internship" | "school";
  incomeAmount: number | null;
};

const grid = "grid grid-cols-[1.4fr_108px_1fr_1.3fr] gap-x-3.5 items-center";

export function CategoryLimits({ categories, mode, incomeAmount }: Props) {
  const totalCapped = categories.reduce((s, c) => s + (c.cap ?? 0), 0);

  return (
    <div className="px-5 py-4 border-r border-[var(--rule)]">
      <div className="flex justify-between items-baseline gap-4">
        <h2 className="h-sec">Limits — {mode}</h2>
        <span className="mono text-[10.5px] text-[var(--muted)]">
          {totalCapped > 0 ? `${money(totalCapped)} allocated` : "no caps set"}
        </span>
      </div>

      <div
        className={`${grid} pt-3 pb-2 mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)] border-b-2 border-[var(--rule2)]`}
      >
        <span>Category</span>
        <span>Cap · editable</span>
        <span>Spent of cap</span>
        <span>Pace</span>
      </div>

      {categories.length === 0 && (
        <p className="mono text-[10.5px] text-[var(--faint)] mt-3 leading-relaxed">
          No spending categories in the imported records yet.
        </p>
      )}

      {categories.map((c) => (
        <div key={c.key} className={`${grid} py-2.5 border-b border-[var(--rule)]`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 flex-none" style={{ background: c.color }} />
            <span className="text-[13px] truncate">{c.name}</span>
          </div>

          <form action={setCap} className="flex items-baseline gap-0.5">
            <input type="hidden" name="category" value={c.key} />
            <span className="mono text-[13px] text-[var(--faint)]">$</span>
            <AutoSubmitInput
              name="cap"
              defaultValue={c.cap !== null ? c.cap.toFixed(2) : ""}
              placeholder="—"
              inputMode="decimal"
              aria-label={`Cap for ${c.name}`}
              className="input text-[13px] w-[70px]"
            />
            {/* Enables native implicit submission on Enter. */}
            <button type="submit" className="sr-only" tabIndex={-1}>
              Set cap
            </button>
          </form>

          <div>
            <div className="h-1.5 bg-[var(--panel)] relative overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0"
                style={{
                  width: c.pct !== null ? `${c.pct * 100}%` : "0%",
                  background: c.over ? "var(--alert)" : c.color,
                }}
              />
            </div>
            <div
              className="mono text-[10px] mt-1"
              style={{ color: c.over ? "var(--alert)" : "var(--muted)" }}
            >
              {c.spent === null
                ? "no data"
                : c.cap === null
                  ? `${money(c.spent)} spent · no cap`
                  : c.over
                    ? // An exhausted envelope is a state, not a running total.
                      // There is no cover-from action here, so a growing
                      // negative could only be felt, never acted on.
                      `done for this month · ${money(c.spent - c.cap)} past`
                    : `${money(c.cap - c.spent)} left of ${money(c.cap)}`}
            </div>
          </div>

          <div
            className="mono text-[10.5px]"
            style={{ color: c.over ? "var(--alert)" : "var(--muted)" }}
          >
            {pace(c)}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4 pt-3.5 pb-0.5 flex-wrap">
        <form action={setIncome} className="flex items-baseline gap-2">
          <input type="hidden" name="mode" value={mode} />
          <span className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)]">
            Income / paycheck
          </span>
          <span className="mono text-[14px]">$</span>
          <AutoSubmitInput
            name="amount"
            defaultValue={incomeAmount !== null ? incomeAmount.toFixed(2) : ""}
            inputMode="decimal"
            aria-label="Income per paycheck"
            className="input text-[14px] w-[96px]"
          />
          <button type="submit" className="sr-only" tabIndex={-1}>
            Set income
          </button>
        </form>
      </div>

      <div className="mono text-[10.5px] text-[var(--faint)] mt-2.5 leading-relaxed">
        Spent figures cover the trailing 30 days and come only from charges present in the
        imported records. Categories with no imported charges read “no data” rather than
        $0.00. Transfers between your own accounts are excluded.
      </div>
    </div>
  );
}

function pace(c: Category): string {
  if (c.spent === null || c.cap === null) return "—";
  if (c.over) return "spent";
  return `${Math.round((c.spent / c.cap) * 100)}% used`;
}
