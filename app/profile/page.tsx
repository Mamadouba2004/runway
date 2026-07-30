import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { incomeModes, transactions } from "@/lib/db/schema";
import { getSettings } from "@/lib/db/config";
import { incomeStats, upcomingPaydays } from "@/lib/income";
import { AutoSubmitInput } from "@/components/AutoSubmitInput";
import { setFloor, setHourly, setIncome, setIncomeSource, setMode, setPaySchedule } from "@/app/actions";
import { money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [settings, modes, txns] = await Promise.all([
    getSettings(),
    db.select().from(incomeModes).orderBy(asc(incomeModes.mode)),
    db.select().from(transactions),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="p-6">
      <div className="mx-auto max-w-[900px] border-2 border-[var(--rule2)] bg-[var(--surface)]">
        <div className="flex justify-between items-baseline px-5 py-4 border-b-2 border-[var(--rule2)]">
          <div>
            <h1 className="h-sec text-[19px]">Profile</h1>
            <p className="mono text-[10.5px] text-[var(--muted)] mt-1.5">
              Everything the projection assumes about you, in one editable place.
            </p>
          </div>
          <Link
            href="/"
            className="btn btn-off border border-[var(--rule)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em]"
          >
            Back to Home
          </Link>
        </div>

        <section className="px-5 py-4 border-b-2 border-[var(--rule2)]">
          <h2 className="h-sec text-[14px]">Current mode</h2>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex border border-[var(--rule2)]">
              {(["internship", "school"] as const).map((m) => (
                <form action={setMode} key={m}>
                  <input type="hidden" name="mode" value={m} />
                  <button
                    type="submit"
                    className={`btn ${settings.mode === m ? "btn-on" : "btn-off"} px-4 py-2 text-[10.5px] tracking-[0.1em] uppercase`}
                  >
                    {m}
                  </button>
                </form>
              ))}
            </div>
            <form action={setFloor} className="flex items-baseline gap-1.5">
              <span className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)]">
                Floor
              </span>
              <span className="mono text-[12px] text-[var(--faint)]">$</span>
              <AutoSubmitInput
                name="floor"
                defaultValue={Number(settings.floorAmount).toFixed(2)}
                inputMode="decimal"
                aria-label="Floor amount"
                className="input text-[12px] w-[80px]"
              />
              <button type="submit" className="sr-only" tabIndex={-1}>
                Set floor
              </button>
            </form>
          </div>
        </section>

        {modes.map((m) => {
          const stats = incomeStats(txns, m.sourcePattern, {
            hourlyRate: m.hourlyRate ? Number(m.hourlyRate) : null,
            maxHoursPerWeek: m.maxHoursPerWeek ? Number(m.maxHoursPerWeek) : null,
            windowDays: 365,
          });
          const next = upcomingPaydays(today, m.cadence, m.payAnchorDate, m.payDayOfMonth, 3);
          const override = m.amountPerPaycheck !== null;
          const effective = override ? Number(m.amountPerPaycheck) : stats.mean;

          return (
            <section key={m.mode} className="px-5 py-4 border-b-2 border-[var(--rule2)]">
              <div className="flex justify-between items-baseline">
                <h2 className="h-sec text-[14px]">
                  {m.mode} income
                  {settings.mode === m.mode && (
                    <span className="mono text-[9px] tracking-[0.12em] ml-2 text-[var(--pos)]">
                      ACTIVE
                    </span>
                  )}
                </h2>
                <span className="mono text-[10px] text-[var(--muted)]">
                  {stats.count} paycheck{stats.count === 1 ? "" : "s"} in 12 months ·{" "}
                  {stats.confidence} confidence
                </span>
              </div>

              {/* What the projection is actually using right now. */}
              <div className="mt-3 px-3.5 py-3 bg-[var(--panel)] border-l-4 border-[var(--rule2)]">
                <div className="mono text-[19px] font-semibold">
                  {money(effective)}
                  <span className="text-[10px] text-[var(--muted)] ml-2">
                    per paycheck · {override ? "manual override" : "observed average"}
                  </span>
                </div>
                {stats.count > 0 && (
                  <div className="mono text-[10px] text-[var(--muted)] mt-1">
                    observed {money(stats.min)} – {money(stats.max)}
                    {stats.cap !== null && ` · ceiling ${money(stats.cap)} at max hours`}
                  </div>
                )}
                {stats.count === 1 && (
                  <div className="mono text-[10px] mt-1" style={{ color: "var(--caution)" }}>
                    Only one paycheck on record — treated as a data point, not an average, and
                    no spread band is drawn.
                  </div>
                )}
                {stats.count === 0 && (
                  <div className="mono text-[10px] mt-1" style={{ color: "var(--alert)" }}>
                    No deposits match this source. Check the pattern below.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
                <Field label="Pay cadence & anchor">
                  <form action={setPaySchedule} className="flex gap-1.5 items-center flex-wrap">
                    <input type="hidden" name="mode" value={m.mode} />
                    <select
                      name="cadence"
                      defaultValue={m.cadence}
                      aria-label={`Cadence for ${m.mode}`}
                      className="input text-[11.5px]"
                    >
                      <option value="biweekly">biweekly</option>
                      <option value="monthly">monthly</option>
                    </select>
                    <input
                      name="payAnchorDate"
                      type="date"
                      defaultValue={m.payAnchorDate ?? ""}
                      aria-label={`Anchor payday for ${m.mode}`}
                      className="input text-[11.5px]"
                    />
                    <input
                      name="payDayOfMonth"
                      placeholder="day"
                      defaultValue={m.payDayOfMonth ?? ""}
                      inputMode="numeric"
                      aria-label={`Day of month for ${m.mode}`}
                      className="input text-[11.5px] w-[52px]"
                    />
                    <button
                      type="submit"
                      className="btn btn-off border border-[var(--rule)] px-2.5 py-1 text-[10px] uppercase"
                    >
                      Save
                    </button>
                  </form>
                  <p className="mono text-[9.5px] text-[var(--faint)] mt-1.5">
                    next: {next.map(shortDate).join(" · ") || "—"}
                  </p>
                </Field>

                <Field label="Amount per paycheck">
                  <form action={setIncome} className="flex gap-1.5 items-center">
                    <input type="hidden" name="mode" value={m.mode} />
                    <span className="mono text-[12px] text-[var(--faint)]">$</span>
                    <AutoSubmitInput
                      name="amount"
                      defaultValue={m.amountPerPaycheck ? Number(m.amountPerPaycheck).toFixed(2) : ""}
                      placeholder={stats.mean ? stats.mean.toFixed(2) : "—"}
                      inputMode="decimal"
                      aria-label={`Amount per paycheck for ${m.mode}`}
                      className="input text-[12px] w-[100px]"
                    />
                    <button type="submit" className="sr-only" tabIndex={-1}>
                      Set amount
                    </button>
                  </form>
                  <p className="mono text-[9.5px] text-[var(--faint)] mt-1.5">
                    leave blank to track the observed average
                  </p>
                </Field>

                <Field label="Hourly rate & max hours">
                  <form action={setHourly} className="flex gap-1.5 items-center flex-wrap">
                    <input type="hidden" name="mode" value={m.mode} />
                    <span className="mono text-[12px] text-[var(--faint)]">$</span>
                    <input
                      name="hourlyRate"
                      defaultValue={m.hourlyRate ? Number(m.hourlyRate).toFixed(2) : ""}
                      inputMode="decimal"
                      aria-label={`Hourly rate for ${m.mode}`}
                      className="input text-[11.5px] w-[64px]"
                    />
                    <span className="mono text-[10px] text-[var(--muted)]">/hr ×</span>
                    <input
                      name="maxHoursPerWeek"
                      defaultValue={m.maxHoursPerWeek ? Number(m.maxHoursPerWeek).toFixed(0) : ""}
                      inputMode="decimal"
                      aria-label={`Max hours per week for ${m.mode}`}
                      className="input text-[11.5px] w-[52px]"
                    />
                    <span className="mono text-[10px] text-[var(--muted)]">h/wk</span>
                    <button
                      type="submit"
                      className="btn btn-off border border-[var(--rule)] px-2.5 py-1 text-[10px] uppercase"
                    >
                      Save
                    </button>
                  </form>
                  <p className="mono text-[9.5px] text-[var(--faint)] mt-1.5">
                    sets the ceiling shown above; does not drive the projection
                  </p>
                </Field>

                <Field label="Which deposits count">
                  <form action={setIncomeSource} className="flex gap-1.5 items-center">
                    <input type="hidden" name="mode" value={m.mode} />
                    <input
                      name="sourcePattern"
                      defaultValue={m.sourcePattern ?? ""}
                      placeholder="employer name"
                      aria-label={`Income source for ${m.mode}`}
                      className="input text-[11.5px] flex-1 min-w-[150px]"
                    />
                    <button
                      type="submit"
                      className="btn btn-off border border-[var(--rule)] px-2.5 py-1 text-[10px] uppercase"
                    >
                      Save
                    </button>
                  </form>
                  <p className="mono text-[9.5px] text-[var(--faint)] mt-1.5">
                    matched against the deposit description
                  </p>
                </Field>
              </div>

              {stats.paychecks.length > 0 && (
                <details className="mt-3">
                  <summary className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)] cursor-pointer">
                    Matched deposits ({stats.paychecks.length})
                  </summary>
                  {stats.paychecks.slice(0, 10).map((p) => (
                    <div
                      key={`${p.date}-${p.amount}`}
                      className="flex justify-between py-1 border-b border-[var(--rule)] mono text-[11px]"
                    >
                      <span className="text-[var(--muted)]">{p.date}</span>
                      <span className="truncate px-2 text-[var(--faint)]">{p.name.slice(0, 34)}</span>
                      <span>{money(p.amount)}</span>
                    </div>
                  ))}
                </details>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
