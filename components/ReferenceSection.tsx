import type { ReactNode } from "react";

/**
 * Tier 3 wrapper: reference material that answers a question you only
 * occasionally ask. Collapsed to a single summary line by default so it stops
 * competing with the decision and the trajectory above it.
 *
 * Native <details> rather than client state — no JS needed, and the browser
 * gives keyboard and screen-reader behaviour for free.
 */
export function ReferenceSection({
  title,
  headline,
  hint,
  accent,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** The one number worth seeing without expanding. */
  headline: string;
  /** What expanding will show, e.g. "7 active · 4 inactive". */
  hint: string;
  accent?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-[var(--rule)] last:border-b-0">
      <summary className="flex items-baseline justify-between gap-4 px-6 py-4 cursor-pointer list-none hover:bg-[var(--color-accent-100)]">
        <div className="flex items-baseline gap-3 min-w-0">
          <span
            className="mono text-[9px] text-[var(--muted)] w-3 shrink-0"
            aria-hidden="true"
          >
            {/* Rotates via the group-open state so the affordance is obvious. */}
            <span className="inline-block group-open:hidden">+</span>
            <span className="hidden group-open:inline">–</span>
          </span>
          <h2 className="h-sec text-[14px]" style={accent ? { color: accent } : undefined}>
            {title}
          </h2>
          <span className="mono text-[10px] text-[var(--muted)] truncate">{hint}</span>
        </div>
        <span className="mono text-[17px] font-semibold whitespace-nowrap">{headline}</span>
      </summary>
      <div className="px-6 pb-5">{children}</div>
    </details>
  );
}
