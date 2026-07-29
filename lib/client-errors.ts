/**
 * The server returns only a scope and a short correlation ref. Surface the ref
 * so a failure can be matched to a server log line, without echoing the
 * underlying Plaid or Postgres error to the page.
 */
export function refMessage(message: string, body: unknown): string {
  const ref =
    body && typeof body === "object" && "ref" in body
      ? String((body as { ref?: unknown }).ref ?? "")
      : "";
  return ref ? `${message} (ref ${ref})` : message;
}
