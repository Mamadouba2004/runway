import { addPerson, addTransfer } from "@/app/actions";
import { money, shortDate } from "@/lib/format";

type Transfer = {
  id: number;
  date: string;
  amount: number;
  direction: string;
  note: string | null;
};

type Person = {
  id: number;
  name: string;
  note: string | null;
  owed: number;
  transfers: Transfer[];
};

export function People({ people }: { people: Person[] }) {
  return (
    <div className="px-5 py-4">
      <div className="flex justify-between items-baseline">
        <h2 className="h-sec" style={{ color: "var(--c-people)" }}>
          People
        </h2>
        <span className="mono text-[10px] text-[var(--muted)]">entered by hand</span>
      </div>

      <p className="mt-2 mb-0 text-[12.5px] leading-normal text-[var(--muted)] text-pretty">
        Money sent to people you choose to support. Tracked, never scored — nothing here
        counts as overspending.
      </p>

      {people.length === 0 && (
        <p className="mono text-[10.5px] text-[var(--faint)] mt-3 leading-relaxed">
          Nobody added yet. P2P rails like Zelle don’t reliably surface through Plaid, so
          these are recorded manually.
        </p>
      )}

      {people.map((p) => (
        <div key={p.id} className="mt-3.5 pt-3 border-t border-[var(--rule)]">
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-[15px] font-semibold">{p.name}</span>
            {p.note && (
              <span className="mono text-[10.5px] text-[var(--muted)] text-right">{p.note}</span>
            )}
          </div>

          <div className="flex justify-between items-baseline mt-2">
            <span className="mono text-[9.5px] tracking-[0.12em] uppercase text-[var(--muted)]">
              Balance owed
            </span>
            <span
              className="mono text-[19px] font-semibold"
              style={{ color: "var(--c-people)" }}
            >
              {money(p.owed)}
            </span>
          </div>

          {p.transfers.map((t) => (
            <div
              key={t.id}
              className="flex justify-between py-1.5 border-b border-[var(--rule)] mono text-[11.5px]"
            >
              <span className="text-[var(--muted)]">
                {shortDate(t.date)}
                {t.note ? ` · ${t.note}` : ""}
              </span>
              <span>
                {t.direction === "received" ? "−" : ""}
                {money(t.amount)}
              </span>
            </div>
          ))}

          <form action={addTransfer} className="flex gap-1.5 mt-2.5 flex-wrap items-center">
            <input type="hidden" name="personId" value={p.id} />
            <input
              name="date"
              type="date"
              required
              aria-label={`Date of transfer for ${p.name}`}
              className="input text-[11px]"
            />
            <input
              name="amount"
              placeholder="0.00"
              inputMode="decimal"
              required
              aria-label={`Amount for ${p.name}`}
              className="input text-[11px] w-[74px]"
            />
            <select
              name="direction"
              aria-label={`Direction for ${p.name}`}
              className="input text-[11px]"
              defaultValue="sent"
            >
              <option value="sent">sent</option>
              <option value="received">received</option>
            </select>
            <button
              type="submit"
              className="btn btn-off border border-[var(--rule)] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.08em]"
            >
              Add
            </button>
          </form>
        </div>
      ))}

      <form action={addPerson} className="flex gap-1.5 mt-4 pt-3 border-t border-[var(--rule)] flex-wrap">
        <input
          name="name"
          placeholder="name"
          required
          aria-label="New person name"
          className="input text-[11.5px] flex-1 min-w-[110px]"
        />
        <input
          name="note"
          placeholder="note (optional)"
          aria-label="Note"
          className="input text-[11.5px] flex-1 min-w-[110px]"
        />
        <button
          type="submit"
          className="btn btn-off border border-[var(--rule)] px-3 py-1.5 text-[10.5px] uppercase tracking-[0.08em]"
        >
          Add person
        </button>
      </form>
    </div>
  );
}
