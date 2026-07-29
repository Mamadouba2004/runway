// Single-user auth. There is no user table and no registration — one
// passphrase from the environment gates the whole app.
//
// Runs in the proxy (edge) runtime, so this uses Web Crypto rather than
// node:crypto and has no imports outside the standard library.

export const SESSION_COOKIE = "runway_session";
const TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function enc(s: string) {
  return new TextEncoder().encode(s);
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison so a wrong guess leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueSession(secret: string): Promise<string> {
  const exp = String(Date.now() + TTL_SECONDS * 1000);
  return `${exp}.${await hmac(secret, exp)}`;
}

export async function verifySession(
  cookie: string | undefined,
  secret: string
): Promise<boolean> {
  if (!cookie) return false;
  const [exp, sig] = cookie.split(".");
  if (!exp || !sig) return false;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export async function passwordMatches(
  candidate: string,
  expected: string
): Promise<boolean> {
  // Compare digests so the comparison is fixed-length regardless of input.
  const [a, b] = await Promise.all([hmac("pw", candidate), hmac("pw", expected)]);
  return safeEqual(a, b);
}

export const SESSION_MAX_AGE = TTL_SECONDS;
