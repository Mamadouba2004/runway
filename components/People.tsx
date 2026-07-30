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
  sent: number;
  received: number;
  imported: boolean;
  transfers: Transfer[];
};

export function People({ people }: { people: Person[] }) {
  // "Supported" = net money out. Everyone else (net money in, or even) is real
  // but not what this section is for, so it collapses out of the way.
  const supported = people.filter((p) => p.owed > 0);
  const others = people.filter((p) => p.owed <= 0);
  const totalSupported = supported.reduce((s, p) => s + p.owed, 0);

  return (
    <div className="px-5 py-4">
      <div className="flex justify-between items-baseline">
        <h2 className="h-sec" style={{ color: "var(--c-people)" }}>
          People
        </h2>
        <span className="mono text-[10px] text-[var(--muted)]">
          {people.length} from Zelle
        </span>
      </div>

      <p className="mt-2 mb-0 text-[12.5px] leading-normal text-[var(--muted)] text-pretty">
        Money sent to people you choose to support. Tracked, never scored — nothing here
        counts as overspending or against the runway.
      </p>

      {supported.length > 0 && (
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className="mono text-[21px] font-semibold"
            style={{ color: "var(--c-people)" }}
          >
            {money(totalSupported)}
          </span>
          <span className="mono text-[10px] text-[var(--muted)]">
            net sent to {supported.length} people
          </span>
        </div>
      )}

      {people.length === 0 && (
        <p className="mono text-[10.5px] text-[var(--faint)] mt-3 leading-relaxed">
          Nobody yet. Zelle transfers are imported automatically on each sync; anything
          that doesn’t parse to a clean name can be added by hand below.
        </p>
      )}

      {supported.map((p) => (
        <details key={p.id} className="mt-3 pt-2.5 border-t border-[var(--rule)]">
          <summary className="flex justify-between items-baseline gap-3 cursor-pointer list-none">
            <span className="text-[14px] font-semibold truncate" title={p.name}>
              {p.name}
            </span>
            <span
              className="mono text-[15px] font-semibold whitespace-nowrap"
              style={{ color: "var(--c-people)" }}
            >
              {money(p.owed)}
            </span>
          </summary>

          <div className="mono text-[10px] text-[var(--muted)] mt-1">
            {p.transfers.length} transfer{p.transfers.length === 1 ? "" : "s"} · sent{" "}
            {money(p.sent)}
            {p.received > 0 ? ` · back ${money(p.received)}` : ""}
          </div>

          {p.transfers.slice(0, 8).map((t) => (
            <div
              key={t.id}
              className="flex justify-between py-1 border-b border-[var(--rule)] mono text-[11px]"
            >
              <span className="text-[var(--muted)]">{shortDate(t.date)}</span>
              <span style={{ color: t.direction === "received" ? "var(--pos)" : undefined }}>
                {t.direction === "received" ? "+" : "−"}
                {money(t.amount)}
              </span>
            </div>
          ))}
          {p.transfers.length > 8 && (
            <div className="mono text-[10px] text-[var(--faint)] mt-1">
              + {p.transfers.length - 8} older
            </div>
          )}

          <AddTransferForm personId={p.id} name={p.name} />
        </details>
      ))}

      {others.length > 0 && (
        <details className="mt-4 pt-3 border-t border-[var(--rule)]">
          <summary className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--muted)] cursor-pointer">
            {others.length} who sent you money
          </summary>
          {others.map((p) => (
            <div
              key={p.id}
              className="flex justify-between py-1.5 border-b border-[var(--rule)] text-[12px]"
            >
              <span className="truncate" title={p.name}>
                {p.name}
              </span>
              <span className="mono text-[11.5px]" style={{ color: "var(--pos)" }}>
                +{money(Math.abs(p.owed))}
              </span>
            </div>
          ))}
        </details>
      )}

      <form
        action={addPerson}
        className="flex gap-1.5 mt-4 pt-3 border-t border-[var(--rule)] flex-wrap"
      >
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

function AddTransferForm({ personId, name }: { personId: number; name: string }) {
  return (
    <form action={addTransfer} className="flex gap-1.5 mt-2 flex-wrap items-center">
      <input type="hidden" name="personId" value={personId} />
      <input
        name="date"
        type="date"
        required
        aria-label={`Date of transfer for ${name}`}
        className="input text-[10.5px]"
      />
      <input
        name="amount"
        placeholder="0.00"
        inputMode="decimal"
        required
        aria-label={`Amount for ${name}`}
        className="input text-[10.5px] w-[68px]"
      />
      <select
        name="direction"
        aria-label={`Direction for ${name}`}
        className="input text-[10.5px]"
        defaultValue="sent"
      >
        <option value="sent">sent</option>
        <option value="received">received</option>
      </select>
      <button
        type="submit"
        className="btn btn-off border border-[var(--rule)] px-2 py-1 text-[10px] uppercase tracking-[0.08em]"
      >
        Add
      </button>
    </form>
  );
}
