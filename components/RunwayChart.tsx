import type { DayPoint } from "@/lib/runway";
import { compactMoney, money, shortDate, monthLabel } from "@/lib/format";

type Props = {
  series: DayPoint[];
  floor: number;
  low: DayPoint | null;
  breach: DayPoint | null;
  firstRecordedDate: string | null;
};

const W = 1396;
const H = 330;
const PLOT_X = 58;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 286;

export function RunwayChart({ series, floor, low, breach, firstRecordedDate }: Props) {
  if (series.length < 2) {
    return (
      <section className="px-5 pt-4 pb-3 border-b-2 border-[var(--rule2)]">
        <h2 className="h-sec text-[19px]">Balance runway</h2>
        <p className="mono text-[11px] text-[var(--muted)] mt-3">
          Not enough recorded history to draw a runway yet.
        </p>
      </section>
    );
  }

  const plotR = W - 16;
  const plotW = plotR - PLOT_X;

  const balances = series.map((p) => p.balance);
  const rawMax = Math.max(...balances, floor);
  const rawMin = Math.min(...balances, 0);
  const pad = (rawMax - rawMin) * 0.08 || 100;
  const max = rawMax + pad;
  const min = rawMin - pad;

  const x = (i: number) => PLOT_X + (i / (series.length - 1)) * plotW;
  const y = (v: number) =>
    PLOT_BOTTOM - ((v - min) / (max - min)) * (PLOT_BOTTOM - PLOT_TOP);

  const recorded = series.filter((p) => p.recorded);
  const path = (pts: DayPoint[]) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(series.indexOf(p)).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");

  // The projection must start where history ends, or the line breaks visually.
  const splitIndex = recorded.length > 0 ? recorded.length - 1 : 0;
  const futurePts = series.slice(splitIndex);

  const gridValues = ticks(min, max, 5);
  const months = monthTicks(series);

  return (
    <section className="px-5 pt-4 pb-3 border-b-2 border-[var(--rule2)]">
      <div className="flex justify-between items-baseline mb-2.5 gap-6 flex-wrap">
        <div>
          <h2 className="h-sec text-[19px]">Balance runway</h2>
          <div className="mono text-[10.5px] text-[var(--muted)] mt-1.5">
            solid = recorded · dashed = projected from known fixed charges and income only
          </div>
        </div>
        <div className="flex gap-4 mono text-[10px] text-[var(--muted)]">
          <span>
            <span style={{ color: "var(--alert)" }}>■</span> below {money(floor)} floor
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
        <rect x="0" y="0" width={W} height={H} fill="var(--panel)" />

        {/* Below-floor band */}
        <rect
          x={PLOT_X}
          y={y(floor)}
          width={plotW}
          height={Math.max(0, PLOT_BOTTOM - y(floor))}
          fill="var(--alert-soft)"
        />

        {/* Zero line and floor line */}
        {min <= 0 && max >= 0 && (
          <line x1={PLOT_X} x2={plotR} y1={y(0)} y2={y(0)} stroke="var(--alert)" strokeWidth="1" />
        )}
        <line
          x1={PLOT_X}
          x2={plotR}
          y1={y(floor)}
          y2={y(floor)}
          stroke="var(--alert)"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.55"
        />

        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PLOT_X} x2={plotR} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
            <text
              x="6"
              y={y(v) + 3}
              fill="var(--muted)"
              fontFamily="var(--font-plex-mono), monospace"
              fontSize="10"
            >
              {compactMoney(v)}
            </text>
          </g>
        ))}

        {months.map((m) => (
          <g key={m.index}>
            <line
              x1={x(m.index)}
              x2={x(m.index)}
              y1={PLOT_TOP}
              y2={PLOT_BOTTOM}
              stroke="var(--grid)"
              strokeWidth="1"
            />
            <text
              x={x(m.index) + 4}
              y={PLOT_BOTTOM + 18}
              fill="var(--muted)"
              fontFamily="var(--font-plex-mono), monospace"
              fontSize="10"
              letterSpacing="1"
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Today marker — where recorded history stops and projection starts */}
        {recorded.length > 0 && (
          <>
            <line
              x1={x(splitIndex)}
              x2={x(splitIndex)}
              y1={PLOT_TOP}
              y2={PLOT_BOTTOM}
              stroke="var(--ink)"
              strokeWidth="2"
            />
            <text
              x={x(splitIndex) + 5}
              y={PLOT_TOP + 14}
              fill="var(--ink)"
              fontFamily="var(--font-plex-mono), monospace"
              fontSize="10.5"
              letterSpacing="1"
              fontWeight="600"
            >
              LAST RECORDED
            </text>
          </>
        )}

        {recorded.length > 1 && (
          <path d={path(recorded)} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
        )}
        {futurePts.length > 1 && (
          <path
            d={path(futurePts)}
            fill="none"
            stroke={breach ? "var(--alert)" : "var(--pos)"}
            strokeWidth="2"
            strokeDasharray="7 5"
          />
        )}

        {low && (
          <circle cx={x(series.indexOf(low))} cy={y(low.balance)} r="4" fill="var(--alert)" />
        )}
      </svg>

      <div className="flex gap-6 mt-2 mono text-[11px] text-[var(--muted)] flex-wrap">
        {low && (
          <span>
            lowest projected point{" "}
            <strong style={{ color: low.balance < floor ? "var(--alert)" : "var(--pos)" }}>
              {money(low.balance)}
            </strong>{" "}
            on {shortDate(low.date)}
          </span>
        )}
        <span>
          {breach
            ? `crosses the ${money(floor)} floor on ${shortDate(breach.date)}`
            : `stays above the ${money(floor)} floor for the projected window`}
        </span>
        {firstRecordedDate && <span>no balance history recorded before {shortDate(firstRecordedDate)}</span>}
      </div>
    </section>
  );
}

function ticks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + i * step));
}

function monthTicks(series: DayPoint[]) {
  const out: { index: number; label: string }[] = [];
  let seen = "";
  series.forEach((p, i) => {
    const m = p.date.slice(0, 7);
    if (m !== seen) {
      seen = m;
      out.push({ index: i, label: monthLabel(p.date) });
    }
  });
  return out;
}
