import { NextRequest, NextResponse } from "next/server";
import { createHash, createVerify } from "node:crypto";
import { plaidClient } from "@/lib/plaid/client";
import { syncByPlaidItemId } from "@/lib/plaid/sync";
import { failure } from "@/lib/api/errors";

/**
 * Plaid pushes here when Chase has new data, so transactions land without
 * waiting for a scheduled job.
 *
 * This route is deliberately EXCLUDED from the auth gate in proxy.ts — Plaid
 * cannot present a session cookie. Its authenticity comes instead from the
 * Plaid-Verification JWT, which is checked before anything is acted on. An
 * unverified body is discarded.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const token = request.headers.get("plaid-verification");

  if (!token) {
    return NextResponse.json({ error: "missing_verification" }, { status: 401 });
  }

  try {
    if (!(await verify(token, raw))) {
      return NextResponse.json({ error: "bad_verification" }, { status: 401 });
    }

    const body = JSON.parse(raw) as {
      webhook_type?: string;
      webhook_code?: string;
      item_id?: string;
    };

    const relevant =
      body.webhook_type === "TRANSACTIONS" &&
      // SYNC_UPDATES_AVAILABLE is the one that pairs with /transactions/sync.
      // The older codes still fire for backwards compatibility; treat them as
      // a signal too rather than ignoring a real update.
      ["SYNC_UPDATES_AVAILABLE", "DEFAULT_UPDATE", "INITIAL_UPDATE", "HISTORICAL_UPDATE"].includes(
        body.webhook_code ?? ""
      );

    if (!relevant || !body.item_id) {
      // Acknowledge anything else so Plaid does not retry it.
      return NextResponse.json({ ok: true, handled: false });
    }

    const result = await syncByPlaidItemId(body.item_id);
    console.log(`[webhook] ${body.webhook_code} ->`, result ?? "unknown item");

    return NextResponse.json({ ok: true, handled: true });
  } catch (error) {
    return failure("webhook_failed", error);
  }
}

/**
 * Plaid signs each webhook with a per-key-id JWT whose payload carries a
 * SHA-256 of the request body. Verifying the signature proves it came from
 * Plaid; comparing the hash proves the body was not swapped afterwards.
 */
async function verify(token: string, body: string): Promise<boolean> {
  const [headerB64, payloadB64] = token.split(".");
  if (!headerB64 || !payloadB64) return false;

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
  if (header.alg !== "ES256") return false; // never accept "none"

  const { data } = await plaidClient.webhookVerificationKeyGet({ key_id: header.kid });
  const key = data.key;
  if (!key || key.expired_at) return false;

  const publicKey = jwkToPem(key as unknown as JwkEc);
  const [, , signatureB64] = token.split(".");
  const verifier = createVerify("SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);

  const ok = verifier.verify(
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(signatureB64, "base64url")
  );
  if (!ok) return false;

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  const expected = createHash("sha256").update(body, "utf8").digest("hex");
  return payload.request_body_sha256 === expected;
}

type JwkEc = { crv: string; x: string; y: string };

/** Minimal P-256 JWK -> SPKI PEM, avoiding a dependency for one key type. */
function jwkToPem({ x, y }: JwkEc): string {
  const point = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(x, "base64url"),
    Buffer.from(y, "base64url"),
  ]);
  const prefix = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
  const der = Buffer.concat([prefix, point]);
  const b64 = der.toString("base64").match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
}
