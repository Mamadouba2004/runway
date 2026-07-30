"use client";

import { useMemo, useState } from "react";
import type { DayPoint } from "@/lib/runway";
import { compactMoney, money, shortDate, monthLabel } from "@/lib/format";

type Props = {
  series: DayPoint[];
  floor: number;
  monthlyBurn: number;
  subscriptionTotal: number;
  configuredIncome: number | null;
  observedIncome: number;
  payDayOfMonth: number | null;
};

const W = 1396;
const H = 330;
const PLOT_X = 58;
const PLOT_TOP = 18;
const PLOT_BOTTOM = 286;

const RANGES = [
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "ALL", days: Infinity },
] as const;

export function RunwayChart({
  series,
  floor,
  monthlyBurn,
  subscriptionTotal,
  configuredIncome,
  observedIncome,
  payDayOfMonth,
}: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("6m");
  // Which income figure drives the forward line. "observed" is what actually
  // landed; "configured" is the number set in Limits.
  const [basis, setBasis] = useState<"observed" | "configured">("observed");
  const [hover, setHover] = useState<number | null>(null);

  const recorded = useMemo(() => series.filter((p) => p.recorded), [series]);
  const anchor = recorded.at(-1) ?? series[0];

  // Re-derive the forward line client-side so the basis toggle is instant.
  const projected = useMemo(() => {
    if (!anchor) return [];
    const income = basis === "configured" ? (configuredIncome ?? 0) : observedIncome;
    const dailyBurn = monthlyBurn / 30;
    const out: DayPoint[] = [];
    let running = anchor.balance;

    for (let i = 1; i <= 180; i++) {
      const d = new Date(Date.parse(anchor.date) + i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      const dom = d.getUTCDate();
      running -= dailyBurn;
      if (payDayOfMonth && dom === payDayOfMonth) running += income;
      if (dom === 1) running -= subscriptionTotal; // billing days vary; bill once monthly
      out.push({ date: iso, balance: running, recorded: false });
    }
    return out;
  }, [anchor, basis, configuredIncome, observedIncome, monthlyBurn, subscriptionTotal, payDayOfMonth]);

  const windowed = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const trimmed =
      days === Infinity ? recorded : recorded.slice(Math.max(0, recorded.length - days));
    return [...trimmed, ...projected];
  }, [recorded, projected, range]);

  if (windowed.length < 2 || !anchor) {
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
  const balances = windowed.map((p) => p.balance);
  const rawMax = Math.max(...balances, floor);
  const rawMin = Math.min(...balances, 0);
  const pad = (rawMax - rawMin) * 0.1 || 100;
  const max = rawMax + pad;
  const min = rawMin - pad;

  const x = (i: number) => PLOT_X + (i / (windowed.length - 1)) * plotW;
  const y = (v: number) =>
    PLOT_BOTTOM - ((v - min) / (max - min)) * (PLOT_BOTTOM - PLOT_TOP);

  const splitIndex = windowed.findIndex((p) => !p.recorded);
  const line = (from: number, to: number) =>
    windowed
      .slice(from, to)
      .map((p, k) => `${k === 0 ? "M" : "L"}${x(from + k).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(" ");

  const monthlyNet =
    (basis === "configured" ? (configuredIncome ?? 0) : observedIncome) -
    subscriptionTotal -
    monthlyBurn;

  const low = projected.reduce((lo, p) => (p.balance < lo.balance ? p : lo), projected[0]);
  const breach = projected.find((p) => p.balance < floor) ?? null;
  const zeroCross = projected.find((p) => p.balance < 0) ?? null;

  const hovered = hover !== null ? windowed[hover] : null;

  return (
    <section className="px-5 pt-4 pb-3 border-b-2 border-[var(--rule2)]">
      <div className="flex justify-between items-start mb-2.5 gap-6 flex-wrap">
        <div>
          <h2 className="h-sec text-[19px]">Balance runway</h2>
          <div className="mono text-[10.5px] text-[var(--muted)] mt-1.5">
            solid = recorded · dashed = projected from {money(monthlyBurn)}/mo average spend,{" "}
            {money(subscriptionTotal)}/mo subscriptions and{" "}
            {basis === "configured" ? "the income you set" : "income actually received"}
          </div>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <ToggleGroup
            label="Range"
            options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            value={range}
            onChange={(k) => setRange(k as typeof range)}
          />
          <ToggleGroup
            label="Income"
            options={[
              { key: "observed", label: `OBSERVED ${money(observedIncome)}` },
              {
                key: "configured",
                label: `SET ${configuredIncome !== null ? money(configuredIncome) : "—"}`,
              },
            ]}
            value={basis}
            onChange={(k) => setBasis(k as typeof basis)}
          />
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - PLOT_X) / plotW) * (windowed.length - 1));
            setHover(i >= 0 && i < windowed.length ? i : null);
          }}
        >
          <rect x="0" y="0" width={W} height={H} fill="var(--panel)" />

          <rect
            x={PLOT_X}
            y={y(floor)}
            width={plotW}
            height={Math.max(0, PLOT_BOTTOM - y(floor))}
            fill="var(--alert-soft)"
          />

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

          {ticks(min, max, 5).map((v) => (
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

          {monthTicks(windowed, plotW).map((m) => (
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

          {splitIndex > 0 && (
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
                TODAY
              </text>
            </>
          )}

          <path d={line(0, splitIndex > 0 ? splitIndex : windowed.length)} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
          {splitIndex > 0 && (
            <path
              d={line(splitIndex - 1, windowed.length)}
              fill="none"
              stroke={breach ? "var(--alert)" : "var(--pos)"}
              strokeWidth="2"
              strokeDasharray="7 5"
            />
          )}

          {hover !== null && hovered && (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                stroke="var(--muted)"
                strokeWidth="1"
              />
              <circle
                cx={x(hover)}
                cy={y(hovered.balance)}
                r="4"
                fill={hovered.balance < floor ? "var(--alert)" : "var(--ink)"}
              />
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="absolute pointer-events-none border border-[var(--rule2)] bg-[var(--surface)] px-2.5 py-2"
            style={{
              left: `${(x(hover!) / W) * 100}%`,
              top: 8,
              transform: x(hover!) > W * 0.7 ? "translateX(-108%)" : "translateX(8px)",
              borderLeft: `4px solid ${hovered.balance < floor ? "var(--alert)" : "var(--pos)"}`,
              minWidth: 168,
            }}
          >
            <div className="mono text-[9.5px] tracking-[0.1em] uppercase text-[var(--muted)]">
              {shortDate(hovered.date)} · {hovered.recorded ? "recorded" : "projected"}
            </div>
            <div
              className="mono text-[17px] font-semibold mt-0.5"
              style={{ color: hovered.balance < floor ? "var(--alert)" : "var(--ink)" }}
            >
              {money(hovered.balance)}
            </div>
            <div className="mono text-[10px] text-[var(--muted)] mt-1">
              {hovered.balance < floor
                ? `${money(floor - hovered.balance)} below floor`
                : `${money(hovered.balance - floor)} above floor`}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-5 mt-2 mono text-[11px] text-[var(--muted)] flex-wrap">
        <span>
          net{" "}
          <strong style={{ color: monthlyNet < 0 ? "var(--alert)" : "var(--pos)" }}>
            {monthlyNet >= 0 ? "+" : "−"}
            {money(Math.abs(monthlyNet))}/mo
          </strong>
        </span>
        {low && (
          <span>
            low{" "}
            <strong style={{ color: low.balance < floor ? "var(--alert)" : "var(--pos)" }}>
              {money(low.balance)}
            </strong>{" "}
            {shortDate(low.date)}
          </span>
        )}
        <span>
          {zeroCross
            ? `hits $0 on ${shortDate(zeroCross.date)}`
            : breach
              ? `crosses the ${money(floor)} floor on ${shortDate(breach.date)}`
              : `stays above the ${money(floor)} floor for 180 days`}
        </span>
      </div>
    </section>
  );
}

function ToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-[9px] tracking-[0.14em] uppercase text-[var(--muted)]">
        {label}
      </span>
      <div className="flex border border-[var(--rule2)]">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={value === o.key}
            className={`btn ${value === o.key ? "btn-on" : "btn-off"} px-2.5 py-1 text-[9.5px] tracking-[0.08em]`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ticks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(min + i * step));
}

/**
 * A window that starts mid-month puts the first two ticks a few pixels apart
 * and the labels overprint each other. Drop any tick that would land too close
 * to the one before it.
 */
function monthTicks(series: DayPoint[], plotW: number) {
  const out: { index: number; label: string }[] = [];
  const minGap = 34; // px between labels at the SVG's own scale
  let seen = "";
  let lastX = -Infinity;

  series.forEach((p, i) => {
    const m = p.date.slice(0, 7);
    if (m === seen) return;
    seen = m;
    const px = (i / Math.max(1, series.length - 1)) * plotW;
    if (px - lastX < minGap) return;
    lastX = px;
    out.push({ index: i, label: monthLabel(p.date) });
  });
  return out;
}
