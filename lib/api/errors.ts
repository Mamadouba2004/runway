import { NextResponse } from "next/server";

/**
 * Plaid error bodies carry `request_id`, `error_message`, `documentation_url`
 * and sometimes institution detail. None of that belongs in a browser
 * response. Log the full object server-side, hand the client a correlation id
 * and nothing else.
 */
export function failure(scope: string, error: unknown, status = 500) {
  const ref = crypto.randomUUID().slice(0, 8);

  const plaidBody =
    error && typeof error === "object" && "response" in error
      ? (error as { response?: { data?: unknown } }).response?.data
      : null;

  console.error(`[${scope}] ref=${ref}`, plaidBody ?? error);

  return NextResponse.json({ error: scope, ref }, { status });
}

/**
 * In-memory fixed-window limiter. Enough to stop a loop or an accidental
 * double-click from burning Plaid quota on a single-instance deploy; it does
 * not survive a restart and does not coordinate across instances.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { ok: false as const, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true as const, retryAfter: 0 };
}

export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
