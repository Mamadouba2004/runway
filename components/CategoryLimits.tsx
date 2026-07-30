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

const grid = "grid grid-cols-[1.5fr_104px_1fr_88px] gap-x-4 items-center";

export function CategoryLimits({ categories, mode, incomeAmount }: Props) {
  // A category with no cap has nothing to be measured against — it was
  // rendering a full row to say "no cap", six times. Those move behind a
  // disclosure so the capped ones can actually be read.
  const capped = categories.filter((c) => c.cap !== null);
  const uncapped = categories.filter((c) => c.cap === null);

  return (
    <div>
      {capped.length > 0 && (
        <>
          <div
            className={`${grid} pb-2 mono text-[9px] tracking-[0.12em] uppercase text-[var(--muted)] border-b border-[var(--rule)]`}
          >
            <span>Category</span>
            <span>Cap</span>
            <span>Spent of cap</span>
            <span className="text-right">Pace</span>
          </div>
          {capped.map((c) => (
            <CategoryRow key={c.key} c={c} />
          ))}
        </>
      )}

      {capped.length === 0 && (
        <p className="mono text-[10.5px] text-[var(--faint)] leading-relaxed">
          No caps set yet. Add one below to start tracking a category against a limit.
        </p>
      )}

      {uncapped.length > 0 && (
        <details className="mt-3">
          <summary className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)] cursor-pointer">
            {uncapped.length} categories without a cap
          </summary>
          <div className="mt-2">
            <div
              className={`${grid} pb-2 mono text-[9px] tracking-[0.12em] uppercase text-[var(--muted)] border-b border-[var(--rule)]`}
            >
              <span>Category</span>
              <span>Set a cap</span>
              <span>Spent (30d)</span>
              <span />
            </div>
            {uncapped.map((c) => (
              <CategoryRow key={c.key} c={c} />
            ))}
          </div>
        </details>
      )}

      <form action={setIncome} className="flex items-baseline gap-2 mt-4 flex-wrap">
        <input type="hidden" name="mode" value={mode} />
        <span className="mono text-[9px] tracking-[0.12em] uppercase text-[var(--muted)]">
          Income / paycheck
        </span>
        <span className="mono text-[13px] text-[var(--faint)]">$</span>
        <AutoSubmitInput
          name="amount"
          defaultValue={incomeAmount !== null ? incomeAmount.toFixed(2) : ""}
          inputMode="decimal"
          aria-label="Income per paycheck"
          className="input text-[13px] w-[92px]"
        />
        <button type="submit" className="sr-only" tabIndex={-1}>
          Set income
        </button>
      </form>

      <p className="mono text-[9.5px] text-[var(--faint)] mt-2.5 leading-relaxed">
        Trailing 30 days, from imported charges only. Transfers between your own accounts
        are excluded.
      </p>
    </div>
  );
}

function CategoryRow({ c }: { c: Category }) {
  return (
    <div className={`${grid} py-2.5 border-b border-[var(--rule)]`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2.5 h-2.5 flex-none" style={{ background: c.color }} />
        <span className="text-[13px] truncate">{c.name}</span>
      </div>

      <form action={setCap} className="flex items-baseline gap-0.5">
        <input type="hidden" name="category" value={c.key} />
        <span className="mono text-[12px] text-[var(--faint)]">$</span>
        <AutoSubmitInput
          name="cap"
          defaultValue={c.cap !== null ? c.cap.toFixed(2) : ""}
          placeholder="—"
          inputMode="decimal"
          aria-label={`Cap for ${c.name}`}
          className="input text-[12px] w-[66px]"
        />
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
          className="mono text-[9.5px] mt-1"
          style={{ color: c.over ? "var(--alert)" : "var(--muted)" }}
        >
          {c.spent === null
            ? "no data"
            : c.cap === null
              ? `${money(c.spent)} spent`
              : `${money(c.spent)} of ${money(c.cap)}`}
        </div>
      </div>

      <div
        className="mono text-[10px] text-right"
        style={{ color: c.over ? "var(--alert)" : "var(--muted)" }}
      >
        {c.spent === null || c.cap === null
          ? "—"
          : c.over
            ? `${Math.round((c.spent / c.cap) * 100)}% over`
            : `${Math.round((c.spent / c.cap) * 100)}%`}
      </div>
    </div>
  );
}
