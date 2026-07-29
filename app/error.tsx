"use client";

/**
 * In production Next replaces a thrown server error's message and stack with an
 * opaque `digest` before it reaches the browser, so a PostgresError carrying a
 * full query string never renders. This boundary makes that explicit and gives
 * the digest a place to show, so a failure can still be matched to a log line.
 *
 * The full-screen stack you see in `next dev` is the development overlay only.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-10">
      <div className="w-full max-w-[420px] border-2 border-[var(--rule2)] bg-[var(--surface)]">
        <div className="px-5 py-4 border-b-2 border-[var(--rule2)]">
          <h1 className="h-sec text-[17px]">Something went wrong</h1>
        </div>
        <div className="px-5 py-5">
          <p className="text-[13px] leading-relaxed text-[var(--ink)]">
            The page could not be loaded. The details were written to the server log.
          </p>
          {error.digest && (
            <p className="mono text-[10.5px] text-[var(--muted)] mt-3">
              ref {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="btn btn-on px-4 py-2.5 text-[10.5px] tracking-[0.1em] uppercase min-h-[38px] mt-4"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
